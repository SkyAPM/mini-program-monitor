import { describe, it, expect, vi } from 'vitest';
import { createWechatAdapter } from '../../src/adapters/wechat';

describe('wechat adapter', () => {
  it('maps request header/statusCode correctly', () => {
    const wxRequest = vi.fn();
    const wxAny = (globalThis as unknown as { wx: Record<string, unknown> }).wx;
    wxAny.request = wxRequest;
    wxRequest.mockImplementation((opts: Record<string, unknown>) => {
      const success = opts.success as (r: { statusCode: number; data: unknown; header: Record<string, string> }) => void;
      success({ statusCode: 201, data: { ok: true }, header: { 'x-req-id': '123' } });
    });

    const adapter = createWechatAdapter();
    let receivedCode = 0;
    let receivedHeaders: Record<string, string> = {};
    adapter.request({
      url: 'https://api.test/foo',
      method: 'POST',
      data: { bar: 1 },
      headers: { 'Content-Type': 'application/json' },
      onSuccess: (code, _data, headers) => {
        receivedCode = code;
        receivedHeaders = headers;
      },
      onFail: () => {},
    });

    expect(wxRequest).toHaveBeenCalledOnce();
    const call = wxRequest.mock.calls[0][0];
    expect(call.header['Content-Type']).toBe('application/json');
    expect(receivedCode).toBe(201);
    expect(receivedHeaders['x-req-id']).toBe('123');
  });

  it('exposes onError/onUnhandledRejection/onPageNotFound', () => {
    const adapter = createWechatAdapter();
    expect(adapter.onError).toBeTypeOf('function');
    expect(adapter.onUnhandledRejection).toBeTypeOf('function');
    expect(adapter.onPageNotFound).toBeTypeOf('function');
  });

  it('has performance observer', () => {
    const adapter = createWechatAdapter();
    expect(adapter.hasPerformanceObserver).toBe(true);
    expect(adapter.getPerformance).toBeTypeOf('function');
  });

  it('name is wechat', () => {
    const adapter = createWechatAdapter();
    expect(adapter.name).toBe('wechat');
  });
});
