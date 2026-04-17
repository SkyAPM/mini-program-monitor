import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installRequestCollector, type RequestCollectorHandle } from '../../src/collectors/request';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { OtlpMetric, OtlpLogRecord } from '../../src/types/otlp';

let originalRequestMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalRequestMock = vi.fn();
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.request = originalRequestMock;
});

function setup(overrides?: { collector?: string; urlGroupRules?: Record<string, RegExp> }): {
  q: RingQueue;
  handle: RequestCollectorHandle;
} {
  const q = new RingQueue(20);
  const opts = resolveOptions({
    service: 'svc',
    collector: overrides?.collector ?? 'http://oap:4318',
    request: overrides?.urlGroupRules ? { urlGroupRules: overrides.urlGroupRules } : undefined,
  });
  const adapter = createWechatAdapter();
  const handle = installRequestCollector(adapter, q, opts);
  return { q, handle };
}

function callWxRequest(url: string, method: string, statusCode: number) {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => void } }).wx;
  wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.success({ statusCode, data: {}, header: {} });
}

function callWxRequestFail(url: string, method: string) {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => void } }).wx;
  wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.fail({ errMsg: 'timeout' });
}

describe('request collector', () => {
  it('aggregates request durations into histogram on drain', () => {
    const { q, handle } = setup();
    callWxRequest('https://api.example.com/a', 'GET', 200);
    callWxRequest('https://api.example.com/b', 'GET', 200);
    expect(q.drain().filter((e) => e.kind === 'metric')).toHaveLength(0);

    handle.drainHistogram();
    const events = q.drain();
    const metricEvent = events.find((e) => e.kind === 'metric');
    expect(metricEvent).toBeDefined();
    const metrics = metricEvent!.payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.request.duration');
    expect(metrics[0].histogram).toBeDefined();
    expect(metrics[0].histogram!.dataPoints[0].count).toBe('2');
  });

  it('emits ajax error log for 4xx/5xx responses', () => {
    const { q } = setup();
    callWxRequest('https://api.example.com/fail', 'POST', 500);
    const logEvent = q.drain().find((e) => e.kind === 'log');
    expect(logEvent).toBeDefined();
    const log = logEvent!.payload as OtlpLogRecord;
    expect(log.severityNumber).toBe(17);
    expect(log.body.stringValue).toContain('500');
    expect(log.attributes!.find((a) => a.key === 'exception.type')?.value.stringValue).toBe('ajax');
  });

  it('emits error log and records histogram on request failure', () => {
    const { q, handle } = setup();
    callWxRequestFail('https://api.example.com/timeout', 'POST');
    expect(q.drain().filter((e) => e.kind === 'log')).toHaveLength(1);

    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric')!.payload as OtlpMetric[];
    expect(metric[0].histogram!.dataPoints[0].count).toBe('1');
  });

  it('skips instrumentation for collector URL (loop prevention)', () => {
    const { q, handle } = setup({ collector: 'http://oap:4318' });
    callWxRequest('http://oap:4318/v1/metrics', 'POST', 200);
    handle.drainHistogram();
    expect(q.size()).toBe(0);
  });

  it('includes url.path.group label when URL matches a rule', () => {
    const { q, handle } = setup({ urlGroupRules: { '/api/users/*': /\/api\/users\/\d+/ } });
    callWxRequest('https://api.example.com/api/users/12345', 'GET', 200);
    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric')!.payload as OtlpMetric[];
    const attrs = metric[0].histogram!.dataPoints[0].attributes!;
    expect(attrs.find((a) => a.key === 'url.path.group')?.value.stringValue).toBe('/api/users/*');
  });

  it('does not emit error log for 2xx responses', () => {
    const { q } = setup();
    callWxRequest('https://api.example.com/ok', 'GET', 201);
    expect(q.drain().filter((e) => e.kind === 'log')).toHaveLength(0);
  });

  it('drainHistogram pushes nothing when no requests seen', () => {
    const { q, handle } = setup();
    handle.drainHistogram();
    expect(q.size()).toBe(0);
  });

  it('drainHistogram resets state so next drain is empty', () => {
    const { q, handle } = setup();
    callWxRequest('https://api.example.com/a', 'GET', 200);
    handle.drainHistogram();
    q.drain();
    handle.drainHistogram();
    expect(q.size()).toBe(0);
  });
});
