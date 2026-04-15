// Minimal fake `wx` global for running the SDK inside Node.
//
// Captures the callbacks the SDK registers via wx.onError / onUnhandledRejection
// / onPageNotFound so the harness can fire them on demand and drive the real
// collectors end-to-end. wx.request starts as a noop and is expected to be
// replaced by run.mjs with a fetch-backed implementation that forwards HTTP
// to the real OAP container.

const noop = () => {};

const errorHandlers = [];
const rejectionHandlers = [];
const pageNotFoundHandlers = [];

export const fakeWx = {
  onError: (cb) => errorHandlers.push(cb),
  onUnhandledRejection: (cb) => rejectionHandlers.push(cb),
  onPageNotFound: (cb) => pageNotFoundHandlers.push(cb),
  onAppHide: noop,
  onAppShow: noop,
  onMemoryWarning: noop,
  onNetworkStatusChange: noop,
  setStorageSync: noop,
  getStorageSync: () => '',
  getSystemInfoSync: () => ({
    brand: 'node',
    model: 'harness',
    SDKVersion: '3.0.0',
    platform: 'devtools',
    system: 'linux',
  }),
  getPerformance: () => ({
    createObserver: () => ({ observe: noop, disconnect: noop }),
    getEntries: () => [],
  }),
  request: noop,
};

globalThis.wx = fakeWx;
globalThis.getCurrentPages = () => [{ route: 'pages/index/index' }];

export const fireError = (msg) => errorHandlers.forEach((cb) => cb(msg));
export const fireRejection = (r) => rejectionHandlers.forEach((cb) => cb(r));
export const firePageNotFound = (r) => pageNotFoundHandlers.forEach((cb) => cb(r));
