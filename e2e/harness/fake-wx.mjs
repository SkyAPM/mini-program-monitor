// Minimal fake `wx` global for running the SDK inside Node.
//
// The harness does NOT simulate WeChat's runtime faithfully — it provides
// just enough surface for the SDK to import and for the Exporter interface
// to be exercised. Collectors that genuinely need wx.* callbacks (error,
// perf, network) land in M2+ and will grow this fake accordingly.

const noop = () => {};

globalThis.wx = {
  onError: noop,
  onUnhandledRejection: noop,
  onPageNotFound: noop,
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
