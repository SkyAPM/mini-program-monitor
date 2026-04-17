import type { MonitorEvent } from '../types/events';

export interface Exporter {
  // Returns the events that were NOT successfully exported.
  // Empty array means everything went through. Scheduler re-queues the return.
  export(events: MonitorEvent[]): Promise<MonitorEvent[]> | MonitorEvent[];
}
