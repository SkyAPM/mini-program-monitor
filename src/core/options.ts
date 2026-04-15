import type { MonitorOptions } from '../types/options';
import type { Exporter } from '../exporters/types';
import { ConsoleExporter } from '../exporters/console';

export interface ResolvedOptions {
  service: string;
  serviceInstance: string;
  collector: string;
  exporter: Exporter;
  sampleRate: number;
  maxQueue: number;
  flushInterval: number;
  debug: boolean;
}

export function resolveOptions(opts: MonitorOptions): ResolvedOptions {
  if (!opts.service) {
    throw new Error('mini-program-monitor: `service` is required');
  }
  return {
    service: opts.service,
    serviceInstance: opts.serviceInstance ?? autoInstance(),
    collector: opts.collector ?? '',
    exporter: opts.exporter ?? new ConsoleExporter(),
    sampleRate: opts.sampleRate ?? 1,
    maxQueue: opts.maxQueue ?? 200,
    flushInterval: opts.flushInterval ?? 5000,
    debug: opts.debug ?? false,
  };
}

function autoInstance(): string {
  return `mp-${Math.random().toString(36).slice(2, 10)}`;
}
