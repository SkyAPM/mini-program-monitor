import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import type { PlatformAdapter } from '../adapters/types';
import type {
  OtlpResource,
  OtlpInstrumentationScope,
  OtlpLogRecord,
  OtlpMetric,
  ExportMetricsServiceRequest,
  ExportLogsServiceRequest,
} from '../types/otlp';
import { debug } from '../shared/log';

export interface OtlpHttpExporterOptions {
  collector: string;
  resource: OtlpResource;
  scope: OtlpInstrumentationScope;
  adapter: PlatformAdapter;
}

export class OtlpHttpExporter implements Exporter {
  private readonly collector: string;
  private readonly resource: OtlpResource;
  private readonly scope: OtlpInstrumentationScope;
  private readonly adapter: PlatformAdapter;

  constructor(opts: OtlpHttpExporterOptions) {
    this.collector = opts.collector.replace(/\/+$/, '');
    this.resource = opts.resource;
    this.scope = opts.scope;
    this.adapter = opts.adapter;
  }

  getCollectorUrl(): string {
    return this.collector;
  }

  async export(events: MonitorEvent[]): Promise<void> {
    const logRecords: OtlpLogRecord[] = [];
    const metrics: OtlpMetric[] = [];

    for (const e of events) {
      if (e.kind === 'log') {
        logRecords.push(e.payload as OtlpLogRecord);
      } else if (e.kind === 'metric') {
        const batch = e.payload as OtlpMetric[];
        metrics.push(...batch);
      }
    }

    const posts: Promise<void>[] = [];
    if (logRecords.length > 0) {
      const body: ExportLogsServiceRequest = {
        resourceLogs: [{
          resource: this.resource,
          scopeLogs: [{ scope: this.scope, logRecords }],
        }],
      };
      posts.push(this.post('/v1/logs', body));
    }
    if (metrics.length > 0) {
      const body: ExportMetricsServiceRequest = {
        resourceMetrics: [{
          resource: this.resource,
          scopeMetrics: [{ scope: this.scope, metrics }],
        }],
      };
      posts.push(this.post('/v1/metrics', body));
    }
    await Promise.all(posts);
  }

  private post(path: string, data: unknown): Promise<void> {
    const url = `${this.collector}${path}`;
    return new Promise<void>((resolve, reject) => {
      try {
        this.adapter.request({
          url,
          method: 'POST',
          data,
          headers: { 'Content-Type': 'application/json' },
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
