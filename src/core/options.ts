import type { MonitorOptions } from '../types/options';
import type { Exporter } from '../exporters/types';
import { ConsoleExporter } from '../exporters/console';
import { SkyWalkingExporter } from '../exporters/skywalking';

export interface ResolvedOptions {
  service: string;
  serviceVersion: string;
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
  const collector = opts.collector ?? '';
  const exporter =
    opts.exporter ?? (collector ? new SkyWalkingExporter({ collector }) : new ConsoleExporter());
  return {
    service: opts.service,
    serviceVersion: opts.serviceVersion ?? 'v0.0.0',
    serviceInstance: opts.serviceInstance ?? autoInstance(),
    collector,
    exporter,
    sampleRate: opts.sampleRate ?? 1,
    maxQueue: opts.maxQueue ?? 200,
    flushInterval: opts.flushInterval ?? 5000,
    debug: opts.debug ?? false,
  };
}

function autoInstance(): string {
  return `mp-${Math.random().toString(36).slice(2, 10)}`;
}
