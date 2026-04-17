import type { OtlpKeyValue, OtlpMetric, OtlpHistogramDataPoint } from '../types/otlp';

// Default buckets in ms: 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
const DEFAULT_BOUNDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

interface Entry {
  attrs: OtlpKeyValue[];
  count: number;
  sum: number;
  buckets: number[];
}

function attrsKey(attrs: OtlpKeyValue[]): string {
  let s = '';
  for (const a of attrs) s += a.key + '=' + (a.value.stringValue ?? '') + '|';
  return s;
}

function toNanos(ms: number): string {
  return ms + '000000';
}

export class HistogramAggregator {
  private readonly bounds: number[];
  private entries: Record<string, Entry> = {};

  constructor(bounds: number[] = DEFAULT_BOUNDS) {
    this.bounds = bounds;
  }

  record(attrs: OtlpKeyValue[], valueMs: number): void {
    const key = attrsKey(attrs);
    let entry = this.entries[key];
    if (!entry) {
      entry = { attrs, count: 0, sum: 0, buckets: new Array(this.bounds.length + 1).fill(0) };
      this.entries[key] = entry;
    }
    entry.count++;
    entry.sum += valueMs;
    let idx = this.bounds.length;
    for (let i = 0; i < this.bounds.length; i++) {
      if (valueMs <= this.bounds[i]) {
        idx = i;
        break;
      }
    }
    entry.buckets[idx]++;
  }

  drain(name: string, unit: string, timeMs: number): OtlpMetric | null {
    const dataPoints: OtlpHistogramDataPoint[] = [];
    for (const key in this.entries) {
      const e = this.entries[key];
      dataPoints.push({
        attributes: e.attrs,
        timeUnixNano: toNanos(timeMs),
        count: String(e.count),
        sum: e.sum,
        bucketCounts: e.buckets.map((n) => String(n)),
        explicitBounds: this.bounds,
      });
    }
    this.entries = {};
    if (dataPoints.length === 0) return null;
    return {
      name,
      unit,
      histogram: {
        aggregationTemporality: 1, // DELTA
        dataPoints,
      },
    };
  }

  isEmpty(): boolean {
    return Object.keys(this.entries).length === 0;
  }
}
