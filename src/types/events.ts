export type EventKind = 'error' | 'perf' | 'metric' | 'log' | 'segment';

export interface MonitorEvent {
  kind: EventKind;
  time: number;
  payload: unknown;
}
