import type { RingQueue } from './queue';
import type { Exporter } from '../exporters/types';
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

  async flush(): Promise<void> {
    for (const hook of this.preFlushHooks) {
      try { hook(); } catch (err) { warn('pre-flush hook failed', err); }
    }
    const events = this.queue.drain();
    if (events.length === 0) return;
    debug('flushing', events.length, 'events');
    try {
      await this.exporter.export(events);
    } catch (err) {
      warn('exporter failed', err);
    }
  }
}
