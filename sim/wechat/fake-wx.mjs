const noop = () => {};

const errorHandlers = [];
const rejectionHandlers = [];
const pageNotFoundHandlers = [];
const appShowHandlers = [];
const appHideHandlers = [];
const perfObservers = [];

let systemInfo = {
  brand: 'sim',
  model: 'sim-device',
  SDKVersion: '3.0.0',
  platform: 'devtools',
  system: 'sim',
};

let nextRequestSim = { latencyMs: 100, statusCode: 200 };
const realHosts = new Set();

const matchRealHost = (url) => {
  for (const h of realHosts) if (url.includes(h)) return true;
  return false;
};

globalThis.wx = {
  onError: (cb) => errorHandlers.push(cb),
  onUnhandledRejection: (cb) => rejectionHandlers.push(cb),
  onPageNotFound: (cb) => pageNotFoundHandlers.push(cb),
  onAppShow: (cb) => appShowHandlers.push(cb),
  onAppHide: (cb) => appHideHandlers.push(cb),
  onMemoryWarning: noop,
  onNetworkStatusChange: noop,
  setStorageSync: noop,
  getStorageSync: () => '',
  getSystemInfoSync: () => systemInfo,
  getPerformance: () => ({
    createObserver: (cb) => {
      perfObservers.push(cb);
      return { observe: noop, disconnect: noop };
    },
    getEntries: () => [],
  }),
  request: ({ url, method, data, header, success, fail }) => {
    if (matchRealHost(url)) {
      const body = data == null ? undefined
        : (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? data
        : typeof data === 'string' ? data
        : JSON.stringify(data);
      fetch(url, { method, body, headers: header })
        .then(async (res) => {
          const text = await res.text();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* keep */ }
          success?.({ statusCode: res.status, data: parsed, header: {}, cookies: [] });
        })
        .catch((e) => fail?.({ errMsg: String(e) }));
      return { abort: noop, onProgressUpdate: noop, offProgressUpdate: noop };
    }

    const { latencyMs, statusCode } = nextRequestSim;
    const task = { abort: noop, onProgressUpdate: noop, offProgressUpdate: noop };
    setTimeout(() => {
      try {
        success?.({ statusCode, data: { ok: statusCode < 400 }, header: {}, cookies: [] });
      } catch (e) {
        fail?.({ errMsg: String(e) });
      }
    }, latencyMs);
    return task;
  },
};

globalThis.getCurrentPages = () => [{ route: 'pages/index/index' }];

export const platformApi = {
  setSystemInfo: (info) => { systemInfo = { ...systemInfo, ...info }; },
  registerRealHost: (host) => realHosts.add(host),
  prepareRequestSim: (cfg) => { nextRequestSim = cfg; },
  request: (url, method) => {
    globalThis.wx.request({ url, method, header: {}, success: () => {}, fail: () => {} });
  },
  fireError: (stack) => errorHandlers.forEach((cb) => cb(stack)),
  fireRejection: (res) => rejectionHandlers.forEach((cb) => cb(res)),
  firePageNotFound: (res) => pageNotFoundHandlers.forEach((cb) => cb(res)),
  fireAppShow: () => appShowHandlers.forEach((cb) => cb()),
  fireAppHide: () => appHideHandlers.forEach((cb) => cb()),
  firePerfEntries: (entries) =>
    perfObservers.forEach((cb) => cb({ getEntries: () => entries })),
};
