import type { Exporter } from '../exporters/types';

export interface MonitorOptions {
  service: string;
  serviceInstance?: string;
  collector?: string;
  exporter?: Exporter;
  sampleRate?: number;
  maxQueue?: number;
  flushInterval?: number;
  debug?: boolean;
}
