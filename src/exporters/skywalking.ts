import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import { getWx } from '../shared/wx';
import { debug } from '../shared/log';
import { ReportTypes } from '../vendor/skywalking/constant';
import type { BrowserErrorLog } from '../vendor/skywalking/protocol';

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
    for (const e of events) {
      if (e.kind === 'error') errorLogs.push(e.payload as BrowserErrorLog);
    }
    if (errorLogs.length > 0) {
      await this.post(ReportTypes.ERRORS, errorLogs);
    }
  }

  // Direct access to the collector URL used for loop-prevention in the
  // network collector (M4): any wx.request whose URL starts with this
  // prefix must not be instrumented, or the exporter will trace itself.
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
