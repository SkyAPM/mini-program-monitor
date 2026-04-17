import { describe, it, expect, vi, beforeEach } from 'vitest';
import protobuf from 'protobufjs';
import { init, flush, shutdown } from '../src/index';
import type { ExportLogsServiceRequest } from '../src/types/otlp';

type WxErrorCb = (msg: string) => void;
type PerfObserverCb = (list: { getEntries: () => unknown[] }) => void;

let onErrorCb: WxErrorCb | undefined;
let perfObserverCb: PerfObserverCb | undefined;
let requestCalls: Array<{ url: string; data: unknown; contentType: string }>;

const protoSrc = `
syntax = "proto3";
message AnyValue { oneof value { string string_value = 1; double double_value = 4; } }
message KeyValue { string key = 1; AnyValue value = 2; }
message Resource { repeated KeyValue attributes = 1; }
message InstrumentationScope { string name = 1; string version = 2; }
message LogRecord {
  fixed64 time_unix_nano = 1; int32 severity_number = 2; string severity_text = 3;
  AnyValue body = 5; repeated KeyValue attributes = 6;
}
message ScopeLogs { InstrumentationScope scope = 1; repeated LogRecord log_records = 2; }
message ResourceLogs { Resource resource = 1; repeated ScopeLogs scope_logs = 2; }
message ExportLogsServiceRequest { repeated ResourceLogs resource_logs = 1; }
message NumberDataPoint {
  fixed64 start_time_unix_nano = 2; fixed64 time_unix_nano = 3;
  oneof value { double as_double = 4; sfixed64 as_int = 6; }
  repeated KeyValue attributes = 7;
}
message Gauge { repeated NumberDataPoint data_points = 1; }
message Metric {
  string name = 1; string description = 2; string unit = 3;
  oneof data { Gauge gauge = 5; }
}
message ScopeMetrics { InstrumentationScope scope = 1; repeated Metric metrics = 2; }
message ResourceMetrics { Resource resource = 1; repeated ScopeMetrics scope_metrics = 2; }
message ExportMetricsServiceRequest { repeated ResourceMetrics resource_metrics = 1; }
`;
const protoRoot = protobuf.parse(protoSrc, { keepCase: false }).root;
const LogsReq = protoRoot.lookupType('ExportLogsServiceRequest');
const MetricsReq = protoRoot.lookupType('ExportMetricsServiceRequest');

function toBytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Uint8Array) return data;
  throw new Error(`expected binary body, got ${typeof data}`);
}

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
  wxAny.request = vi.fn((opts: { url: string; data: unknown; header?: Record<string, string>; success?: (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void }) => {
    requestCalls.push({ url: opts.url, data: opts.data, contentType: opts.header?.['Content-Type'] ?? '' });
    opts.success?.({ statusCode: 200, data: {}, header: {} });
  });
});

describe('integration: init → collect → flush → verify OTLP', () => {
  it('error flows end-to-end as proto-encoded log to /v1/logs (default encoding)', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      flushInterval: 60_000,
    });

    onErrorCb!('ReferenceError: foo is not defined\n    at bar.js:5');
    await flush();

    const logPost = requestCalls.find((c) => c.url.includes('/v1/logs'));
    expect(logPost).toBeDefined();
    expect(logPost!.contentType).toBe('application/x-protobuf');
    const decoded = LogsReq.decode(toBytes(logPost!.data)) as unknown as {
      resourceLogs: Array<{
        resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
        scopeLogs: Array<{ logRecords: Array<{ severityNumber: number; body: { stringValue: string } }> }>;
      }>;
    };
    const rl = decoded.resourceLogs[0];
    const lr = rl.scopeLogs[0].logRecords[0];
    expect(lr.severityNumber).toBe(17);
    expect(lr.body.stringValue).toBe('ReferenceError: foo is not defined');
    expect(rl.resource.attributes.find((a) => a.key === 'service.name')?.value.stringValue).toBe('integ-test');
    expect(rl.resource.attributes.find((a) => a.key === 'miniprogram.platform')?.value.stringValue).toBe('wechat');

    shutdown();
  });

  it('perf entries flow end-to-end as proto-encoded gauge to /v1/metrics (default encoding)', async () => {
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
    expect(metricsPost!.contentType).toBe('application/x-protobuf');
    const decoded = MetricsReq.decode(toBytes(metricsPost!.data)) as unknown as {
      resourceMetrics: Array<{ scopeMetrics: Array<{ metrics: Array<{ name: string; gauge: { dataPoints: Array<{ asInt: unknown }> } }> }> }>;
    };
    const m = decoded.resourceMetrics[0].scopeMetrics[0].metrics[0];
    expect(m.name).toBe('miniprogram.app_launch.duration');
    expect(String(m.gauge.dataPoints[0].asInt)).toBe('800');

    shutdown();
  });

  it('posts JSON when encoding=json is opted in', async () => {
    init({
      service: 'integ-test',
      collector: 'http://otel:4318',
      flushInterval: 60_000,
      encoding: 'json',
    });
    onErrorCb!('boom');
    await flush();

    const logPost = requestCalls.find((c) => c.url.includes('/v1/logs'))!;
    expect(logPost.contentType).toBe('application/json');
    const body = logPost.data as ExportLogsServiceRequest;
    expect(body.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toBe('boom');
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
