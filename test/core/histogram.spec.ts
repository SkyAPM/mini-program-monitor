import { describe, it, expect } from 'vitest';
import { HistogramAggregator } from '../../src/core/histogram';
import type { OtlpKeyValue } from '../../src/types/otlp';

function attrs(method: string, status: string): OtlpKeyValue[] {
  return [
    { key: 'http.request.method', value: { stringValue: method } },
    { key: 'http.response.status_code', value: { stringValue: status } },
  ];
}

describe('HistogramAggregator', () => {
  it('returns null on empty drain', () => {
    const h = new HistogramAggregator();
    expect(h.drain('x', 'ms', 0)).toBeNull();
  });

  it('counts values and exposes sum', () => {
    const h = new HistogramAggregator();
    h.record(attrs('GET', '200'), 20);
    h.record(attrs('GET', '200'), 100);
    h.record(attrs('GET', '200'), 600);
    const m = h.drain('miniprogram.request.duration', 'ms', 1000)!;
    expect(m.histogram!.dataPoints).toHaveLength(1);
    expect(m.histogram!.dataPoints[0].count).toBe('3');
    expect(m.histogram!.dataPoints[0].sum).toBe(720);
  });

  it('groups by attribute key-value', () => {
    const h = new HistogramAggregator();
    h.record(attrs('GET', '200'), 10);
    h.record(attrs('POST', '200'), 20);
    h.record(attrs('GET', '200'), 30);
    const m = h.drain('x', 'ms', 0)!;
    expect(m.histogram!.dataPoints).toHaveLength(2);
  });

  it('buckets values into explicit bounds', () => {
    const h = new HistogramAggregator([10, 100, 1000]);
    h.record(attrs('GET', '200'), 5);    // bucket 0
    h.record(attrs('GET', '200'), 50);   // bucket 1
    h.record(attrs('GET', '200'), 500);  // bucket 2
    h.record(attrs('GET', '200'), 5000); // bucket 3 (+Inf)
    const m = h.drain('x', 'ms', 0)!;
    expect(m.histogram!.dataPoints[0].bucketCounts).toEqual(['1', '1', '1', '1']);
    expect(m.histogram!.dataPoints[0].explicitBounds).toEqual([10, 100, 1000]);
  });

  it('uses DELTA temporality and resets after drain', () => {
    const h = new HistogramAggregator();
    h.record(attrs('GET', '200'), 10);
    const m = h.drain('x', 'ms', 0)!;
    expect(m.histogram!.aggregationTemporality).toBe(1);
    expect(h.isEmpty()).toBe(true);
    expect(h.drain('x', 'ms', 0)).toBeNull();
  });
});
