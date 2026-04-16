// Entry point for the Layer B e2e harness.
//
// Imports the compiled SDK and drives its real collectors and exporter
// against a running OAP container. The SDK's SkyWalkingExporter uses
// wx.request to POST — here we replace wx.request with a fetch-backed
// implementation so the same code path works in Node.
//
// The harness fires synthetic perf entries (to register the browser
// service in OAP) and an error (to verify error log ingestion), then
// flushes and exits.
//
// Prerequisite: `npm run build` at the repo root so dist/index.mjs exists.

import { fakeWx, fireError, firePerfEntries } from './fake-wx.mjs';

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
const VERSION = process.env.SERVICE_VERSION ?? 'v0.1.0-alpha.0';

init({
  service: SERVICE,
  serviceInstance: 'harness-1',
  serviceVersion: VERSION,
  collector: OAP,
  flushInterval: 60_000,
  debug: true,
});

// Fire synthetic perf entries through the real perf collector.
// The appLaunch + firstRender entries produce a BrowserPerfData POST
// that registers the browser service in OAP's inventory.
firePerfEntries([
  { name: 'appLaunch', entryType: 'navigation', startTime: 0, duration: 1200, path: 'pages/index/index' },
  { name: 'firstRender', entryType: 'render', startTime: 200, duration: 400, path: 'pages/index/index' },
  { name: 'firstPaint', entryType: 'render', startTime: 300, duration: 0, path: 'pages/index/index' },
]);

// Fire an error through the real error collector.
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
