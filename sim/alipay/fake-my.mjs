const noop = () => {};

const errorHandlers = [];
const rejectionHandlers = [];
const appShowHandlers = [];
const appHideHandlers = [];

let appHooks = null;
let pageHooks = null;

let systemInfo = {
  brand: 'sim',
  model: 'sim-device',
  SDKVersion: '2.0.0',
  platform: 'devtools',
  system: 'sim',
};

let nextRequestSim = { latencyMs: 100, statusCode: 200 };
const realHosts = new Set();

const matchRealHost = (url) => {
  for (const h of realHosts) if (url.includes(h)) return true;
  return false;
};

delete globalThis.wx;

globalThis.my = {
  onError: (cb) => errorHandlers.push(cb),
  offError: noop,
  onUnhandledRejection: (cb) => rejectionHandlers.push(cb),
  offUnhandledRejection: noop,
  onAppShow: (cb) => appShowHandlers.push(cb),
  offAppShow: noop,
  onAppHide: (cb) => appHideHandlers.push(cb),
  offAppHide: noop,
  setStorageSync: noop,
  getStorageSync: () => ({ data: '' }),
  getSystemInfoSync: () => systemInfo,
  request: ({ url, method, data, headers, success, fail }) => {
    if (matchRealHost(url)) {
      const body = data == null ? undefined
        : (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? data
        : typeof data === 'string' ? data
        : JSON.stringify(data);
      fetch(url, { method, body, headers })
        .then(async (res) => {
          const text = await res.text();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* keep */ }
          success?.({ status: res.status, data: parsed, headers: {} });
        })
        .catch((e) => fail?.({ errorMessage: String(e) }));
      return;
    }

    const { latencyMs, statusCode } = nextRequestSim;
    setTimeout(() => {
      try {
        success?.({ status: statusCode, data: { ok: statusCode < 400 }, headers: {} });
      } catch (e) {
        fail?.({ errorMessage: String(e) });
      }
    }, latencyMs);
  },
  downloadFile: noop,
  uploadFile: noop,
};

globalThis.App = (opts) => { appHooks = opts; };
globalThis.Page = (opts) => { pageHooks = opts; };
globalThis.getCurrentPages = () => [{ route: 'pages/index/index' }];

export const platformApi = {
  setSystemInfo: (info) => { systemInfo = { ...systemInfo, ...info }; },
  registerRealHost: (host) => realHosts.add(host),
  prepareRequestSim: (cfg) => { nextRequestSim = cfg; },
  request: (url, method) => {
    globalThis.my.request({ url, method, headers: {}, success: () => {}, fail: () => {} });
  },
  fireError: (stack) => errorHandlers.forEach((cb) => cb(stack)),
  fireRejection: (res) => rejectionHandlers.forEach((cb) => cb(res)),
  fireAppShow: () => appShowHandlers.forEach((cb) => cb()),
  fireAppHide: () => appHideHandlers.forEach((cb) => cb()),
  fireLifecycleForPerf: ({ appLaunchMs, firstRenderMs, pagePath }) => {
    if (globalThis.App && typeof globalThis.App === 'function') {
      globalThis.App({ onLaunch: noop, onShow: noop });
    }
    appHooks?.onLaunch?.();
    setTimeout(() => {
      if (globalThis.Page && typeof globalThis.Page === 'function') {
        globalThis.Page({ onLoad: noop, onReady: noop, onShow: noop, onHide: noop });
      }
      pageHooks?.onLoad?.();
      pageHooks?.onReady?.();
    }, firstRenderMs);
  },
};
