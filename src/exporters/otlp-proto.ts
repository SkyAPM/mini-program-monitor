import type {
  OtlpAnyValue,
  OtlpKeyValue,
  OtlpResource,
  OtlpInstrumentationScope,
  OtlpLogRecord,
  OtlpMetric,
  OtlpHistogramDataPoint,
  OtlpNumberDataPoint,
  ExportLogsServiceRequest,
  ExportMetricsServiceRequest,
} from '../types/otlp';
import {
  ProtoWriter,
  writeString,
  writeInt32,
  writeFixed64String,
  writeDouble,
  writeSubmessage,
  writePackedFixed64Strings,
  writePackedDoubles,
  WT_I64,
} from './proto-writer';

function encodeAnyValue(w: ProtoWriter, v: OtlpAnyValue): void {
  if (v.stringValue !== undefined) writeString(w, 1, v.stringValue);
  else if (v.boolValue !== undefined) {
    w.tag(2, 0);
    w.varint(v.boolValue ? 1 : 0);
  }
  else if (v.doubleValue !== undefined) writeDouble(w, 4, v.doubleValue);
}

function encodeKeyValue(w: ProtoWriter, kv: OtlpKeyValue): void {
  writeString(w, 1, kv.key);
  writeSubmessage(w, 2, (sub) => encodeAnyValue(sub, kv.value));
}

function encodeResource(w: ProtoWriter, r: OtlpResource): void {
  for (const a of r.attributes) writeSubmessage(w, 1, (sub) => encodeKeyValue(sub, a));
}

function encodeScope(w: ProtoWriter, s: OtlpInstrumentationScope): void {
  writeString(w, 1, s.name);
  writeString(w, 2, s.version);
}

function encodeLogRecord(w: ProtoWriter, lr: OtlpLogRecord): void {
  writeFixed64String(w, 1, lr.timeUnixNano);
  writeInt32(w, 2, lr.severityNumber);
  writeString(w, 3, lr.severityText);
  writeSubmessage(w, 5, (sub) => encodeAnyValue(sub, lr.body));
  if (lr.attributes) {
    for (const a of lr.attributes) writeSubmessage(w, 6, (sub) => encodeKeyValue(sub, a));
  }
}

function encodeNumberDataPoint(w: ProtoWriter, dp: OtlpNumberDataPoint): void {
  writeFixed64String(w, 3, dp.timeUnixNano);
  if (dp.asDouble !== undefined) writeDouble(w, 4, dp.asDouble);
  else if (dp.asInt !== undefined) {
    w.tag(6, WT_I64);
    w.fixed64FromString(dp.asInt);
  }
  if (dp.attributes) {
    for (const a of dp.attributes) writeSubmessage(w, 7, (sub) => encodeKeyValue(sub, a));
  }
}

function encodeHistogramDataPoint(w: ProtoWriter, dp: OtlpHistogramDataPoint): void {
  writeFixed64String(w, 3, dp.timeUnixNano);
  w.tag(4, WT_I64);
  w.fixed64FromString(dp.count);
  writeDouble(w, 5, dp.sum);
  writePackedFixed64Strings(w, 6, dp.bucketCounts);
  writePackedDoubles(w, 7, dp.explicitBounds);
  if (dp.attributes) {
    for (const a of dp.attributes) writeSubmessage(w, 9, (sub) => encodeKeyValue(sub, a));
  }
}

function encodeMetric(w: ProtoWriter, m: OtlpMetric): void {
  writeString(w, 1, m.name);
  writeString(w, 2, m.description);
  writeString(w, 3, m.unit);
  if (m.gauge) {
    writeSubmessage(w, 5, (sub) => {
      for (const dp of m.gauge!.dataPoints) {
        writeSubmessage(sub, 1, (ddp) => encodeNumberDataPoint(ddp, dp));
      }
    });
  } else if (m.sum) {
    writeSubmessage(w, 7, (sub) => {
      for (const dp of m.sum!.dataPoints) {
        writeSubmessage(sub, 1, (ddp) => encodeNumberDataPoint(ddp, dp));
      }
      writeInt32(sub, 2, m.sum!.aggregationTemporality);
      if (m.sum!.isMonotonic) {
        sub.tag(3, 0);
        sub.varint(1);
      }
    });
  } else if (m.histogram) {
    writeSubmessage(w, 9, (sub) => {
      for (const dp of m.histogram!.dataPoints) {
        writeSubmessage(sub, 1, (ddp) => encodeHistogramDataPoint(ddp, dp));
      }
      writeInt32(sub, 2, m.histogram!.aggregationTemporality);
    });
  }
}

export function encodeLogsRequest(req: ExportLogsServiceRequest): Uint8Array {
  const w = new ProtoWriter();
  for (const rl of req.resourceLogs) {
    writeSubmessage(w, 1, (sub) => {
      writeSubmessage(sub, 1, (rsub) => encodeResource(rsub, rl.resource));
      for (const sl of rl.scopeLogs) {
        writeSubmessage(sub, 2, (ssub) => {
          writeSubmessage(ssub, 1, (scopeSub) => encodeScope(scopeSub, sl.scope));
          for (const lr of sl.logRecords) {
            writeSubmessage(ssub, 2, (lsub) => encodeLogRecord(lsub, lr));
          }
        });
      }
    });
  }
  return w.finish();
}

export function encodeMetricsRequest(req: ExportMetricsServiceRequest): Uint8Array {
  const w = new ProtoWriter();
  for (const rm of req.resourceMetrics) {
    writeSubmessage(w, 1, (sub) => {
      writeSubmessage(sub, 1, (rsub) => encodeResource(rsub, rm.resource));
      for (const sm of rm.scopeMetrics) {
        writeSubmessage(sub, 2, (ssub) => {
          writeSubmessage(ssub, 1, (scopeSub) => encodeScope(scopeSub, sm.scope));
          for (const m of sm.metrics) {
            writeSubmessage(ssub, 2, (msub) => encodeMetric(msub, m));
          }
        });
      }
    });
  }
  return w.finish();
}
