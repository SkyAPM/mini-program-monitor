// Entry point for the Layer B e2e harness.
//
// Runs the compiled SDK in Node with a fake wx global. The SDK's OTLP
// exporter uses wx.request (via the wechat adapter) — here we replace
// wx.request with a fetch-backed implementation so HTTP reaches the
// real OTel Collector and OAP containers.

import { fireError, firePerfEntries } from './fake-wx.mjs';

// Patch wx.request to use Node's global fetch
globalThis.wx.request = async ({ url, method, data, header, success, fail }) => {
  try {
    const body = data == null ? undefined
      : (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? data
      : JSON.stringify(data);
    const res = await fetch(url, {
      method,
      body,
      headers: header,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep as string */ }
    success?.({ statusCode: res.status, data: parsed, header: {} });
  } catch (e) {
    fail?.({ errMsg: String(e) });
  }
};

const { init, flush, shutdown } = await import('../../dist/index.mjs');

const COLLECTOR = process.env.COLLECTOR_URL ?? 'http://127.0.0.1:4318';
const SERVICE = process.env.SERVICE ?? 'mini-program-e2e';
const VERSION = process.env.SERVICE_VERSION ?? 'v0.1.0-alpha.0';

init({
  service: SERVICE,
  serviceVersion: VERSION,
  serviceInstance: 'harness-1',
  collector: COLLECTOR,
  platform: 'wechat',
  flushInterval: 60_000,
  debug: true,
});

// Fire synthetic perf entries → produces OTLP metrics via real perf collector
firePerfEntries([
  { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 1200, path: 'pages/index/index' },
  { name: 'firstRender', entryType: 'render', startTime: 200, duration: 400, path: 'pages/index/index' },
  { name: 'firstPaint', entryType: 'render', startTime: 300, duration: 0, path: 'pages/index/index' },
]);

// Fire error → produces OTLP log via real error collector
fireError('TypeError: e2e synthetic error\n    at pages/index/index.js:42:18');

// Make a request through the patched global wx.request.
// The SDK's interceptRequest has monkey-patched wx.request, so this
// call goes through the request collector wrapper which records
// timing + status as OTLP metrics.
await new Promise((resolve) => {
  globalThis.wx.request({
    url: 'https://httpbin.org/get',
    method: 'GET',
    header: {},
    success: () => resolve(),
    fail: () => resolve(),
  });
});

try {
  await flush();
} catch (err) {
  console.error('[harness] flush failed:', err);
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1000));
shutdown();
console.log('[harness] done');
