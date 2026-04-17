import type { RingQueue } from './queue';
import type { Exporter } from '../exporters/types';
import type { MonitorEvent } from '../types/events';
import { debug, warn } from '../shared/log';

export type PreFlushHook = () => void;

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly preFlushHooks: PreFlushHook[] = [];

  constructor(
    private readonly queue: RingQueue,
    private readonly exporter: Exporter,
    private readonly intervalMs: number,
  ) {}

  onPreFlush(hook: PreFlushHook): void {
    this.preFlushHooks.push(hook);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  collectPending(): MonitorEvent[] {
    for (const hook of this.preFlushHooks) {
      try { hook(); } catch (err) { warn('pre-flush hook failed', err); }
    }
    return this.queue.drain();
  }

  async flush(): Promise<void> {
    const events = this.collectPending();
    if (events.length === 0) return;
    debug('flushing', events.length, 'events');
    let failed: MonitorEvent[];
    try {
      failed = await this.exporter.export(events);
    } catch (err) {
      warn('exporter crashed, re-queueing', events.length, 'events', err);
      failed = events;
    }
    if (failed.length > 0) {
      if (failed.length < events.length) {
        debug('exporter partial failure, re-queueing', failed.length, 'of', events.length);
      } else {
        warn('exporter failed to deliver any of', events.length, 'events — re-queueing');
      }
      for (const e of failed) this.queue.push(e);
    }
  }
}
