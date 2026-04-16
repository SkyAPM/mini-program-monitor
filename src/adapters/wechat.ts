import type { PlatformAdapter, AdapterRequestOpts, PerfHandle, LifecycleHook } from './types';

function wrapConstructor(
  name: 'App' | 'Page',
  hooks: Record<string, LifecycleHook | undefined>,
): void {
  const g = globalThis as Record<string, unknown>;
  const original = g[name] as (opts: Record<string, unknown>) => void;
  if (typeof original !== 'function') return;

  g[name] = (opts: Record<string, unknown>) => {
    for (const [key, hook] of Object.entries(hooks)) {
      if (!hook) continue;
      const userFn = opts[key] as ((...args: unknown[]) => void) | undefined;
      opts[key] = function (this: unknown, ...args: unknown[]) {
        try {
          hook.call(this, ...args);
        } catch {
          // lifecycle hook must never crash
        }
        if (userFn) return userFn.call(this, ...args);
      };
    }
    return original(opts);
  };
}

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

    interceptRequest(wrapper) {
      const originalWx = wx.request.bind(wx);
      wx.request = ((reqOpts: WechatMiniprogram.RequestOption) => {
        const adapted: AdapterRequestOpts = {
          url: reqOpts.url,
          method: (reqOpts.method ?? 'GET') as string,
          data: reqOpts.data,
          headers: (reqOpts.header ?? {}) as Record<string, string>,
          onSuccess: (code, data, headers) =>
            reqOpts.success?.({ statusCode: code, data, header: headers } as WechatMiniprogram.RequestSuccessCallbackResult),
          onFail: (msg) =>
            reqOpts.fail?.({ errMsg: msg } as WechatMiniprogram.GeneralCallbackResult),
        };
        wrapper(
          (opts) => {
            originalWx({
              url: opts.url,
              method: opts.method as WechatMiniprogram.RequestOption['method'],
              data: opts.data as WechatMiniprogram.IAnyObject,
              header: opts.headers,
              success: (res) => opts.onSuccess(res.statusCode, res.data, res.header as Record<string, string>),
              fail: (err) => opts.onFail(err?.errMsg ?? 'wx.request failed'),
            });
          },
          adapted,
        );
      }) as typeof wx.request;
    },

    wrapApp: (hooks) => wrapConstructor('App', hooks),
    wrapPage: (hooks) => wrapConstructor('Page', hooks),

    getSystemInfoSync: () => {
      const info = wx.getSystemInfoSync();
      return { brand: info.brand, model: info.model, SDKVersion: info.SDKVersion, platform: info.platform, system: info.system };
    },

    setStorageSync: (key, data) => wx.setStorageSync(key, data),
    getStorageSync: (key) => wx.getStorageSync(key) as string,
  };
}
