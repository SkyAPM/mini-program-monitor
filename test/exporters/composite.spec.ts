import { describe, it, expect, vi } from 'vitest';
import { CompositeExporter } from '../../src/exporters/composite';
import type { Exporter } from '../../src/exporters/types';
import type { MonitorEvent } from '../../src/types/events';

const logEvent: MonitorEvent = { kind: 'log', time: 1, payload: 'log' };
const metricEvent: MonitorEvent = { kind: 'metric', time: 2, payload: [] };
const segmentEvent: MonitorEvent = { kind: 'segment', time: 3, payload: {} };

function exporterFor(consumes: MonitorEvent['kind'][], fail = false): Exporter {
  return {
    export: vi.fn((events: MonitorEvent[]) => {
      if (fail) return events.slice();
      return events.filter((e) => !consumes.includes(e.kind));
    }),
  };
}

describe('CompositeExporter', () => {
  it('returns no failures when each sub-exporter succeeds on its own kind', async () => {
    const otlp = exporterFor(['log', 'metric']);
    const sw = exporterFor(['segment']);
    const composite = new CompositeExporter([otlp, sw]);
    const failed = await composite.export([logEvent, metricEvent, segmentEvent]);
    expect(failed).toEqual([]);
  });

  it('re-queues only events the failing sub-exporter was responsible for', async () => {
    const otlp = exporterFor(['log', 'metric']);          // succeeds
    const sw = exporterFor(['segment'], true);            // fails — returns all input
    const composite = new CompositeExporter([otlp, sw]);
    const failed = await composite.export([logEvent, metricEvent, segmentEvent]);
    // otlp didn't consume segment → returns [segment]. sw failed → returns everything.
    // Intersection = [segment] only.
    expect(failed).toEqual([segmentEvent]);
  });

  it('treats a crashed sub-exporter as returning all input', async () => {
    const otlp: Exporter = { export: vi.fn(() => { throw new Error('boom'); }) };
    const sw = exporterFor(['segment']);                  // succeeds, returns non-segments
    const composite = new CompositeExporter([otlp, sw]);
    const failed = await composite.export([logEvent, segmentEvent]);
    // otlp crashed → treated as returning all. sw returns [log] (non-segment).
    // Intersection = [log] → only logEvent re-queued.
    expect(failed).toEqual([logEvent]);
  });

  it('re-queues everything when all sub-exporters fail', async () => {
    const otlp = exporterFor(['log', 'metric'], true);
    const sw = exporterFor(['segment'], true);
    const composite = new CompositeExporter([otlp, sw]);
    const failed = await composite.export([logEvent, metricEvent, segmentEvent]);
    expect(failed).toEqual([logEvent, metricEvent, segmentEvent]);
  });
});
