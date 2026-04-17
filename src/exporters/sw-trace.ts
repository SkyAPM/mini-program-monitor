import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import type { SegmentObject } from '../types/segment';
import type { PlatformAdapter } from '../adapters/types';
import { debug } from '../shared/log';

export interface SwTraceExporterOptions {
  collector: string;
  adapter: PlatformAdapter;
}

export class SwTraceExporter implements Exporter {
  private readonly collector: string;
  private readonly adapter: PlatformAdapter;

  constructor(opts: SwTraceExporterOptions) {
    this.collector = opts.collector.replace(/\/+$/, '');
    this.adapter = opts.adapter;
  }

  async export(events: MonitorEvent[]): Promise<MonitorEvent[]> {
    const segments: SegmentObject[] = [];
    const segmentEvents: MonitorEvent[] = [];
    const passthrough: MonitorEvent[] = [];
    for (const e of events) {
      if (e.kind === 'segment') {
        segments.push(e.payload as SegmentObject);
        segmentEvents.push(e);
      } else {
        passthrough.push(e);
      }
    }
    if (segments.length === 0) return passthrough;
    try {
      await this.post('/v3/segments', segments);
      return passthrough;
    } catch (err) {
      return [...passthrough, ...segmentEvents];
    }
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
              debug('sw-trace exporter', url, '→', statusCode);
              resolve();
            } else {
              reject(new Error(`OAP responded ${statusCode} on ${path}`));
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
