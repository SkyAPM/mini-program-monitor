import { describe, it, expect, vi } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installPerfCollector } from '../../src/collectors/perf';
import { resolveOptions } from '../../src/core/options';
import type { PlatformAdapter, LifecycleHook } from '../../src/adapters/types';
import type { OtlpMetric } from '../../src/types/otlp';

let appHooks: Record<string, LifecycleHook>;
let pageHooks: Record<string, LifecycleHook>;

function createFakeAlipayAdapter(): PlatformAdapter {
  appHooks = {};
  pageHooks = {};
  return {
    name: 'alipay',
    request: vi.fn(),
    onError: vi.fn(() => () => {}),
    onUnhandledRejection: vi.fn(() => () => {}),
    onAppShow: vi.fn(() => () => {}),
    onAppHide: vi.fn(() => () => {}),
    hasPerformanceObserver: false,
    wrapApp(hooks) {
      for (const [k, v] of Object.entries(hooks)) {
        if (v) appHooks[k] = v;
      }
      return () => {};
    },
    wrapPage(hooks) {
      for (const [k, v] of Object.entries(hooks)) {
        if (v) pageHooks[k] = v;
      }
      return () => {};
    },
    interceptRequest: vi.fn(() => () => {}),
    getSystemInfoSync: () => ({ brand: '', model: '', SDKVersion: '', platform: '', system: '' }),
    setStorageSync: vi.fn(),
    getStorageSync: () => '',
  };
}

describe('perf collector — lifecycle fallback (Alipay)', () => {
  it('emits miniprogram.app_launch.duration from onLaunch→onShow', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    const startTime = Date.now();
    appHooks.onLaunch!();
    // simulate 100ms delay
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 100);
    appHooks.onShow!();
    vi.restoreAllMocks();

    const events = q.drain();
    expect(events).toHaveLength(1);
    const metrics = events[0].payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.app_launch.duration');
    expect(Number(metrics[0].gauge!.dataPoints[0].asInt)).toBeGreaterThanOrEqual(0);
  });

  it('emits miniprogram.first_render.duration from onLoad→onReady', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    // Consume the app_launch fallback so onReady only emits first_render.
    appHooks.onLaunch!();
    appHooks.onShow!();
    q.drain();

    const startTime = Date.now();
    pageHooks.onLoad!();
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 200);
    pageHooks.onReady!();
    vi.restoreAllMocks();

    const events = q.drain();
    expect(events).toHaveLength(1);
    const metrics = events[0].payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.first_render.duration');
  });

  it('emits app_launch fallback on first page.onReady when App.onLaunch never fired (init inside App.onLaunch)', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    // Simulate init() running *inside* App.onLaunch: wrapApp hooks are
    // installed but never invoked because App() already ran.
    pageHooks.onLoad!();
    pageHooks.onReady!();

    const events = q.drain();
    const names = events.flatMap((e) => (e.payload as OtlpMetric[]).map((m) => m.name));
    expect(names).toContain('miniprogram.first_render.duration');
    expect(names).toContain('miniprogram.app_launch.duration');
  });

  it('does not duplicate app_launch fallback across subsequent page.onReady calls', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    pageHooks.onLoad!();
    pageHooks.onReady!();
    q.drain();

    pageHooks.onLoad!();
    pageHooks.onReady!();
    const names = q.drain().flatMap((e) => (e.payload as OtlpMetric[]).map((m) => m.name));
    expect(names).toContain('miniprogram.first_render.duration');
    expect(names).not.toContain('miniprogram.app_launch.duration');
  });

  it('does not emit app_launch on second onShow (only first)', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    appHooks.onLaunch!();
    appHooks.onShow!();
    q.drain();

    appHooks.onShow!();
    expect(q.size()).toBe(0);
  });

  it('cleans up page timing on onHide (no first_render emitted)', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, q, opts);

    // Consume the app_launch fallback first.
    appHooks.onLaunch!();
    appHooks.onShow!();
    q.drain();

    pageHooks.onLoad!();
    pageHooks.onHide!();
    pageHooks.onReady!();
    expect(q.size()).toBe(0);
  });

  it('registers both wrapApp and wrapPage hooks', () => {
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installPerfCollector(adapter, new RingQueue(10), opts);

    expect(appHooks.onLaunch).toBeTypeOf('function');
    expect(appHooks.onShow).toBeTypeOf('function');
    expect(pageHooks.onLoad).toBeTypeOf('function');
    expect(pageHooks.onReady).toBeTypeOf('function');
  });
});
