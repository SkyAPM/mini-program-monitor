import { _global } from '../shared/global';
import type { PlatformAdapter, AdapterRequestOpts, LifecycleHook } from './types';

function wrapConstructor(
  name: 'App' | 'Page',
  hooks: Record<string, LifecycleHook | undefined>,
): void {
  const g = (_global) as Record<string, unknown>;
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
  downloadFile(opts: {
    url: string;
    header?: Record<string, string>;
    success?: (res: { apFilePath?: string; tempFilePath?: string; statusCode?: number }) => void;
    fail?: (err: { error?: number; errorMessage?: string }) => void;
  }): void;
  uploadFile(opts: {
    url: string;
    filePath: string;
    fileName?: string;
    fileType?: string;
    header?: Record<string, string>;
    formData?: Record<string, unknown>;
    success?: (res: { data: string; statusCode?: number }) => void;
    fail?: (err: { error?: number; errorMessage?: string }) => void;
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

// Alipay injects `my` into each module's scope. Declare it so TS
// doesn't complain, and reference it directly (not via Function()
// which runs in a clean scope without module-injected variables).
declare const my: AlipayMy | undefined;

export function createAlipayAdapter(): PlatformAdapter {
  if (typeof my === 'undefined') {
    throw new Error('mini-program-monitor: my global not found');
  }

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

    interceptRequest(wrapper) {
      const originalMy = my.request.bind(my);
      my.request = ((reqOpts: Parameters<typeof my.request>[0]) => {
        const adapted: AdapterRequestOpts = {
          url: reqOpts.url,
          method: reqOpts.method ?? 'GET',
          data: reqOpts.data,
          headers: (reqOpts.headers ?? {}) as Record<string, string>,
          onSuccess: (code, data, headers) =>
            reqOpts.success?.({ status: code, data, headers }),
          onFail: (msg) =>
            reqOpts.fail?.({ errorMessage: msg }),
        };
        wrapper(
          (opts) => {
            originalMy({
              url: opts.url,
              method: opts.method,
              data: opts.data,
              headers: opts.headers,
              success: (res) => opts.onSuccess(res.status, res.data, res.headers),
              fail: (err) => opts.onFail(err?.errorMessage ?? 'my.request failed'),
            });
          },
          adapted,
        );
      }) as typeof my.request;
    },

    interceptDownloadFile(wrapper) {
      if (typeof my.downloadFile !== 'function') return;
      const originalDl = my.downloadFile.bind(my);
      my.downloadFile = ((dlOpts: Parameters<typeof my.downloadFile>[0]) => {
        const adapted: AdapterRequestOpts = {
          url: dlOpts.url,
          method: 'DOWNLOAD',
          headers: (dlOpts.header ?? {}) as Record<string, string>,
          onSuccess: (code, data) =>
            dlOpts.success?.({
              statusCode: code,
              apFilePath: (data as { apFilePath?: string })?.apFilePath,
              tempFilePath: (data as { tempFilePath?: string })?.tempFilePath,
            }),
          onFail: (msg) => dlOpts.fail?.({ errorMessage: msg }),
        };
        wrapper(
          (opts) => {
            originalDl({
              url: opts.url,
              header: opts.headers,
              success: (res) => opts.onSuccess(res.statusCode ?? 200, { apFilePath: res.apFilePath, tempFilePath: res.tempFilePath }, {}),
              fail: (err) => opts.onFail(err?.errorMessage ?? 'my.downloadFile failed'),
            });
          },
          adapted,
        );
      }) as typeof my.downloadFile;
    },

    interceptUploadFile(wrapper) {
      if (typeof my.uploadFile !== 'function') return;
      const originalUp = my.uploadFile.bind(my);
      my.uploadFile = ((upOpts: Parameters<typeof my.uploadFile>[0]) => {
        const adapted: AdapterRequestOpts = {
          url: upOpts.url,
          method: 'UPLOAD',
          data: { filePath: upOpts.filePath, fileName: upOpts.fileName, fileType: upOpts.fileType },
          headers: (upOpts.header ?? {}) as Record<string, string>,
          onSuccess: (code, data) =>
            upOpts.success?.({ statusCode: code, data: typeof data === 'string' ? data : '' }),
          onFail: (msg) => upOpts.fail?.({ errorMessage: msg }),
        };
        wrapper(
          (opts) => {
            originalUp({
              url: opts.url,
              filePath: upOpts.filePath,
              fileName: upOpts.fileName,
              fileType: upOpts.fileType,
              header: opts.headers,
              formData: upOpts.formData,
              success: (res) => opts.onSuccess(res.statusCode ?? 200, res.data, {}),
              fail: (err) => opts.onFail(err?.errorMessage ?? 'my.uploadFile failed'),
            });
          },
          adapted,
        );
      }) as typeof my.uploadFile;
    },

    hasPerformanceObserver: false,

    wrapApp: (hooks) => wrapConstructor('App', hooks),
    wrapPage: (hooks) => wrapConstructor('Page', hooks),

    getSystemInfoSync: () => my.getSystemInfoSync(),

    setStorageSync: (key, data) => my.setStorageSync({ key, data }),
    getStorageSync: (key) => my.getStorageSync({ key })?.data ?? '',
  };
}
