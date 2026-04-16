import type { Exporter } from './types';
import type { MonitorEvent } from '../types/events';

export class CompositeExporter implements Exporter {
  private readonly exporters: Exporter[];

  constructor(exporters: Exporter[]) {
    this.exporters = exporters;
  }

  async export(events: MonitorEvent[]): Promise<void> {
    await Promise.all(this.exporters.map((e) => e.export(events)));
  }
}
