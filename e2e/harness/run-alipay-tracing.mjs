// Alipay trace validation harness.
// Same as run-tracing.mjs but uses the Alipay adapter (fake my).

import { fireError } from './fake-my.mjs';

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

const COLLECTOR = process.env.COLLECTOR_URL ?? 'http://127.0.0.1:12801';

init({
  service: 'alipay-trace-e2e',
  serviceVersion: 'v0.1.0',
  serviceInstance: 'harness-alipay-trace-1',
  collector: COLLECTOR,
  platform: 'alipay',
  enable: {
    error: false,
    perf: false,
    request: true,
    tracing: true,
  },
  flushInterval: 60_000,
  debug: true,
});

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
  console.log('[harness-alipay-tracing] flush completed (OTLP errors expected on mock-collector)');
}

await new Promise((r) => setTimeout(r, 2000));
shutdown();
console.log('[harness-alipay-tracing] done');
