const { flush } = require('mini-program-monitor');

Page({
  data: {},

  onThrowError() {
    throw new Error('demo: synchronous throw from button tap');
  },

  onRejectPromise() {
    Promise.reject(new Error('demo: unhandled promise rejection'));
  },

  onRequest() {
    my.request({
      url: 'https://httpbin.org/get',
      success: (res) => console.log('[demo] request status', res.status),
      fail: (e) => console.log('[demo] request failed', e),
    });
  },

  onFlush() {
    flush();
  },
});
