import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installPerfCollector } from '../../src/collectors/perf';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { OtlpMetric } from '../../src/types/otlp';

type ObserverCallback = (entryList: { getEntries: () => unknown[] }) => void;

let observerCb: ObserverCallback | undefined;
let observedTypes: string[] | undefined;

beforeEach(() => {
  observerCb = undefined;
  observedTypes = undefined;
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.getPerformance = vi.fn(() => ({
    createObserver: (cb: ObserverCallback) => {
      observerCb = cb;
      return {
        observe: (opts: { entryTypes: string[] }) => { observedTypes = opts.entryTypes; },
        disconnect: () => {},
      };
    },
    getEntries: () => [],
  }));
});

function setup() {
  const q = new RingQueue(10);
  const opts = resolveOptions({ service: 'svc', serviceVersion: 'v1' });
  const adapter = createWechatAdapter();
  installPerfCollector(adapter, q, opts);
  return q;
}

describe('perf collector', () => {
  it('observes navigation, render, script, loadPackage entry types', () => {
    setup();
    expect(observedTypes).toEqual(['navigation', 'render', 'script', 'loadPackage']);
  });

  it('emits miniprogram.app_launch.duration metric for appLaunch entry', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 1200 },
      ],
    });
    const events = q.drain();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('metric');
    const metrics = events[0].payload as OtlpMetric[];
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('miniprogram.app_launch.duration');
    expect(metrics[0].gauge!.dataPoints[0].asInt).toBe('1200');
  });

  it('emits miniprogram.first_render.duration for firstRender entry', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'firstRender', entryType: 'render', startTime: 100, duration: 300 },
      ],
    });
    const metrics = q.drain()[0].payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.first_render.duration');
    expect(metrics[0].gauge!.dataPoints[0].asInt).toBe('300');
  });

  it('emits miniprogram.first_paint.time for firstPaint entry', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'firstPaint', entryType: 'render', startTime: 250, duration: 0 },
      ],
    });
    const metrics = q.drain()[0].payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.first_paint.time');
    expect(metrics[0].gauge!.dataPoints[0].asInt).toBe('250');
  });

  it('emits miniprogram.route.duration for route entry with page path', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'route', entryType: 'navigation', startTime: 500, duration: 80, path: 'pages/detail/detail' },
      ],
    });
    const metrics = q.drain()[0].payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.route.duration');
    const pageAttr = metrics[0].gauge!.dataPoints[0].attributes!.find(
      (a) => a.key === 'miniprogram.page.path',
    );
    expect(pageAttr?.value.stringValue).toBe('pages/detail/detail');
  });

  it('combines multiple entries into a single metric event', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 1000 },
        { name: 'firstRender', entryType: 'render', startTime: 200, duration: 400 },
        { name: 'firstPaint', entryType: 'render', startTime: 300, duration: 0 },
      ],
    });
    const events = q.drain();
    expect(events).toHaveLength(1);
    const metrics = events[0].payload as OtlpMetric[];
    expect(metrics).toHaveLength(3);
    expect(metrics.map((m) => m.name)).toEqual([
      'miniprogram.app_launch.duration',
      'miniprogram.first_render.duration',
      'miniprogram.first_paint.time',
    ]);
  });

  it('produces no event for empty entry list', () => {
    const q = setup();
    observerCb!({ getEntries: () => [] });
    expect(q.size()).toBe(0);
  });

  it('never throws when observer receives garbage', () => {
    setup();
    expect(() => observerCb!({ getEntries: () => [undefined as unknown] })).not.toThrow();
  });
});
