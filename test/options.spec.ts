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
    expect(o.sampleRate).toBe(1);
    expect(o.debug).toBe(false);
    expect(o.serviceInstance).toMatch(/^mp-/);
  });

  it('honors overrides', () => {
    const o = resolveOptions({ service: 'svc', maxQueue: 50, flushInterval: 1000, debug: true });
    expect(o.maxQueue).toBe(50);
    expect(o.flushInterval).toBe(1000);
    expect(o.debug).toBe(true);
  });
});
