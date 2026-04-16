// Trace validation harness.
//
// Runs the SDK with tracing ENABLED against the mock-collector, which
// records segments at /v3/segments and exposes them via GET /receiveData.
// Uses the WeChat adapter (fake-wx) with a request that goes through
// the intercepted wx.request → sw8 header injection + segment creation.

import { fireError, firePerfEntries } from './fake-wx.mjs';

globalThis.wx.request = async ({ url, method, data, header, success, fail }) => {
  try {
    const res = await fetch(url, {
      method,
      body: data != null ? JSON.stringify(data) : undefined,
      headers: header,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    success?.({ statusCode: res.status, data: parsed, header: {} });
  } catch (e) {
    fail?.({ errMsg: String(e) });
  }
};

const { init, flush, shutdown } = await import('../../dist/index.mjs');

const COLLECTOR = process.env.COLLECTOR_URL ?? 'http://127.0.0.1:12801';

init({
  service: 'trace-e2e',
  serviceVersion: 'v0.1.0',
  serviceInstance: 'harness-trace-1',
  collector: COLLECTOR,
  platform: 'wechat',
  enable: {
    error: false,
    perf: false,
    request: true,
    tracing: true,
  },
  flushInterval: 60_000,
  debug: true,
});

// Make a traced request — goes through intercepted wx.request
// which injects sw8 header and creates a SegmentObject
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
  // OTLP /v1/* will 404 on mock-collector — that's expected,
  // we only care about /v3/segments here
  console.log('[harness-tracing] flush completed (OTLP 404s expected on mock-collector)');
}

await new Promise((r) => setTimeout(r, 2000));
shutdown();
console.log('[harness-tracing] done');
