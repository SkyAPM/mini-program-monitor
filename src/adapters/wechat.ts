import type { PlatformAdapter, AdapterRequestOpts, PerfHandle } from './types';

export function createWechatAdapter(): PlatformAdapter {
  const g = globalThis as { wx?: WechatMiniprogram.Wx };
  if (!g.wx) throw new Error('mini-program-monitor: wx global not found');
  const wx = g.wx;

  return {
    name: 'wechat',

    request(opts: AdapterRequestOpts) {
      wx.request({
        url: opts.url,
        method: opts.method as WechatMiniprogram.RequestOption['method'],
        data: opts.data as WechatMiniprogram.IAnyObject,
        header: opts.headers,
        success: (res) => opts.onSuccess(res.statusCode, res.data, res.header as Record<string, string>),
        fail: (err) => opts.onFail(err?.errMsg ?? 'wx.request failed'),
      });
    },

    onError: (cb) => (wx.onError as (cb: (msg: string) => void) => void)(cb),
    onUnhandledRejection: (cb) =>
      (wx.onUnhandledRejection as (cb: (res: { reason: unknown }) => void) => void)(cb),
    onPageNotFound: (cb) =>
      (wx.onPageNotFound as (cb: (res: { path: string }) => void) => void)(cb),

    onAppShow: (cb) => (wx.onAppShow as (cb: () => void) => void)(cb),
    onAppHide: (cb) => (wx.onAppHide as (cb: () => void) => void)(cb),

    hasPerformanceObserver: true,
    getPerformance: () => wx.getPerformance() as unknown as PerfHandle,

    getSystemInfoSync: () => {
      const info = wx.getSystemInfoSync();
      return { brand: info.brand, model: info.model, SDKVersion: info.SDKVersion, platform: info.platform, system: info.system };
    },

    setStorageSync: (key, data) => wx.setStorageSync(key, data),
    getStorageSync: (key) => wx.getStorageSync(key) as string,
  };
}
