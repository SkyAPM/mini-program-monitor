import { describe, it, expect, vi, beforeEach } from 'vitest';
import { init, shutdown, record, flush } from '../src/index';

let storedData: Record<string, string>;
let requestCalls: Array<{ url: string; data: unknown }>;

beforeEach(() => {
  shutdown();
  storedData = {};
  requestCalls = [];
  const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
  wxAny.setStorageSync = vi.fn((key: string, data: string) => {
    storedData[key] = data;
  });
  wxAny.getStorageSync = vi.fn((key: string) => storedData[key] ?? '');
  wxAny.request = vi.fn((opts: { url: string; data: unknown; success?: (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void }) => {
    requestCalls.push({ url: opts.url, data: opts.data });
    opts.success?.({ statusCode: 200, data: {}, header: {} });
  });
});

describe('persistence', () => {
  it('saves pending events to storage on onAppHide', () => {
    let appHideCb: (() => void) | undefined;
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    wxAny.onAppHide = vi.fn((cb: () => void) => { appHideCb = cb; });

    init({ service: 'persist-test', collector: 'http://oap:4318', flushInterval: 60_000 });
    record('log', { body: { stringValue: 'pending event' } });
    appHideCb!();

    expect(storedData['mpm:pending']).toBeDefined();
    const parsed = JSON.parse(storedData['mpm:pending']);
    expect(parsed).toHaveLength(1);
    shutdown();
  });

  it('restores pending events from storage on init', async () => {
    const pendingEvents = [
      { kind: 'log', time: 1, payload: { timeUnixNano: '1000', severityNumber: 17, severityText: 'ERROR', body: { stringValue: 'restored' }, attributes: [] } },
    ];
    storedData['mpm:pending'] = JSON.stringify(pendingEvents);

    init({ service: 'persist-test', collector: 'http://oap:4318', flushInterval: 60_000 });
    await flush();

    const logPost = requestCalls.find((c) => c.url.includes('/v1/logs'));
    expect(logPost).toBeDefined();

    expect(storedData['mpm:pending']).toBe('');
    shutdown();
  });

  it('handles corrupted storage gracefully', () => {
    storedData['mpm:pending'] = '{invalid json';
    expect(() => {
      init({ service: 'persist-test', collector: 'http://oap:4318' });
    }).not.toThrow();
    shutdown();
  });

  it('drains accumulated request histogram on app hide', () => {
    let appHideCb: (() => void) | undefined;
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    wxAny.onAppHide = vi.fn((cb: () => void) => { appHideCb = cb; });

    let capturedRequest: { success?: (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void } | undefined;
    wxAny.request = vi.fn((opts: { success?: (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void }) => {
      capturedRequest = opts;
    });

    init({ service: 'persist-test', collector: 'http://oap:4318', flushInterval: 60_000 });

    const wx = (globalThis as unknown as { wx: { request: (o: Record<string, unknown>) => void } }).wx;
    wx.request({ url: 'https://api.example.com/x', method: 'GET', header: {}, success: () => {}, fail: () => {} });
    capturedRequest!.success!({ statusCode: 200, data: {}, header: {} });

    appHideCb!();

    expect(storedData['mpm:pending']).toBeDefined();
    const parsed = JSON.parse(storedData['mpm:pending']);
    const metricEvent = parsed.find((e: { kind: string }) => e.kind === 'metric');
    expect(metricEvent).toBeDefined();
    expect(metricEvent.payload[0].name).toBe('miniprogram.request.duration');
    shutdown();
  });
});
