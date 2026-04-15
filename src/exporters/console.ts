import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';

export class ConsoleExporter implements Exporter {
  export(events: MonitorEvent[]): void {
    for (const e of events) {
      console.log(`[mpm:${e.kind}]`, e.payload);
    }
  }
}
