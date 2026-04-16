import { describe, it, expect, vi, beforeEach } from 'vitest';
import { init, flush, shutdown } from '../src/index';
import type { ExportLogsServiceRequest, ExportMetricsServiceRequest } from '../src/types/otlp';

type WxErrorCb = (msg: string) => void;
type PerfObserverCb = (list: { getEntries: () => unknown[] }) => void;

let onErrorCb: WxErrorCb | undefined;
let perfObserverCb: PerfObserverCb | undefined;
let requestCalls: Array<{ url: string; data: unknown }>;

beforeEach(() => {
  onErrorCb = undefined;
  perfObserverCb = undefined;
  requestCalls = [];
  shutdown();

  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.onError = (cb: WxErrorCb) => { onErrorCb = cb; };
  wxAny.getPerformance = vi.fn(() => ({
    createObserver: (cb: PerfObserverCb) => {
      perfObserverCb = cb;
      return { observe: () => {}, disconnect: () => {} };
    },
    getEntries: () => [],
  }));
  wxAny.request = vi.fn((opts: { url: string; data: unknown; success?: (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void }) => {
    requestCalls.push({ url: opts.url, data: opts.data });
    opts.success?.({ statusCode: 200, data: {}, header: {} });
  });
});

describe('integration: init → collect → flush → verify OTLP', () => {
  it('error flows end-to-end as OTLP log to /v1/logs', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      flushInterval: 60_000,
    });

    onErrorCb!('ReferenceError: foo is not defined\n    at bar.js:5');
    await flush();

    const logPost = requestCalls.find((c) => c.url.includes('/v1/logs'));
    expect(logPost).toBeDefined();
    const body = logPost!.data as ExportLogsServiceRequest;
    const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(logRecord.severityNumber).toBe(17);
    expect(logRecord.body.stringValue).toBe('ReferenceError: foo is not defined');

    const svcAttr = body.resourceLogs[0].resource.attributes.find((a) => a.key === 'service.name');
    expect(svcAttr?.value.stringValue).toBe('integ-test');

    const platformAttr = body.resourceLogs[0].resource.attributes.find((a) => a.key === 'miniprogram.platform');
    expect(platformAttr?.value.stringValue).toBe('wechat');

    shutdown();
  });

  it('perf entries flow end-to-end as OTLP metrics to /v1/metrics', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      flushInterval: 60_000,
    });

    perfObserverCb!({
      getEntries: () => [
        { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 800 },
      ],
    });
    await flush();

    const metricsPost = requestCalls.find((c) => c.url.includes('/v1/metrics'));
    expect(metricsPost).toBeDefined();
    const body = metricsPost!.data as ExportMetricsServiceRequest;
    const metric = body.resourceMetrics[0].scopeMetrics[0].metrics[0];
    expect(metric.name).toBe('miniprogram.app_launch.duration');
    expect(metric.gauge!.dataPoints[0].asInt).toBe('800');

    shutdown();
  });

  it('no POST when collector is not set (console exporter)', async () => {
    init({ service: 'no-collector' });

    onErrorCb!('test error');
    await flush();

    expect(requestCalls).toHaveLength(0);
    shutdown();
  });

  it('respects enable.error = false', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      enable: { error: false },
      flushInterval: 60_000,
    });

    expect(onErrorCb).toBeUndefined();
    shutdown();
  });

  it('respects enable.perf = false', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      enable: { perf: false },
      flushInterval: 60_000,
    });

    expect(perfObserverCb).toBeUndefined();
    shutdown();
  });
});
