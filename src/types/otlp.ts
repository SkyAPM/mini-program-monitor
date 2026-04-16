// OTLP JSON wire types per the OpenTelemetry Protocol specification.
// Proto3 JSON mapping: field names use camelCase (matching .proto definitions).
// See: https://github.com/open-telemetry/opentelemetry-proto

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAnyValue[] };
  kvlistValue?: { values: OtlpKeyValue[] };
}

export interface OtlpResource {
  attributes: OtlpKeyValue[];
}

export interface OtlpInstrumentationScope {
  name: string;
  version: string;
}

// ── Metrics ──

export interface OtlpNumberDataPoint {
  attributes?: OtlpKeyValue[];
  timeUnixNano: string;
  asInt?: string;
  asDouble?: number;
}

export interface OtlpGauge {
  dataPoints: OtlpNumberDataPoint[];
}

export interface OtlpSum {
  dataPoints: OtlpNumberDataPoint[];
  aggregationTemporality: number; // 1=DELTA, 2=CUMULATIVE
  isMonotonic: boolean;
}

export interface OtlpHistogramDataPoint {
  attributes?: OtlpKeyValue[];
  timeUnixNano: string;
  count: string;
  sum?: number;
  bucketCounts: string[];
  explicitBounds: number[];
}

export interface OtlpHistogram {
  dataPoints: OtlpHistogramDataPoint[];
  aggregationTemporality: number;
}

export interface OtlpMetric {
  name: string;
  unit?: string;
  description?: string;
  gauge?: OtlpGauge;
  sum?: OtlpSum;
  histogram?: OtlpHistogram;
}

export interface OtlpScopeMetrics {
  scope: OtlpInstrumentationScope;
  metrics: OtlpMetric[];
}

export interface OtlpResourceMetrics {
  resource: OtlpResource;
  scopeMetrics: OtlpScopeMetrics[];
}

export interface ExportMetricsServiceRequest {
  resourceMetrics: OtlpResourceMetrics[];
}

// ── Logs ──

export interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: OtlpAnyValue;
  attributes?: OtlpKeyValue[];
}

export interface OtlpScopeLogs {
  scope: OtlpInstrumentationScope;
  logRecords: OtlpLogRecord[];
}

export interface OtlpResourceLogs {
  resource: OtlpResource;
  scopeLogs: OtlpScopeLogs[];
}

export interface ExportLogsServiceRequest {
  resourceLogs: OtlpResourceLogs[];
}
