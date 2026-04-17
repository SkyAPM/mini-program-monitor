export type EventKind = 'log' | 'metric' | 'segment';

export interface MonitorEvent {
  kind: EventKind;
  time: number;
  payload: unknown;
}
