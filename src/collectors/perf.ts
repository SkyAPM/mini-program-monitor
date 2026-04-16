import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import { getWx } from '../shared/wx';
import { warn, debug } from '../shared/log';
import { now } from '../shared/time';
import type { BrowserPerfData } from '../vendor/skywalking/protocol';

interface WxPerfEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  path?: string;
  referrerPath?: string;
  navigationType?: string;
  packageName?: string;
  packageSize?: number;
}

interface WxEntryList {
  getEntries(): WxPerfEntry[];
}

function currentPagePath(): string {
  try {
    const g = globalThis as { getCurrentPages?: () => Array<{ route?: string }> };
    const pages = g.getCurrentPages?.();
    if (pages && pages.length > 0) {
      return pages[pages.length - 1]?.route ?? 'unknown';
    }
  } catch {
    // ignored
  }
  return 'unknown';
}

function buildPerfData(
  entries: WxPerfEntry[],
  options: ResolvedOptions,
): BrowserPerfData | null {
  if (entries.length === 0) return null;

  const data: BrowserPerfData = {
    service: options.service,
    serviceVersion: options.serviceVersion,
    pagePath: entries[0]?.path ?? currentPagePath(),
  };

  for (const entry of entries) {
    const dur = Math.floor(entry.duration ?? 0);
    const start = Math.floor(entry.startTime ?? 0);

    switch (entry.entryType) {
      case 'navigation':
        if (entry.name === 'appLaunch') {
          data.loadPageTime = dur;
        } else if (entry.name === 'route') {
          data.redirectTime = dur;
        }
        break;
      case 'render':
        if (entry.name === 'firstRender') {
          data.fptTime = dur;
          data.domReadyTime = start + dur;
        } else if (entry.name === 'firstPaint') {
          data.fmpTime = start;
        } else if (entry.name === 'firstContentfulPaint') {
          data.ttlTime = start;
        }
        break;
      case 'script':
        data.domAnalysisTime = (data.domAnalysisTime ?? 0) + dur;
        break;
      case 'loadPackage':
        data.resTime = (data.resTime ?? 0) + dur;
        break;
    }
  }

  return data;
}

export function installPerfCollector(queue: RingQueue, options: ResolvedOptions): void {
  const wx = getWx();

  try {
    const perf = wx.getPerformance();
    const observer = perf.createObserver((entryList: WxEntryList) => {
      try {
        const entries = entryList.getEntries();
        const perfData = buildPerfData(entries, options);
        if (perfData) {
          debug('perf collector', entries.length, 'entries →', perfData);
          queue.push({ kind: 'perf', time: now(), payload: perfData });
        }
      } catch (err) {
        warn('perf collector observer failed', err);
      }
    });
    observer.observe({ entryTypes: ['navigation', 'render', 'script', 'loadPackage'] });
    debug('perf collector installed');
  } catch (err) {
    warn('perf collector install failed', err);
  }
}
