import { currentPagePath } from '../shared/page';
import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import type { PlatformAdapter, PerfEntry, PerfEntryList, Uninstall } from '../adapters/types';
import type { OtlpMetric, OtlpKeyValue } from '../types/otlp';
import { warn, debug } from '../shared/log';
import { now } from '../shared/time';


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

function installObserverPerf(adapter: PlatformAdapter, queue: RingQueue): Uninstall {
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
  return () => {
    try { observer.disconnect(); } catch { /* ignored */ }
  };
}

// ── Lifecycle-based path (Alipay / fallback) ──

function installLifecyclePerf(adapter: PlatformAdapter, queue: RingQueue): Uninstall {
  // If init() ran inside App.onLaunch, our wrapApp hooks never fire for the
  // initial launch (App was already registered). Use install time as a
  // fallback origin and emit once on the first page's onReady.
  const installTime = Date.now();
  let appLaunchStart: number | undefined;
  let appLaunchEmitted = false;
  let pageLoadStarts: Record<string, number> = {};
  const uninstalls: Uninstall[] = [];

  function emitAppLaunch(duration: number, page: string): void {
    if (appLaunchEmitted) return;
    pushMetrics(queue, [gaugeMetric('miniprogram.app_launch.duration', duration, page, Date.now())]);
    appLaunchEmitted = true;
  }

  if (adapter.wrapApp) {
    uninstalls.push(adapter.wrapApp({
      onLaunch() {
        appLaunchStart = Date.now();
      },
      onShow() {
        if (appLaunchStart !== undefined) {
          emitAppLaunch(Date.now() - appLaunchStart, currentPagePath());
          appLaunchStart = undefined;
        }
      },
    }));
  }

  if (adapter.wrapPage) {
    uninstalls.push(adapter.wrapPage({
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
        if (!appLaunchEmitted) {
          emitAppLaunch(Date.now() - installTime, page);
        }
      },
      onHide() {
        const page = currentPagePath();
        delete pageLoadStarts[page];
      },
    }));
  }

  debug('perf collector installed (lifecycle)');
  return () => {
    for (const u of uninstalls) { try { u(); } catch { /* ignored */ } }
  };
}

// ── Entry point ──

export function installPerfCollector(
  adapter: PlatformAdapter,
  queue: RingQueue,
  _options: ResolvedOptions,
): Uninstall {
  try {
    if (adapter.hasPerformanceObserver && adapter.getPerformance) {
      return installObserverPerf(adapter, queue);
    }
    return installLifecyclePerf(adapter, queue);
  } catch (err) {
    warn('perf collector install failed', err);
    return () => {};
  }
}
