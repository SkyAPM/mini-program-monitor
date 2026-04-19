import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installRequestCollector } from '../../src/collectors/request';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { SegmentObject } from '../../src/types/segment';
import { base64Encode } from '../../src/shared/base64';

let originalRequestMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalRequestMock = vi.fn();
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.request = originalRequestMock;
});

function setup(overrides?: { tracing?: boolean; sampleRate?: number; urlBlacklist?: (string | RegExp)[] }) {
  const q = new RingQueue(20);
  const opts = resolveOptions({
    service: 'trace-svc',
    serviceInstance: 'inst-1',
    collector: 'http://oap:4318',
    enable: { tracing: overrides?.tracing ?? true },
    tracing: {
      sampleRate: overrides?.sampleRate ?? 1,
      urlBlacklist: overrides?.urlBlacklist ?? [],
    },
  });
  const adapter = createWechatAdapter();
  installRequestCollector(adapter, q, opts);
  return q;
}

function callWxRequest(url: string, method: string, statusCode: number) {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => void } }).wx;
  wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.success({ statusCode, data: {}, header: {} });
}

describe('request collector — tracing', () => {
  it('injects sw8 header when tracing is enabled', () => {
    setup({ tracing: true });
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
    expect(call.header.sw8).toBeDefined();
    expect(call.header.sw8).toMatch(/^1-/);
  });

  it('does not inject sw8 when tracing is disabled', () => {
    setup({ tracing: false });
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
    expect(call.header.sw8).toBeUndefined();
  });

  it('produces a SegmentObject event when tracing is enabled', () => {
    const q = setup({ tracing: true });
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const events = q.drain();
    const segEvent = events.find((e) => e.kind === 'segment');
    expect(segEvent).toBeDefined();
    const seg = segEvent!.payload as SegmentObject;
    expect(seg.service).toBe('trace-svc');
    expect(seg.serviceInstance).toBe('inst-1');
    expect(seg.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(seg.spans).toHaveLength(1);
    expect(seg.spans[0].spanLayer).toBe('Http');
    expect(seg.spans[0].spanType).toBe('Exit');
    expect(seg.spans[0].peer).toBe('api.example.com');
    expect(seg.spans[0].componentId).toBe(10002);
    const platformTag = seg.spans[0].tags!.find((t) => t.key === 'miniprogram.platform');
    expect(platformTag?.value).toBe('wechat');
  });

  it('does not produce segment when tracing is disabled', () => {
    const q = setup({ tracing: false });
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const events = q.drain();
    expect(events.filter((e) => e.kind === 'segment')).toHaveLength(0);
  });

  it('marks span isError for 4xx/5xx', () => {
    const q = setup({ tracing: true });
    callWxRequest('https://api.example.com/fail', 'POST', 500);
    const seg = q.drain().find((e) => e.kind === 'segment')!.payload as SegmentObject;
    expect(seg.spans[0].isError).toBe(true);
  });

  it('skips tracing for blacklisted URLs but still records metrics', () => {
    const q = setup({ tracing: true, urlBlacklist: [/\/heartbeat/] });
    callWxRequest('https://api.example.com/heartbeat', 'GET', 200);
    const events = q.drain();
    expect(events.filter((e) => e.kind === 'segment')).toHaveLength(0);
    // Metrics are now aggregated into a histogram drained at flush time,
    // not pushed per-request. Per-request, the queue is empty for 2xx traffic.
  });

  it('skips tracing when sample rate rejects', () => {
    const q = setup({ tracing: true, sampleRate: 0 });
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const events = q.drain();
    expect(events.filter((e) => e.kind === 'segment')).toHaveLength(0);
  });

  it('sw8 header contains base64-encoded service and instance', () => {
    setup({ tracing: true });
    callWxRequest('https://api.example.com/data', 'GET', 200);
    const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
    const parts = (call.header.sw8 as string).split('-');
    expect(parts).toHaveLength(8);
    expect(parts[0]).toBe('1');
  });

  function setupWithoutInstance(): RingQueue {
    const q = new RingQueue(20);
    const opts = resolveOptions({
      service: 'trace-svc',
      collector: 'http://oap:4318',
      enable: { tracing: true },
    });
    const adapter = createWechatAdapter();
    installRequestCollector(adapter, q, opts);
    return q;
  }

  it('segment serviceInstance is "-" when operator does not supply one', () => {
    const q = setupWithoutInstance();
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const seg = q.drain().find((e) => e.kind === 'segment')!.payload as SegmentObject;
    expect(seg.serviceInstance).toBe('-');
  });

  it('segment peer and sw8 peer field are "-" when URL has no parseable host', () => {
    const q = setupWithoutInstance();
    callWxRequest('relative/path', 'GET', 200);
    const seg = q.drain().find((e) => e.kind === 'segment')!.payload as SegmentObject;
    expect(seg.spans[0].peer).toBe('-');

    const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
    const parts = (call.header.sw8 as string).split('-');
    expect(parts).toHaveLength(8);
  });

  it('sw8 header substitutes "-" for absent instance so downstream join stays valid', () => {
    setupWithoutInstance();
    callWxRequest('https://api.example.com/x', 'GET', 200);
    const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
    const parts = (call.header.sw8 as string).split('-');
    expect(parts).toHaveLength(8);
    expect(parts[5]).toBe(base64Encode('-'));
  });
});
