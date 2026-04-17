import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import type { PlatformAdapter } from '../adapters/types';
import type { OtlpEncoding } from '../types/options';
import type {
  OtlpResource,
  OtlpInstrumentationScope,
  OtlpLogRecord,
  OtlpMetric,
  ExportMetricsServiceRequest,
  ExportLogsServiceRequest,
} from '../types/otlp';
import { debug } from '../shared/log';
import { encodeLogsRequest, encodeMetricsRequest } from './otlp-proto';

export interface OtlpHttpExporterOptions {
  collector: string;
  resource: OtlpResource;
  scope: OtlpInstrumentationScope;
  adapter: PlatformAdapter;
  encoding?: OtlpEncoding;
}

export class OtlpHttpExporter implements Exporter {
  private readonly collector: string;
  private readonly resource: OtlpResource;
  private readonly scope: OtlpInstrumentationScope;
  private readonly adapter: PlatformAdapter;
  private readonly encoding: OtlpEncoding;

  constructor(opts: OtlpHttpExporterOptions) {
    this.collector = opts.collector.replace(/\/+$/, '');
    this.resource = opts.resource;
    this.scope = opts.scope;
    this.adapter = opts.adapter;
    this.encoding = opts.encoding ?? 'proto';
  }

  getCollectorUrl(): string {
    return this.collector;
  }

  async export(events: MonitorEvent[]): Promise<MonitorEvent[]> {
    const logRecords: OtlpLogRecord[] = [];
    const metrics: OtlpMetric[] = [];
    const logEvents: MonitorEvent[] = [];
    const metricEvents: MonitorEvent[] = [];
    const passthrough: MonitorEvent[] = [];

    for (const e of events) {
      if (e.kind === 'log') {
        logRecords.push(e.payload as OtlpLogRecord);
        logEvents.push(e);
      } else if (e.kind === 'metric') {
        metrics.push(...(e.payload as OtlpMetric[]));
        metricEvents.push(e);
      } else {
        passthrough.push(e);
      }
    }

    const failed: MonitorEvent[] = [...passthrough];

    const posts: Array<{ path: string; body: unknown; src: MonitorEvent[] }> = [];
    if (logRecords.length > 0) {
      const body: ExportLogsServiceRequest = {
        resourceLogs: [{ resource: this.resource, scopeLogs: [{ scope: this.scope, logRecords }] }],
      };
      posts.push({ path: '/v1/logs', body: this.encoding === 'proto' ? encodeLogsRequest(body).buffer : body, src: logEvents });
    }
    if (metrics.length > 0) {
      const body: ExportMetricsServiceRequest = {
        resourceMetrics: [{ resource: this.resource, scopeMetrics: [{ scope: this.scope, metrics }] }],
      };
      posts.push({ path: '/v1/metrics', body: this.encoding === 'proto' ? encodeMetricsRequest(body).buffer : body, src: metricEvents });
    }

    const results = await Promise.allSettled(posts.map((p) => this.post(p.path, p.body)));
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') failed.push(...posts[i].src);
    }
    return failed;
  }

  private post(path: string, data: unknown): Promise<void> {
    const url = `${this.collector}${path}`;
    const contentType = this.encoding === 'proto' ? 'application/x-protobuf' : 'application/json';
    return new Promise<void>((resolve, reject) => {
      try {
        this.adapter.request({
          url,
          method: 'POST',
          data,
          headers: { 'Content-Type': contentType },
          onSuccess: (statusCode) => {
            if (statusCode >= 200 && statusCode < 300) {
              debug('otlp exporter', url, '→', statusCode);
              resolve();
            } else {
              reject(new Error(`OTLP endpoint responded ${statusCode} on ${path}`));
            }
          },
          onFail: (errMsg) => reject(new Error(errMsg)),
        });
      } catch (err) {
        reject(err as Error);
      }
    });
  }
}
