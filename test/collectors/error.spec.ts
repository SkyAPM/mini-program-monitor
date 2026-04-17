import { describe, it, expect, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installErrorCollector } from '../../src/collectors/error';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { OtlpLogRecord } from '../../src/types/otlp';

type WxErrorCb = (msg: string) => void;
type WxRejectionCb = (r: { reason: unknown }) => void;
type WxPageNotFoundCb = (r: { path: string }) => void;

let onErrorCb: WxErrorCb | undefined;
let onRejectionCb: WxRejectionCb | undefined;
let onPageNotFoundCb: WxPageNotFoundCb | undefined;

beforeEach(() => {
  onErrorCb = undefined;
  onRejectionCb = undefined;
  onPageNotFoundCb = undefined;
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.onError = (cb: WxErrorCb) => { onErrorCb = cb; };
  wxAny.onUnhandledRejection = (cb: WxRejectionCb) => { onRejectionCb = cb; };
  wxAny.onPageNotFound = (cb: WxPageNotFoundCb) => { onPageNotFoundCb = cb; };
});

function setup() {
  const q = new RingQueue(10);
  const opts = resolveOptions({ service: 'svc', serviceVersion: 'v1' });
  const adapter = createWechatAdapter();
  installErrorCollector(adapter, q, opts);
  return q;
}

describe('error collector', () => {
  it('emits OTLP LogRecord with exception.type=js for wx.onError', () => {
    const q = setup();
    onErrorCb!('TypeError: x is undefined\n    at pages/index/index.js:10:5');
    const events = q.drain();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('log');
    const log = events[0].payload as OtlpLogRecord;
    expect(log.severityNumber).toBe(17);
    expect(log.severityText).toBe('ERROR');
    expect(log.body.stringValue).toBe('TypeError: x is undefined');
    const attrs = log.attributes!.reduce((m, a) => { m[a.key] = a.value.stringValue; return m; }, {} as Record<string, string | undefined>);
    expect(attrs['exception.type']).toBe('js');
    expect(attrs['exception.stacktrace']).toBe('    at pages/index/index.js:10:5');
    expect(attrs['miniprogram.page.path']).toBe('pages/index/index');
  });

  it('unwraps WeChat MiniProgramError wrapper to get real message', () => {
    const q = setup();
    onErrorCb!('MiniProgramError\nError: demo: synchronous throw\n    at pages/index/index.js:7:11');
    const log = q.drain()[0].payload as OtlpLogRecord;
    expect(log.body.stringValue).toBe('demo: synchronous throw');
    const attrs = log.attributes!.reduce((m, a) => { m[a.key] = a.value.stringValue; return m; }, {} as Record<string, string | undefined>);
    expect(attrs['exception.stacktrace']).toBe('    at pages/index/index.js:7:11');
  });

  it('emits exception.type=promise for onUnhandledRejection', () => {
    const q = setup();
    onRejectionCb!({ reason: new Error('network down') });
    const log = q.drain()[0].payload as OtlpLogRecord;
    const attrs = log.attributes!.reduce((m, a) => { m[a.key] = a.value.stringValue; return m; }, {} as Record<string, string | undefined>);
    expect(attrs['exception.type']).toBe('promise');
    expect(log.body.stringValue).toBe('network down');
  });

  it('emits exception.type=pageNotFound for onPageNotFound', () => {
    const q = setup();
    onPageNotFoundCb!({ path: 'pages/missing/missing' });
    const log = q.drain()[0].payload as OtlpLogRecord;
    const attrs = log.attributes!.reduce((m, a) => { m[a.key] = a.value.stringValue; return m; }, {} as Record<string, string | undefined>);
    expect(attrs['exception.type']).toBe('pageNotFound');
    expect(log.body.stringValue).toContain('page not found');
  });

  it('never throws when callbacks receive garbage input', () => {
    setup();
    expect(() => onErrorCb!(undefined as unknown as string)).not.toThrow();
    expect(() => onRejectionCb!(undefined as unknown as { reason: unknown })).not.toThrow();
    expect(() => onPageNotFoundCb!(undefined as unknown as { path: string })).not.toThrow();
  });
});
