// Minimal fake `my` global for running the SDK with the Alipay adapter
// inside Node. Same pattern as fake-wx.mjs but uses Alipay API shapes
// (headers plural, status not statusCode, no getPerformance).

const noop = () => {};

const errorHandlers = [];
const rejectionHandlers = [];

delete globalThis.wx;

globalThis.my = {
  onError: (cb) => errorHandlers.push(cb),
  offError: noop,
  onUnhandledRejection: (cb) => rejectionHandlers.push(cb),
  offUnhandledRejection: noop,
  onAppShow: noop,
  offAppShow: noop,
  onAppHide: noop,
  offAppHide: noop,
  setStorageSync: noop,
  getStorageSync: () => ({ data: '' }),
  getSystemInfoSync: () => ({
    brand: 'node',
    model: 'harness',
    SDKVersion: '2.0.0',
    platform: 'devtools',
    system: 'linux',
  }),
  request: noop,
};

globalThis.App = noop;
globalThis.Page = noop;
globalThis.getCurrentPages = () => [{ route: 'pages/index/index' }];

export const fireError = (msg) => errorHandlers.forEach((cb) => cb(msg));
export const fireRejection = (r) => rejectionHandlers.forEach((cb) => cb(r));
