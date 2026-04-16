import type { PlatformAdapter, AdapterRequestOpts } from './types';

interface AlipayMy {
  request(opts: {
    url: string;
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
    dataType?: string;
    success?: (res: { status: number; data: unknown; headers: Record<string, string> }) => void;
    fail?: (err: { error?: number; errorMessage?: string }) => void;
    complete?: () => void;
  }): void;
  onError(cb: (msg: string) => void): void;
  offError(cb: (msg: string) => void): void;
  onUnhandledRejection(cb: (res: { reason: unknown }) => void): void;
  offUnhandledRejection(cb: (res: { reason: unknown }) => void): void;
  onAppShow(cb: () => void): void;
  offAppShow(cb: () => void): void;
  onAppHide(cb: () => void): void;
  offAppHide(cb: () => void): void;
  getSystemInfoSync(): { brand: string; model: string; SDKVersion: string; platform: string; system: string };
  setStorageSync(opts: { key: string; data: string }): void;
  getStorageSync(opts: { key: string }): { data: string };
}

export function createAlipayAdapter(): PlatformAdapter {
  const g = globalThis as { my?: AlipayMy };
  if (!g.my) throw new Error('mini-program-monitor: my global not found');
  const my = g.my;

  return {
    name: 'alipay',

    request(opts: AdapterRequestOpts) {
      my.request({
        url: opts.url,
        method: opts.method,
        data: opts.data,
        headers: opts.headers,
        success: (res) => opts.onSuccess(res.status, res.data, res.headers),
        fail: (err) => opts.onFail(err?.errorMessage ?? 'my.request failed'),
      });
    },

    onError: (cb) => my.onError(cb),
    onUnhandledRejection: (cb) => my.onUnhandledRejection(cb),
    // Alipay does not have onPageNotFound as a global API

    onAppShow: (cb) => my.onAppShow(cb),
    onAppHide: (cb) => my.onAppHide(cb),

    hasPerformanceObserver: false,

    getSystemInfoSync: () => my.getSystemInfoSync(),

    setStorageSync: (key, data) => my.setStorageSync({ key, data }),
    getStorageSync: (key) => my.getStorageSync({ key })?.data ?? '',
  };
}
