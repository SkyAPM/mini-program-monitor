import { describe, it, expect, vi } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installErrorCollector } from '../../src/collectors/error';
import { resolveOptions } from '../../src/core/options';
import type { PlatformAdapter } from '../../src/adapters/types';
import type { OtlpLogRecord } from '../../src/types/otlp';

let onErrorCb: ((msg: string) => void) | undefined;
let onRejectionCb: ((r: { reason: unknown }) => void) | undefined;

function createFakeAlipayAdapter(): PlatformAdapter {
  onErrorCb = undefined;
  onRejectionCb = undefined;
  return {
    name: 'alipay',
    componentId: 10003,
    request: vi.fn(),
    onError: (cb) => { onErrorCb = cb; return () => {}; },
    onUnhandledRejection: (cb) => { onRejectionCb = cb; return () => {}; },
    // no onPageNotFound on Alipay
    onAppShow: vi.fn(() => () => {}),
    onAppHide: vi.fn(() => () => {}),
    hasPerformanceObserver: false,
    getSystemInfoSync: () => ({ brand: '', model: '', SDKVersion: '', platform: '', system: '' }),
    setStorageSync: vi.fn(),
    interceptRequest: vi.fn(() => () => {}),
    getStorageSync: () => '',
  };
}

describe('error collector — Alipay adapter', () => {
  it('handles errors via alipay adapter (no pageNotFound)', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installErrorCollector(adapter, q, opts);

    onErrorCb!('Error: something failed\n  at page.js:10');
    const events = q.drain();
    expect(events).toHaveLength(1);
    const log = events[0].payload as OtlpLogRecord;
    expect(log.body.stringValue).toBe('Error: something failed');
  });

  it('handles promise rejections via alipay adapter', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    installErrorCollector(adapter, q, opts);

    onRejectionCb!({ reason: 'timeout' });
    const log = q.drain()[0].payload as OtlpLogRecord;
    expect(log.body.stringValue).toBe('timeout');
    const attrs = log.attributes!.reduce((m, a) => {
      m[a.key] = a.value.stringValue;
      return m;
    }, {} as Record<string, string | undefined>);
    expect(attrs['exception.type']).toBe('promise');
  });

  it('does not crash when adapter has no onPageNotFound', () => {
    const q = new RingQueue(10);
    const adapter = createFakeAlipayAdapter();
    const opts = resolveOptions({ service: 'svc', platform: 'alipay' });
    expect(() => installErrorCollector(adapter, q, opts)).not.toThrow();
  });
});
