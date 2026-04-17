import type { MonitorOptions } from './types/options';
import type { MonitorEvent, EventKind } from './types/events';
import type { PlatformAdapter } from './adapters/types';
import type { Exporter } from './exporters/types';
import { resolveOptions } from './core/options';
import { RingQueue } from './core/queue';
import { Scheduler } from './core/scheduler';
import { buildResource, buildScope } from './core/resource';
import { detectPlatform } from './adapters/detect';
import { installErrorCollector } from './collectors/error';
import { installPerfCollector } from './collectors/perf';
import { installRequestCollector } from './collectors/request';
import { OtlpHttpExporter } from './exporters/otlp-http';
import { SwTraceExporter } from './exporters/sw-trace';
import { CompositeExporter } from './exporters/composite';
import { ConsoleExporter } from './exporters/console';
import { setDebug, warn } from './shared/log';
import { now } from './shared/time';

let queue: RingQueue | null = null;
let scheduler: Scheduler | null = null;
let adapter: PlatformAdapter | null = null;

export function init(opts: MonitorOptions): void {
  const o = resolveOptions(opts);
  setDebug(o.debug);

  adapter = detectPlatform(o.platform);
  queue = new RingQueue(o.maxQueue);

  let exporter: Exporter;
  if (o.collector) {
    const exporters: Exporter[] = [
      new OtlpHttpExporter({
        collector: o.collector,
        resource: buildResource(o),
        scope: buildScope(),
        adapter,
        encoding: o.encoding,
      }),
    ];
    if (o.enable.tracing && o.traceCollector) {
      exporters.push(new SwTraceExporter({ collector: o.traceCollector, adapter }));
    }
    exporter = exporters.length === 1 ? exporters[0] : new CompositeExporter(exporters);
  } else {
    exporter = new ConsoleExporter();
  }

  scheduler = new Scheduler(queue, exporter, o.flushInterval);
  scheduler.start();

  if (o.enable.error) {
    try {
      installErrorCollector(adapter, queue, o);
    } catch (err) {
      warn('error collector install failed', err);
    }
  }

  if (o.enable.perf) {
    try {
      installPerfCollector(adapter, queue, o);
    } catch (err) {
      warn('perf collector install failed', err);
    }
  }

  if (o.enable.request) {
    try {
      const handle = installRequestCollector(adapter, queue, o);
      scheduler.onPreFlush(() => handle.drainHistogram());
    } catch (err) {
      warn('request collector install failed', err);
    }
  }

  try {
    adapter.onAppHide(() => {
      if (!scheduler) return;
      try {
        const events = scheduler.collectPending();
        if (events.length === 0) return;
        adapter?.setStorageSync('mpm:pending', JSON.stringify(events));
      } catch {
        // storage write failure is not critical
      }
    });

    const pending = adapter.getStorageSync('mpm:pending');
    if (pending) {
      try {
        const events = JSON.parse(pending) as MonitorEvent[];
        for (const e of events) queue.push(e);
        adapter.setStorageSync('mpm:pending', '');
      } catch {
        // corrupted storage, discard
      }
    }
  } catch {
    // lifecycle hooks not available
  }
}

export function record(kind: EventKind, payload: unknown): void {
  if (!queue) return;
  queue.push({ kind, time: now(), payload });
}

export async function flush(): Promise<void> {
  if (scheduler) await scheduler.flush();
}

export function shutdown(): void {
  scheduler?.stop();
  scheduler = null;
  queue = null;
  adapter = null;
}

export type { MonitorOptions, MonitorEvent, EventKind };
