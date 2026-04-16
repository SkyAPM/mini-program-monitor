// Minimal fake `wx` global for running the SDK inside Node.
//
// Captures callbacks the SDK registers via the platform adapter so the
// harness can fire them on demand and drive real collectors end-to-end.
// wx.request is replaced by run.mjs with a fetch-backed implementation.

const noop = () => {};

const errorHandlers = [];
const rejectionHandlers = [];
const pageNotFoundHandlers = [];
const perfObservers = [];

globalThis.wx = {
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
    createObserver: (cb) => {
      perfObservers.push(cb);
      return { observe: noop, disconnect: noop };
    },
    getEntries: () => [],
  }),
  request: noop,
};

globalThis.getCurrentPages = () => [{ route: 'pages/index/index' }];

export const fireError = (msg) => errorHandlers.forEach((cb) => cb(msg));
export const fireRejection = (r) => rejectionHandlers.forEach((cb) => cb(r));
export const firePageNotFound = (r) => pageNotFoundHandlers.forEach((cb) => cb(r));
export const firePerfEntries = (entries) =>
  perfObservers.forEach((cb) => cb({ getEntries: () => entries }));
