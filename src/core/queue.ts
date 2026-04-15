import type { MonitorEvent } from '../types/events';

export class RingQueue {
  private buf: MonitorEvent[] = [];

  constructor(private readonly max: number) {}

  push(e: MonitorEvent): void {
    if (this.buf.length >= this.max) {
      this.buf.shift();
    }
    this.buf.push(e);
  }

  drain(): MonitorEvent[] {
    const out = this.buf;
    this.buf = [];
    return out;
  }

  size(): number {
    return this.buf.length;
  }
}
