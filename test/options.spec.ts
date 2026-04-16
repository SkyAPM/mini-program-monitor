import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../src/core/options';
import type { MonitorOptions } from '../src/types/options';

describe('resolveOptions', () => {
  it('throws when service is missing', () => {
    expect(() => resolveOptions({} as MonitorOptions)).toThrow(/service/);
  });

  it('applies defaults', () => {
    const o = resolveOptions({ service: 'svc' });
    expect(o.maxQueue).toBe(200);
    expect(o.flushInterval).toBe(5000);
    expect(o.debug).toBe(false);
    expect(o.serviceInstance).toMatch(/^mp-/);
    expect(o.platform).toBe('wechat');
    expect(o.enable.error).toBe(true);
    expect(o.enable.perf).toBe(true);
    expect(o.enable.request).toBe(true);
    expect(o.enable.tracing).toBe(false);
  });

  it('honors overrides', () => {
    const o = resolveOptions({
      service: 'svc',
      platform: 'alipay',
      enable: { tracing: true, perf: false },
      maxQueue: 50,
    });
    expect(o.platform).toBe('alipay');
    expect(o.enable.tracing).toBe(true);
    expect(o.enable.perf).toBe(false);
    expect(o.enable.error).toBe(true);
    expect(o.maxQueue).toBe(50);
  });
});
