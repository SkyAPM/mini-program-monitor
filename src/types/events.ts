export type EventKind = 'error' | 'perf' | 'segment' | 'log';

export interface MonitorEvent {
  kind: EventKind;
  time: number;
  payload: unknown;
}
