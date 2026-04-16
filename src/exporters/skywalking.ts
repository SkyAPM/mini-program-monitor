import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import { getWx } from '../shared/wx';
import { debug } from '../shared/log';
import { ReportTypes } from '../vendor/skywalking/constant';
import type { BrowserErrorLog, BrowserPerfData } from '../vendor/skywalking/protocol';

export interface SkyWalkingExporterOptions {
  collector: string;
}

export class SkyWalkingExporter implements Exporter {
  private readonly collector: string;

  constructor(opts: SkyWalkingExporterOptions) {
    this.collector = opts.collector.replace(/\/+$/, '');
  }

  async export(events: MonitorEvent[]): Promise<void> {
    const errorLogs: BrowserErrorLog[] = [];
    const perfBatch: BrowserPerfData[] = [];
    for (const e of events) {
      if (e.kind === 'error') errorLogs.push(e.payload as BrowserErrorLog);
      if (e.kind === 'perf') perfBatch.push(e.payload as BrowserPerfData);
    }
    const posts: Promise<void>[] = [];
    if (errorLogs.length > 0) {
      posts.push(this.post(ReportTypes.ERRORS, errorLogs));
    }
    for (const perf of perfBatch) {
      posts.push(this.post(ReportTypes.PERF, perf));
    }
    await Promise.all(posts);
  }

  getCollectorUrl(): string {
    return this.collector;
  }

  private post(path: string, data: unknown): Promise<void> {
    const url = `${this.collector}${path}`;
    return new Promise<void>((resolve, reject) => {
      try {
        getWx().request({
          url,
          method: 'POST',
          data: data as WechatMiniprogram.IAnyObject,
          header: { 'Content-Type': 'application/json' },
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              debug('skywalking exporter', url, '→', res.statusCode);
              resolve();
            } else {
              reject(new Error(`OAP responded ${res.statusCode} on ${path}`));
            }
          },
          fail: (err) => reject(new Error(err?.errMsg ?? 'wx.request failed')),
        });
      } catch (err) {
        reject(err as Error);
      }
    });
  }
}
