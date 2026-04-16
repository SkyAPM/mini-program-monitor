import type { MonitorOptions } from './types/options';
import type { MonitorEvent, EventKind } from './types/events';
import { resolveOptions } from './core/options';
import { RingQueue } from './core/queue';
import { Scheduler } from './core/scheduler';
import { installErrorCollector } from './collectors/error';
import { installPerfCollector } from './collectors/perf';
import { setDebug, warn } from './shared/log';
import { now } from './shared/time';

let queue: RingQueue | null = null;
let scheduler: Scheduler | null = null;

export function init(opts: MonitorOptions): void {
  const o = resolveOptions(opts);
  setDebug(o.debug);
  queue = new RingQueue(o.maxQueue);
  scheduler = new Scheduler(queue, o.exporter, o.flushInterval);
  scheduler.start();
  try {
    installErrorCollector(queue, o);
  } catch (err) {
    warn('error collector install failed', err);
  }
  try {
    installPerfCollector(queue, o);
  } catch (err) {
    warn('perf collector install failed', err);
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
}

export type { MonitorOptions, MonitorEvent, EventKind };
