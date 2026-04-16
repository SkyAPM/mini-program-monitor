const { record, flush } = require('mini-program-monitor');

Page({
  data: {},

  onThrowError() {
    throw new Error('demo: synchronous throw from button tap');
  },

  onRejectPromise() {
    Promise.reject(new Error('demo: unhandled promise rejection'));
  },

  onRecordError() {
    record('log', {
      timeUnixNano: String(Date.now()) + '000000',
      severityNumber: 17,
      severityText: 'ERROR',
      body: { stringValue: 'demo: manually recorded error' },
      attributes: [
        { key: 'exception.type', value: { stringValue: 'manual' } },
        { key: 'miniprogram.page.path', value: { stringValue: 'pages/index/index' } },
      ],
    });
    flush();
  },

  onUnknownRoute() {
    // wx.onPageNotFound only fires for entry-point navigation (e.g. scanning
    // a QR code to a missing page), NOT for programmatic wx.navigateTo.
    // This button demonstrates that limitation — no OTLP log is emitted.
    wx.navigateTo({
      url: '/pages/does-not-exist/index',
      fail: (e) => console.log('[demo] navigate failed (onPageNotFound does NOT fire for programmatic navigation):', e.errMsg),
    });
  },

  onRequest() {
    wx.request({
      url: 'https://httpbin.org/get',
      success: (res) => console.log('[demo] request status', res.statusCode),
      fail: (e) => console.log('[demo] request failed', e),
    });
  },

  onFlush() {
    flush();
  },
});
