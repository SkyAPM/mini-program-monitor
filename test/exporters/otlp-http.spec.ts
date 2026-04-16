import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OtlpHttpExporter } from '../../src/exporters/otlp-http';
import { createWechatAdapter } from '../../src/adapters/wechat';
import { buildResource, buildScope } from '../../src/core/resource';
import { resolveOptions } from '../../src/core/options';
import type { OtlpLogRecord, OtlpMetric, ExportLogsServiceRequest, ExportMetricsServiceRequest } from '../../src/types/otlp';
import type { MonitorEvent } from '../../src/types/events';
import type { AdapterRequestOpts } from '../../src/adapters/types';

let requestCalls: AdapterRequestOpts[];

beforeEach(() => {
  requestCalls = [];
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.request = vi.fn((opts: WechatMiniprogram.RequestOption) => {
    const adapted: AdapterRequestOpts = {
      url: opts.url,
      method: (opts.method ?? 'GET') as string,
      data: opts.data,
      headers: (opts.header ?? {}) as Record<string, string>,
      onSuccess: (code) => opts.success?.({ statusCode: code, data: {}, header: {} } as WechatMiniprogram.RequestSuccessCallbackResult),
      onFail: (msg) => opts.fail?.({ errMsg: msg } as WechatMiniprogram.GeneralCallbackResult),
    };
    requestCalls.push(adapted);
    opts.success?.({ statusCode: 200, data: {}, header: {} } as WechatMiniprogram.RequestSuccessCallbackResult);
  });
});

function createExporter() {
  const opts = resolveOptions({ service: 'svc', serviceVersion: 'v1' });
  const adapter = createWechatAdapter();
  return new OtlpHttpExporter({
    collector: 'http://oap.example:12800',
    resource: buildResource(opts),
    scope: buildScope(),
    adapter,
  });
}

const fakeLog: OtlpLogRecord = {
  timeUnixNano: '1000000000000',
  severityNumber: 17,
  severityText: 'ERROR',
  body: { stringValue: 'boom' },
  attributes: [{ key: 'exception.type', value: { stringValue: 'js' } }],
};

const fakeMetric: OtlpMetric = {
  name: 'miniprogram.app_launch.duration',
  unit: 'ms',
  gauge: { dataPoints: [{ asInt: '1200', timeUnixNano: '1000000000000' }] },
};

describe('OtlpHttpExporter', () => {
  it('POSTs log events to /v1/logs', async () => {
    const exporter = createExporter();
    await exporter.export([{ kind: 'log', time: 1, payload: fakeLog }]);
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0].url).toBe('http://oap.example:12800/v1/logs');
    const body = requestCalls[0].data as ExportLogsServiceRequest;
    expect(body.resourceLogs).toHaveLength(1);
    expect(body.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toBe('boom');
    const svcAttr = body.resourceLogs[0].resource.attributes.find((a) => a.key === 'service.name');
    expect(svcAttr?.value.stringValue).toBe('svc');
  });

  it('POSTs metric events to /v1/metrics', async () => {
    const exporter = createExporter();
    await exporter.export([{ kind: 'metric', time: 1, payload: [fakeMetric] }]);
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0].url).toBe('http://oap.example:12800/v1/metrics');
    const body = requestCalls[0].data as ExportMetricsServiceRequest;
    expect(body.resourceMetrics[0].scopeMetrics[0].metrics[0].name).toBe('miniprogram.app_launch.duration');
  });

  it('POSTs logs and metrics in parallel', async () => {
    const exporter = createExporter();
    const events: MonitorEvent[] = [
      { kind: 'log', time: 1, payload: fakeLog },
      { kind: 'metric', time: 2, payload: [fakeMetric] },
    ];
    await exporter.export(events);
    expect(requestCalls).toHaveLength(2);
    const urls = requestCalls.map((c) => c.url);
    expect(urls).toContain('http://oap.example:12800/v1/logs');
    expect(urls).toContain('http://oap.example:12800/v1/metrics');
  });

  it('skips POST when no matching events', async () => {
    const exporter = createExporter();
    await exporter.export([{ kind: 'segment', time: 1, payload: {} }]);
    expect(requestCalls).toHaveLength(0);
  });

  it('includes miniprogram.platform in resource attributes', async () => {
    const exporter = createExporter();
    await exporter.export([{ kind: 'log', time: 1, payload: fakeLog }]);
    const body = requestCalls[0].data as ExportLogsServiceRequest;
    const platformAttr = body.resourceLogs[0].resource.attributes.find(
      (a) => a.key === 'miniprogram.platform',
    );
    expect(platformAttr?.value.stringValue).toBe('wechat');
  });
});
