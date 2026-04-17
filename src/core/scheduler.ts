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
    try {
      await this.exporter.export(events);
    } catch (err) {
      warn('exporter failed, re-queueing', events.length, 'events', err);
      for (const e of events) this.queue.push(e);
    }
  }
}
