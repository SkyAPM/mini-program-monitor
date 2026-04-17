import { describe, it, expect, vi, beforeEach } from 'vitest';
import { init, shutdown } from '../src/index';

beforeEach(() => {
  shutdown();
});

describe('shutdown', () => {
  it('restores wx.request to the original after shutdown', () => {
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    const originalRequest = wxAny.request;
    init({ service: 'svc', collector: 'http://otel:4318', flushInterval: 60_000 });
    expect(wxAny.request).not.toBe(originalRequest);
    shutdown();
    expect(wxAny.request).toBe(originalRequest);
  });

  it('calls wx.offError with the registered callback', () => {
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    let registered: unknown;
    let unregistered: unknown;
    wxAny.onError = (cb: unknown) => { registered = cb; };
    wxAny.offError = (cb: unknown) => { unregistered = cb; };

    init({ service: 'svc', collector: 'http://otel:4318', flushInterval: 60_000 });
    expect(registered).toBeTypeOf('function');
    shutdown();
    expect(unregistered).toBe(registered);
  });

  it('second init() after shutdown wraps a clean wx.request (no double-wrap)', () => {
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    const originalRequest = wxAny.request;
    init({ service: 'svc', collector: 'http://otel:4318', flushInterval: 60_000 });
    const afterFirst = wxAny.request;
    shutdown();
    init({ service: 'svc', collector: 'http://otel:4318', flushInterval: 60_000 });
    const afterSecond = wxAny.request;

    // afterFirst and afterSecond are both wrappers, not the same instance
    expect(afterFirst).not.toBe(afterSecond);
    // Both differ from the original
    expect(afterFirst).not.toBe(originalRequest);
    expect(afterSecond).not.toBe(originalRequest);
    shutdown();
    expect(wxAny.request).toBe(originalRequest);
  });

  it('init() called twice without shutdown tears down the previous instance', () => {
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    const originalRequest = wxAny.request;
    init({ service: 'a', collector: 'http://otel:4318', flushInterval: 60_000 });
    const first = wxAny.request;
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    init({ service: 'b', collector: 'http://otel:4318', flushInterval: 60_000 });
    const second = wxAny.request;
    consoleSpy.mockRestore();
    // Second init wraps fresh after tearing down the first.
    // first != second (different wrapper instances); second != original.
    expect(second).not.toBe(first);
    expect(second).not.toBe(originalRequest);
    shutdown();
    expect(wxAny.request).toBe(originalRequest);
  });
});
