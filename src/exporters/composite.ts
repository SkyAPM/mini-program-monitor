import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';
import { warn } from '../shared/log';

export class CompositeExporter implements Exporter {
  private readonly exporters: Exporter[];

  constructor(exporters: Exporter[]) {
    this.exporters = exporters;
  }

  async export(events: MonitorEvent[]): Promise<MonitorEvent[]> {
    // Each sub-exporter returns the events IT could not deliver — that
    // includes events it doesn't consume (passthrough) and its own failures.
    // An event is truly failed iff every exporter returned it (none delivered).
    const results = await Promise.all(
      this.exporters.map(async (e): Promise<Set<MonitorEvent>> => {
        try {
          const unexported = await e.export(events);
          return new Set(unexported);
        } catch (err) {
          warn('composite: sub-exporter crashed', err);
          return new Set(events);
        }
      }),
    );
    return events.filter((e) => results.every((r) => r.has(e)));
  }
}
