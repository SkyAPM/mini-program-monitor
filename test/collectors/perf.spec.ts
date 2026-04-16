import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installPerfCollector } from '../../src/collectors/perf';
import { resolveOptions } from '../../src/core/options';
import type { BrowserPerfData } from '../../src/vendor/skywalking/protocol';

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
        observe: (opts: { entryTypes: string[] }) => {
          observedTypes = opts.entryTypes;
        },
        disconnect: () => {},
      };
    },
    getEntries: () => [],
  }));
  (globalThis as unknown as { getCurrentPages: () => unknown[] }).getCurrentPages = () => [
    { route: 'pages/index/index' },
  ];
});

function setup() {
  const q = new RingQueue(10);
  const opts = resolveOptions({ service: 'svc', serviceVersion: 'v1' });
  installPerfCollector(q, opts);
  return q;
}

describe('perf collector', () => {
  it('observes navigation, render, script, loadPackage entry types', () => {
    setup();
    expect(observedTypes).toEqual(['navigation', 'render', 'script', 'loadPackage']);
  });

  it('maps appLaunch entry to loadPageTime', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 1200 },
      ],
    });
    const events = q.drain();
    expect(events).toHaveLength(1);
    const perf = events[0].payload as BrowserPerfData;
    expect(perf.service).toBe('svc');
    expect(perf.loadPageTime).toBe(1200);
  });

  it('maps firstRender to fptTime and domReadyTime', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'firstRender', entryType: 'render', startTime: 100, duration: 300 },
      ],
    });
    const perf = q.drain()[0].payload as BrowserPerfData;
    expect(perf.fptTime).toBe(300);
    expect(perf.domReadyTime).toBe(400);
  });

  it('maps firstPaint startTime to fmpTime', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'firstPaint', entryType: 'render', startTime: 250, duration: 0 },
      ],
    });
    const perf = q.drain()[0].payload as BrowserPerfData;
    expect(perf.fmpTime).toBe(250);
  });

  it('maps route entry to redirectTime', () => {
    const q = setup();
    observerCb!({
      getEntries: () => [
        { name: 'route', entryType: 'navigation', startTime: 500, duration: 80, path: 'pages/detail/detail' },
      ],
    });
    const perf = q.drain()[0].payload as BrowserPerfData;
    expect(perf.redirectTime).toBe(80);
    expect(perf.pagePath).toBe('pages/detail/detail');
  });

  it('combines multiple entries in a single observer batch', () => {
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
    const perf = events[0].payload as BrowserPerfData;
    expect(perf.loadPageTime).toBe(1000);
    expect(perf.fptTime).toBe(400);
    expect(perf.fmpTime).toBe(300);
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
