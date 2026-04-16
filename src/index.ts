import type { MonitorOptions } from './types/options';
import type { MonitorEvent, EventKind } from './types/events';
import type { PlatformAdapter } from './adapters/types';
import { resolveOptions } from './core/options';
import { RingQueue } from './core/queue';
import { Scheduler } from './core/scheduler';
import { buildResource, buildScope } from './core/resource';
import { detectPlatform } from './adapters/detect';
import { installErrorCollector } from './collectors/error';
import { installPerfCollector } from './collectors/perf';
import { OtlpHttpExporter } from './exporters/otlp-http';
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

  const exporter = o.collector
    ? new OtlpHttpExporter({
        collector: o.collector,
        resource: buildResource(o),
        scope: buildScope(),
        adapter,
      })
    : new ConsoleExporter();

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
