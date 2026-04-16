import { _global } from '../shared/global';
import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import type { PlatformAdapter, PerfEntry, PerfEntryList } from '../adapters/types';
import type { OtlpMetric, OtlpKeyValue } from '../types/otlp';
import { warn, debug } from '../shared/log';
import { now } from '../shared/time';

function currentPagePath(): string {
  try {
    const g = (_global) as { getCurrentPages?: () => Array<{ route?: string }> };
    const pages = g.getCurrentPages?.();
    if (pages && pages.length > 0) {
      return pages[pages.length - 1]?.route ?? 'unknown';
    }
  } catch {
    // ignored
  }
  return 'unknown';
}

function toNanos(ms: number): string {
  return ms + '000000';
}

function pageAttr(pagePath: string): OtlpKeyValue[] {
  return [{ key: 'miniprogram.page.path', value: { stringValue: pagePath } }];
}

function gaugeMetric(name: string, valueMs: number, pagePath: string, timeMs: number): OtlpMetric {
  return {
    name,
    unit: 'ms',
    gauge: {
      dataPoints: [{
        asInt: String(Math.floor(valueMs)),
        timeUnixNano: toNanos(timeMs),
        attributes: pageAttr(pagePath),
      }],
    },
  };
}

function pushMetrics(queue: RingQueue, metrics: OtlpMetric[]): void {
  if (metrics.length > 0) {
    queue.push({ kind: 'metric', time: now(), payload: metrics });
  }
}

// ── Observer-based path (WeChat) ──

function buildMetricsFromEntries(entries: PerfEntry[], timeMs: number): OtlpMetric[] {
  const metrics: OtlpMetric[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    const dur = entry.duration ?? 0;
    const start = entry.startTime ?? 0;
    const page = entry.path ?? currentPagePath();

    switch (entry.entryType) {
      case 'navigation':
        if (entry.name === 'appLaunch') {
          metrics.push(gaugeMetric('miniprogram.app_launch.duration', dur, page, timeMs));
        } else if (entry.name === 'route') {
          metrics.push(gaugeMetric('miniprogram.route.duration', dur, page, timeMs));
        }
        break;
      case 'render':
        if (entry.name === 'firstRender') {
          metrics.push(gaugeMetric('miniprogram.first_render.duration', dur, page, timeMs));
        } else if (entry.name === 'firstPaint') {
          metrics.push(gaugeMetric('miniprogram.first_paint.time', start, page, timeMs));
        }
        break;
      case 'script':
        metrics.push(gaugeMetric('miniprogram.script.duration', dur, page, timeMs));
        break;
      case 'loadPackage':
        metrics.push(gaugeMetric('miniprogram.package_load.duration', dur, page, timeMs));
        break;
    }
  }
  return metrics;
}

function installObserverPerf(adapter: PlatformAdapter, queue: RingQueue): void {
  const perf = adapter.getPerformance!();
  const observer = perf.createObserver((entryList: PerfEntryList) => {
    try {
      const entries = entryList.getEntries();
      const metrics = buildMetricsFromEntries(entries, Date.now());
      if (metrics.length > 0) {
        debug('perf collector', entries.length, 'entries →', metrics.length, 'metrics');
        pushMetrics(queue, metrics);
      }
    } catch (err) {
      warn('perf collector observer failed', err);
    }
  });
  observer.observe({ entryTypes: ['navigation', 'render', 'script', 'loadPackage'] });
  debug('perf collector installed (observer)');
}

// ── Lifecycle-based path (Alipay / fallback) ──

function installLifecyclePerf(adapter: PlatformAdapter, queue: RingQueue): void {
  let appLaunchStart = 0;
  let pageLoadStarts: Record<string, number> = {};

  if (adapter.wrapApp) {
    adapter.wrapApp({
      onLaunch() {
        appLaunchStart = Date.now();
      },
      onShow() {
        if (appLaunchStart > 0) {
          const duration = Date.now() - appLaunchStart;
          const page = currentPagePath();
          pushMetrics(queue, [gaugeMetric('miniprogram.app_launch.duration', duration, page, Date.now())]);
          appLaunchStart = 0;
        }
      },
    });
  }

  if (adapter.wrapPage) {
    adapter.wrapPage({
      onLoad() {
        const page = currentPagePath();
        pageLoadStarts[page] = Date.now();
      },
      onReady() {
        const page = currentPagePath();
        const start = pageLoadStarts[page];
        if (start) {
          const duration = Date.now() - start;
          pushMetrics(queue, [gaugeMetric('miniprogram.first_render.duration', duration, page, Date.now())]);
          delete pageLoadStarts[page];
        }
      },
      onHide() {
        const page = currentPagePath();
        delete pageLoadStarts[page];
      },
    });
  }

  debug('perf collector installed (lifecycle)');
}

// ── Entry point ──

export function installPerfCollector(
  adapter: PlatformAdapter,
  queue: RingQueue,
  _options: ResolvedOptions,
): void {
  try {
    if (adapter.hasPerformanceObserver && adapter.getPerformance) {
      installObserverPerf(adapter, queue);
    } else {
      installLifecyclePerf(adapter, queue);
    }
  } catch (err) {
    warn('perf collector install failed', err);
  }
}
