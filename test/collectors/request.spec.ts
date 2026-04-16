import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installRequestCollector } from '../../src/collectors/request';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { OtlpMetric, OtlpLogRecord } from '../../src/types/otlp';

let originalRequestMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalRequestMock = vi.fn();
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.request = originalRequestMock;
});

function setup(overrides?: { collector?: string; urlGroupRules?: Record<string, RegExp> }) {
  const q = new RingQueue(20);
  const opts = resolveOptions({
    service: 'svc',
    collector: overrides?.collector ?? 'http://oap:4318',
    request: overrides?.urlGroupRules ? { urlGroupRules: overrides.urlGroupRules } : undefined,
  });
  const adapter = createWechatAdapter();
  installRequestCollector(adapter, q, opts);
  return q;
}

function callWxRequest(url: string, method: string, statusCode: number) {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => void } }).wx;
  const onSuccess = vi.fn();
  const onFail = vi.fn();
  wx.request({
    url,
    method,
    header: {},
    success: onSuccess,
    fail: onFail,
  });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.success({ statusCode, data: {}, header: {} });
  return { onSuccess, onFail };
}

function callWxRequestFail(url: string, method: string) {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => void } }).wx;
  const onSuccess = vi.fn();
  const onFail = vi.fn();
  wx.request({
    url,
    method,
    header: {},
    success: onSuccess,
    fail: onFail,
  });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.fail({ errMsg: 'timeout' });
  return { onSuccess, onFail };
}

describe('request collector', () => {
  it('emits miniprogram.request.duration metric on success', () => {
    const q = setup();
    callWxRequest('https://api.example.com/users', 'GET', 200);
    const events = q.drain();
    const metricEvent = events.find((e) => e.kind === 'metric');
    expect(metricEvent).toBeDefined();
    const metrics = metricEvent!.payload as OtlpMetric[];
    expect(metrics[0].name).toBe('miniprogram.request.duration');
    const attrs = metrics[0].gauge!.dataPoints[0].attributes!;
    expect(attrs.find((a) => a.key === 'server.address')?.value.stringValue).toBe('api.example.com');
    expect(attrs.find((a) => a.key === 'http.request.method')?.value.stringValue).toBe('GET');
    expect(attrs.find((a) => a.key === 'http.response.status_code')?.value.stringValue).toBe('200');
  });

  it('emits ajax error log for 4xx/5xx responses', () => {
    const q = setup();
    callWxRequest('https://api.example.com/fail', 'POST', 500);
    const logEvent = q.drain().find((e) => e.kind === 'log');
    expect(logEvent).toBeDefined();
    const log = logEvent!.payload as OtlpLogRecord;
    expect(log.severityNumber).toBe(17);
    expect(log.body.stringValue).toContain('500');
    expect(log.attributes!.find((a) => a.key === 'exception.type')?.value.stringValue).toBe('ajax');
  });

  it('emits both metric and error log on request failure', () => {
    const q = setup();
    callWxRequestFail('https://api.example.com/timeout', 'POST');
    const events = q.drain();
    expect(events.filter((e) => e.kind === 'metric')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'log')).toHaveLength(1);
    const log = events.find((e) => e.kind === 'log')!.payload as OtlpLogRecord;
    expect(log.body.stringValue).toContain('timeout');
  });

  it('forwards success callback to caller', () => {
    setup();
    const { onSuccess } = callWxRequest('https://api.example.com/ok', 'GET', 200);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('forwards fail callback to caller', () => {
    setup();
    const { onFail } = callWxRequestFail('https://api.example.com/err', 'POST');
    expect(onFail).toHaveBeenCalled();
  });

  it('skips instrumentation for collector URL (loop prevention)', () => {
    const q = setup({ collector: 'http://oap:4318' });
    callWxRequest('http://oap:4318/v1/metrics', 'POST', 200);
    expect(q.size()).toBe(0);
  });

  it('adds url.path.group label when URL matches a group rule', () => {
    const q = setup({ urlGroupRules: { '/api/users/*': /\/api\/users\/\d+/ } });
    callWxRequest('https://api.example.com/api/users/12345', 'GET', 200);
    const metrics = q.drain()[0].payload as OtlpMetric[];
    const group = metrics[0].gauge!.dataPoints[0].attributes!.find((a) => a.key === 'url.path.group');
    expect(group?.value.stringValue).toBe('/api/users/*');
  });

  it('omits url.path.group label when no rule matches', () => {
    const q = setup({ urlGroupRules: { '/api/users/*': /\/api\/users\/\d+/ } });
    callWxRequest('https://api.example.com/api/other', 'GET', 200);
    const metrics = q.drain()[0].payload as OtlpMetric[];
    const group = metrics[0].gauge!.dataPoints[0].attributes!.find((a) => a.key === 'url.path.group');
    expect(group).toBeUndefined();
  });

  it('does not emit error log for 2xx responses', () => {
    const q = setup();
    callWxRequest('https://api.example.com/ok', 'GET', 201);
    expect(q.drain().filter((e) => e.kind === 'log')).toHaveLength(0);
  });
});
