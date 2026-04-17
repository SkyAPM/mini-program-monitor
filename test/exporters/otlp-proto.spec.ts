import { describe, it, expect } from 'vitest';
import protobuf from 'protobufjs';
import { encodeLogsRequest, encodeMetricsRequest } from '../../src/exporters/otlp-proto';
import type { ExportLogsServiceRequest, ExportMetricsServiceRequest } from '../../src/types/otlp';

const protoSrc = `
syntax = "proto3";

message AnyValue {
  oneof value {
    string string_value = 1;
    bool bool_value = 2;
    int64 int_value = 3;
    double double_value = 4;
  }
}
message KeyValue { string key = 1; AnyValue value = 2; }
message Resource { repeated KeyValue attributes = 1; }
message InstrumentationScope { string name = 1; string version = 2; }

message LogRecord {
  fixed64 time_unix_nano = 1;
  int32 severity_number = 2;
  string severity_text = 3;
  AnyValue body = 5;
  repeated KeyValue attributes = 6;
}
message ScopeLogs {
  InstrumentationScope scope = 1;
  repeated LogRecord log_records = 2;
}
message ResourceLogs {
  Resource resource = 1;
  repeated ScopeLogs scope_logs = 2;
}
message ExportLogsServiceRequest {
  repeated ResourceLogs resource_logs = 1;
}

message HistogramDataPoint {
  fixed64 start_time_unix_nano = 2;
  fixed64 time_unix_nano = 3;
  fixed64 count = 4;
  double sum = 5;
  repeated fixed64 bucket_counts = 6;
  repeated double explicit_bounds = 7;
  repeated KeyValue attributes = 9;
}
message Histogram {
  repeated HistogramDataPoint data_points = 1;
  int32 aggregation_temporality = 2;
}
message Metric {
  string name = 1;
  string description = 2;
  string unit = 3;
  oneof data {
    Histogram histogram = 9;
  }
}
message ScopeMetrics {
  InstrumentationScope scope = 1;
  repeated Metric metrics = 2;
}
message ResourceMetrics {
  Resource resource = 1;
  repeated ScopeMetrics scope_metrics = 2;
}
message ExportMetricsServiceRequest {
  repeated ResourceMetrics resource_metrics = 1;
}
`;

const root = protobuf.parse(protoSrc, { keepCase: false }).root;
const LogsReq = root.lookupType('ExportLogsServiceRequest');
const MetricsReq = root.lookupType('ExportMetricsServiceRequest');

describe('OTLP proto encoder', () => {
  it('encodes a log record roundtrippable via protobufjs', () => {
    const req: ExportLogsServiceRequest = {
      resourceLogs: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'test-svc' } }] },
        scopeLogs: [{
          scope: { name: 'mpm', version: '0.2.0' },
          logRecords: [{
            timeUnixNano: '1700000000000000000',
            severityNumber: 17,
            severityText: 'ERROR',
            body: { stringValue: 'hello world' },
            attributes: [{ key: 'exception.type', value: { stringValue: 'ajax' } }],
          }],
        }],
      }],
    };

    const bytes = encodeLogsRequest(req);
    const decoded = LogsReq.decode(bytes) as unknown as {
      resourceLogs: Array<{
        resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
        scopeLogs: Array<{
          scope: { name: string; version: string };
          logRecords: Array<{ timeUnixNano: unknown; severityNumber: number; severityText: string; body: { stringValue: string }; attributes: Array<{ key: string; value: { stringValue: string } }> }>;
        }>;
      }>;
    };

    const rl = decoded.resourceLogs[0];
    expect(rl.resource.attributes[0]).toEqual({ key: 'service.name', value: { stringValue: 'test-svc' } });
    expect(rl.scopeLogs[0].scope).toEqual({ name: 'mpm', version: '0.2.0' });
    const lr = rl.scopeLogs[0].logRecords[0];
    expect(String(lr.timeUnixNano)).toBe('1700000000000000000');
    expect(lr.severityNumber).toBe(17);
    expect(lr.severityText).toBe('ERROR');
    expect(lr.body.stringValue).toBe('hello world');
    expect(lr.attributes[0]).toEqual({ key: 'exception.type', value: { stringValue: 'ajax' } });
  });

  it('encodes a histogram metric roundtrippable via protobufjs', () => {
    const req: ExportMetricsServiceRequest = {
      resourceMetrics: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'test-svc' } }] },
        scopeMetrics: [{
          scope: { name: 'mpm', version: '0.2.0' },
          metrics: [{
            name: 'miniprogram.request.duration',
            unit: 'ms',
            histogram: {
              aggregationTemporality: 1,
              dataPoints: [{
                timeUnixNano: '1700000000000000000',
                count: '3',
                sum: 720,
                bucketCounts: ['1', '1', '1', '0'],
                explicitBounds: [10, 100, 1000],
                attributes: [{ key: 'http.request.method', value: { stringValue: 'GET' } }],
              }],
            },
          }],
        }],
      }],
    };

    const bytes = encodeMetricsRequest(req);
    const decoded = MetricsReq.decode(bytes) as unknown as {
      resourceMetrics: Array<{
        scopeMetrics: Array<{
          metrics: Array<{
            name: string;
            unit: string;
            histogram: {
              aggregationTemporality: number;
              dataPoints: Array<{
                timeUnixNano: unknown;
                count: unknown;
                sum: number;
                bucketCounts: unknown[];
                explicitBounds: number[];
                attributes: Array<{ key: string; value: { stringValue: string } }>;
              }>;
            };
          }>;
        }>;
      }>;
    };

    const m = decoded.resourceMetrics[0].scopeMetrics[0].metrics[0];
    expect(m.name).toBe('miniprogram.request.duration');
    expect(m.unit).toBe('ms');
    expect(m.histogram.aggregationTemporality).toBe(1);
    const dp = m.histogram.dataPoints[0];
    expect(String(dp.timeUnixNano)).toBe('1700000000000000000');
    expect(String(dp.count)).toBe('3');
    expect(dp.sum).toBe(720);
    expect(dp.bucketCounts.map(String)).toEqual(['1', '1', '1', '0']);
    expect(dp.explicitBounds).toEqual([10, 100, 1000]);
    expect(dp.attributes[0]).toEqual({ key: 'http.request.method', value: { stringValue: 'GET' } });
  });
});
