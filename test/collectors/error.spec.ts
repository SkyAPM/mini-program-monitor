import { describe, it, expect, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installErrorCollector } from '../../src/collectors/error';
import { resolveOptions } from '../../src/core/options';
import type { BrowserErrorLog } from '../../src/vendor/skywalking/protocol';

type WxErrorCb = (msg: string) => void;
type WxRejectionCb = (r: { reason: unknown; promise?: unknown }) => void;
type WxPageNotFoundCb = (r: { path: string }) => void;

let onErrorCb: WxErrorCb | undefined;
let onRejectionCb: WxRejectionCb | undefined;
let onPageNotFoundCb: WxPageNotFoundCb | undefined;

beforeEach(() => {
  onErrorCb = undefined;
  onRejectionCb = undefined;
  onPageNotFoundCb = undefined;
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.onError = (cb: WxErrorCb) => {
    onErrorCb = cb;
  };
  wxAny.onUnhandledRejection = (cb: WxRejectionCb) => {
    onRejectionCb = cb;
  };
  wxAny.onPageNotFound = (cb: WxPageNotFoundCb) => {
    onPageNotFoundCb = cb;
  };
  (globalThis as unknown as { getCurrentPages: () => unknown[] }).getCurrentPages = () => [
    { route: 'pages/index/index' },
  ];
});

function setup() {
  const q = new RingQueue(10);
  const opts = resolveOptions({ service: 'svc', serviceVersion: 'v1' });
  installErrorCollector(q, opts);
  return q;
}

describe('error collector', () => {
  it('normalizes wx.onError into a js-category BrowserErrorLog', () => {
    const q = setup();
    onErrorCb!('TypeError: x is undefined\n    at pages/index/index.js:10:5');
    const events = q.drain();
    expect(events).toHaveLength(1);
    const log = events[0].payload as BrowserErrorLog;
    expect(log.category).toBe('js');
    expect(log.grade).toBe('Error');
    expect(log.message).toBe('TypeError: x is undefined');
    expect(log.stack).toBe('    at pages/index/index.js:10:5');
    expect(log.service).toBe('svc');
    expect(log.serviceVersion).toBe('v1');
    expect(log.pagePath).toBe('pages/index/index');
    expect(log.uniqueId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('normalizes onUnhandledRejection with an Error reason', () => {
    const q = setup();
    onRejectionCb!({ reason: new Error('network down') });
    const log = q.drain()[0].payload as BrowserErrorLog;
    expect(log.category).toBe('promise');
    expect(log.grade).toBe('Error');
    expect(log.message).toBe('network down');
    expect(log.stack).toMatch(/Error: network down/);
  });

  it('normalizes onUnhandledRejection with a non-Error reason', () => {
    const q = setup();
    onRejectionCb!({ reason: 'string reason' });
    const log = q.drain()[0].payload as BrowserErrorLog;
    expect(log.category).toBe('promise');
    expect(log.message).toBe('string reason');
  });

  it('normalizes onPageNotFound into category=unknown', () => {
    const q = setup();
    onPageNotFoundCb!({ path: 'pages/missing/missing' });
    const log = q.drain()[0].payload as BrowserErrorLog;
    expect(log.category).toBe('unknown');
    expect(log.message).toContain('page not found');
    expect(log.pagePath).toBe('pages/missing/missing');
  });

  it('never throws when callbacks receive garbage input', () => {
    const q = setup();
    expect(() => onErrorCb!(undefined as unknown as string)).not.toThrow();
    expect(() => onRejectionCb!(undefined as unknown as { reason: unknown })).not.toThrow();
    expect(() => onPageNotFoundCb!(undefined as unknown as { path: string })).not.toThrow();
    expect(q.size()).toBeGreaterThan(0);
  });
});
