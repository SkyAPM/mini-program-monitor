import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAlipayAdapter } from '../../src/adapters/alipay';

beforeEach(() => {
  (globalThis as Record<string, unknown>).my = {
    request: vi.fn(),
    onError: vi.fn(),
    offError: vi.fn(),
    onUnhandledRejection: vi.fn(),
    offUnhandledRejection: vi.fn(),
    onAppShow: vi.fn(),
    offAppShow: vi.fn(),
    onAppHide: vi.fn(),
    offAppHide: vi.fn(),
    getSystemInfoSync: vi.fn(() => ({
      brand: 'alipay-test', model: 'sim', SDKVersion: '2.0.0', platform: 'devtools', system: 'iOS 17',
    })),
    setStorageSync: vi.fn(),
    getStorageSync: vi.fn(() => ({ data: 'stored-value' })),
  };
});

describe('alipay adapter', () => {
  it('maps request headers/status correctly', () => {
    const myRequest = (globalThis as Record<string, unknown>).my as Record<string, ReturnType<typeof vi.fn>>;
    myRequest.request.mockImplementation((opts: Record<string, unknown>) => {
      const success = opts.success as (r: { status: number; data: unknown; headers: Record<string, string> }) => void;
      success({ status: 200, data: {}, headers: { 'x-id': 'abc' } });
    });

    const adapter = createAlipayAdapter();
    let receivedCode = 0;
    let receivedHeaders: Record<string, string> = {};
    adapter.request({
      url: 'https://api.test/bar',
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
      onSuccess: (code, _data, headers) => {
        receivedCode = code;
        receivedHeaders = headers;
      },
      onFail: () => {},
    });

    const call = myRequest.request.mock.calls[0][0] as Record<string, unknown>;
    expect((call.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(receivedCode).toBe(200);
    expect(receivedHeaders['x-id']).toBe('abc');
  });

  it('does not have performance observer', () => {
    const adapter = createAlipayAdapter();
    expect(adapter.hasPerformanceObserver).toBe(false);
    expect(adapter.getPerformance).toBeUndefined();
  });

  it('does not have onPageNotFound', () => {
    const adapter = createAlipayAdapter();
    expect(adapter.onPageNotFound).toBeUndefined();
  });

  it('wraps setStorageSync with object-style API', () => {
    const adapter = createAlipayAdapter();
    adapter.setStorageSync('key1', 'val1');
    const myMock = (globalThis as Record<string, unknown>).my as Record<string, ReturnType<typeof vi.fn>>;
    expect(myMock.setStorageSync).toHaveBeenCalledWith({ key: 'key1', data: 'val1' });
  });

  it('wraps getStorageSync with object-style API', () => {
    const adapter = createAlipayAdapter();
    expect(adapter.getStorageSync('key1')).toBe('stored-value');
  });

  it('name is alipay', () => {
    const adapter = createAlipayAdapter();
    expect(adapter.name).toBe('alipay');
  });
});
