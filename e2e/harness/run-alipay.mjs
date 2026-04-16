// Alipay adapter e2e harness.
//
// Verifies the SDK works through the alipay adapter: error collector
// (no onPageNotFound), lifecycle-based perf (no getPerformance), and
// request collector via my.request.

import { fireError } from './fake-my.mjs';

// Patch my.request to use Node fetch
globalThis.my.request = async ({ url, method, data, headers, success, fail }) => {
  try {
    const res = await fetch(url, {
      method: method ?? 'GET',
      body: data != null ? JSON.stringify(data) : undefined,
      headers,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    success?.({ status: res.status, data: parsed, headers: {} });
  } catch (e) {
    fail?.({ errorMessage: String(e) });
  }
};

const { init, flush, shutdown } = await import('../../dist/index.mjs');

const COLLECTOR = process.env.COLLECTOR_URL ?? 'http://127.0.0.1:4318';
const SERVICE = process.env.SERVICE ?? 'alipay-e2e';

init({
  service: SERVICE,
  serviceVersion: 'v0.1.0-alpha.0',
  serviceInstance: 'harness-alipay-1',
  collector: COLLECTOR,
  platform: 'alipay',
  flushInterval: 60_000,
  debug: true,
});

// Fire error (Alipay has onError but no onPageNotFound)
fireError('Error: alipay test error\n  at pages/index/index.js:5');

// Make a request through patched my.request
await new Promise((resolve) => {
  globalThis.my.request({
    url: 'https://httpbin.org/get',
    method: 'GET',
    headers: {},
    success: () => resolve(),
    fail: () => resolve(),
  });
});

try {
  await flush();
} catch (err) {
  console.error('[harness-alipay] flush failed:', err);
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1000));
shutdown();
console.log('[harness-alipay] done');
