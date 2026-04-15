// Entry point for the Layer B e2e harness.
//
// Imports the compiled SDK and drives its real collectors and exporter
// against a running OAP container. The SDK's SkyWalkingExporter uses
// wx.request to POST — here we replace wx.request with a fetch-backed
// implementation so the same code path works in Node.
//
// Prerequisite: `npm run build` at the repo root so dist/index.mjs exists.

import { fakeWx, fireError } from './fake-wx.mjs';

fakeWx.request = async ({ url, method, data, header, success, fail }) => {
  try {
    const res = await fetch(url, {
      method,
      body: data != null ? JSON.stringify(data) : undefined,
      headers: header,
    });
    const text = await res.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* non-JSON body, keep as string */
    }
    success?.({ statusCode: res.status, data: parsed, header: {} });
  } catch (e) {
    fail?.({ errMsg: String(e) });
  }
};

const { init, flush, shutdown } = await import('../../dist/index.mjs');

const OAP = process.env.OAP_URL ?? 'http://127.0.0.1:12800';
const SERVICE = process.env.SERVICE ?? 'mini-program-e2e';

init({
  service: SERVICE,
  serviceInstance: 'harness-1',
  serviceVersion: 'v0.1.0-alpha.0',
  collector: OAP,
  flushInterval: 60_000,
  debug: true,
});

fireError('TypeError: e2e synthetic error\n    at pages/index/index.js:42:18');

try {
  await flush();
} catch (err) {
  console.error('[harness] flush failed:', err);
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1000));
shutdown();
console.log('[harness] done');
