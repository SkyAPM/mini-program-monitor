import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingQueue } from '../../src/core/queue';
import { installRequestCollector, type RequestCollectorHandle } from '../../src/collectors/request';
import { resolveOptions } from '../../src/core/options';
import { createWechatAdapter } from '../../src/adapters/wechat';
import type { OtlpMetric, OtlpLogRecord } from '../../src/types/otlp';

let originalRequestMock: ReturnType<typeof vi.fn>;
const sentinelTask = { abort: () => {}, onHeadersReceived: () => {} };

beforeEach(() => {
  originalRequestMock = vi.fn((_opts: Record<string, unknown>): unknown => sentinelTask);
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

function callWxRequest(url: string, method: string, statusCode: number): unknown {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => unknown } }).wx;
  const task = wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.success({ statusCode, data: {}, header: {} });
  return task;
}

function callWxRequestFail(url: string, method: string): unknown {
  const wx = (globalThis as unknown as { wx: { request: (opts: Record<string, unknown>) => unknown } }).wx;
  const task = wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  const call = originalRequestMock.mock.calls[originalRequestMock.mock.calls.length - 1][0];
  call.fail({ errMsg: 'timeout' });
  return task;
}

describe('request collector', () => {
  it('aggregates request durations into histogram on drain and returns the native task', () => {
    const { q, handle } = setup();
    const task1 = callWxRequest('https://api.example.com/a', 'GET', 200);
    const task2 = callWxRequest('https://api.example.com/b', 'GET', 200);
    expect(task1).toBe(sentinelTask);
    expect(task2).toBe(sentinelTask);
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

  it('skips instrumentation for collector endpoint URLs (loop prevention) but still returns task', () => {
    const { q, handle } = setup({ collector: 'http://oap:4318' });
    const task = callWxRequest('http://oap:4318/v1/metrics', 'POST', 200);
    expect(task).toBe(sentinelTask);
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

  it('records download duration with DOWNLOAD method label and returns DownloadTask', () => {
    const dlTask = { abort: () => {}, onProgressUpdate: () => {}, offProgressUpdate: () => {} };
    const downloadMock = vi.fn((_opts: Record<string, unknown>): unknown => dlTask);
    const wx = (globalThis as unknown as { wx: { downloadFile: unknown } }).wx;
    wx.downloadFile = downloadMock;

    const { q, handle } = setup();
    const task = (wx as unknown as { downloadFile: (o: Record<string, unknown>) => unknown }).downloadFile({
      url: 'https://cdn.example.com/file.png', header: {}, success: () => {}, fail: () => {},
    });
    expect(task).toBe(dlTask);
    const call = downloadMock.mock.calls[0]![0] as { success: (r: Record<string, unknown>) => void };
    call.success({ statusCode: 200, tempFilePath: '/tmp/a.png', header: {} });

    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric')!.payload as OtlpMetric[];
    const attrs = metric[0].histogram!.dataPoints[0].attributes!;
    expect(attrs.find((a) => a.key === 'http.request.method')?.value.stringValue).toBe('DOWNLOAD');
  });

  it('records upload duration with UPLOAD method label and returns UploadTask', () => {
    const upTask = { abort: () => {}, onProgressUpdate: () => {}, offProgressUpdate: () => {} };
    const uploadMock = vi.fn((_opts: Record<string, unknown>): unknown => upTask);
    const wx = (globalThis as unknown as { wx: { uploadFile: unknown } }).wx;
    wx.uploadFile = uploadMock;

    const { q, handle } = setup();
    const task = (wx as unknown as { uploadFile: (o: Record<string, unknown>) => unknown }).uploadFile({
      url: 'https://api.example.com/upload', filePath: '/tmp/a.png', name: 'file',
      header: {}, success: () => {}, fail: () => {},
    });
    expect(task).toBe(upTask);
    const call = uploadMock.mock.calls[0]![0] as { success: (r: Record<string, unknown>) => void };
    call.success({ statusCode: 201, data: '{}', header: {} });

    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric')!.payload as OtlpMetric[];
    const attrs = metric[0].histogram!.dataPoints[0].attributes!;
    expect(attrs.find((a) => a.key === 'http.request.method')?.value.stringValue).toBe('UPLOAD');
  });

  it('propagates wx.request return value (RequestTask) to caller', () => {
    const nativeTask = { abort: () => {}, onHeadersReceived: () => {} };
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    wxAny.request = vi.fn((_opts: Record<string, unknown>): unknown => nativeTask);

    setup();
    const returned = (wxAny as unknown as { request: (o: Record<string, unknown>) => unknown }).request({
      url: 'https://api.example.com/a', method: 'GET', header: {}, success: () => {}, fail: () => {},
    });
    expect(returned).toBe(nativeTask);
  });

  it('skips only known OTLP endpoints, not other paths on the same host', () => {
    const { q, handle } = setup({ collector: 'http://oap:4318' });
    callWxRequest('http://oap:4318/api/users', 'GET', 200);
    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric');
    expect(metric).toBeDefined();
  });

  it('omits server.address on histogram when URL has no parseable host', () => {
    const { q, handle } = setup();
    callWxRequest('not-a-url', 'GET', 200);
    handle.drainHistogram();
    const metric = q.drain().find((e) => e.kind === 'metric')!.payload as OtlpMetric[];
    const attrs = metric[0].histogram!.dataPoints[0].attributes!;
    expect(attrs.find((a) => a.key === 'server.address')).toBeUndefined();
  });

  it('omits server.address on ajax error log when URL has no parseable host', () => {
    const { q } = setup();
    callWxRequest('not-a-url', 'POST', 500);
    const log = q.drain().find((e) => e.kind === 'log')!.payload as OtlpLogRecord;
    expect(log.attributes!.find((a) => a.key === 'server.address')).toBeUndefined();
  });

  it('emits error log when download fails with 4xx', () => {
    const downloadMock = vi.fn();
    const wx = (globalThis as unknown as { wx: { downloadFile: unknown } }).wx;
    wx.downloadFile = downloadMock;

    const { q } = setup();
    (wx as unknown as { downloadFile: (o: Record<string, unknown>) => void }).downloadFile({
      url: 'https://cdn.example.com/missing.png', header: {}, success: () => {}, fail: () => {},
    });
    const call = downloadMock.mock.calls[0][0];
    call.success({ statusCode: 404, tempFilePath: '', header: {} });

    const log = q.drain().find((e) => e.kind === 'log');
    expect(log).toBeDefined();
    expect((log!.payload as OtlpLogRecord).body.stringValue).toContain('DOWNLOAD');
    expect((log!.payload as OtlpLogRecord).body.stringValue).toContain('404');
  });
});
