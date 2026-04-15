import type { MonitorEvent } from '../types/events';

export interface Exporter {
  export(events: MonitorEvent[]): Promise<void> | void;
}
