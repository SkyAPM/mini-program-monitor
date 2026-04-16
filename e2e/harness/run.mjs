// Entry point for the Layer B e2e harness.
//
// Imports the compiled SDK and drives its real collectors and exporter
// against a running OAP container. The SDK's SkyWalkingExporter uses
// wx.request to POST — here we replace wx.request with a fetch-backed
// implementation so the same code path works in Node.
//
// Important: OAP requires a BrowserPerfData POST to register the
// service in the BROWSER layer inventory before error logs become
// queryable. This harness sends perfData first, then fires an error
// through the SDK's real error collector.
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

const OAP = process.env.OAP_URL ?? 'http://127.0.0.1:12800';
const SERVICE = process.env.SERVICE ?? 'mini-program-e2e';
const VERSION = process.env.SERVICE_VERSION ?? 'v0.1.0-alpha.0';

// Step 1: Register the browser service by posting BrowserPerfData.
// Without this, error logs are ingested but the service doesn't
// appear in `browser service ls` because OAP's BROWSER layer
// inventory is populated only by perfData, not errorLogs.
const perfData = {
  service: SERVICE,
  serviceVersion: VERSION,
  pagePath: 'pages/index/index',
  redirectTime: 0,
  dnsTime: 0,
  ttfbTime: 100,
  tcpTime: 0,
  transTime: 50,
  domAnalysisTime: 30,
  fptTime: 200,
  domReadyTime: 300,
  loadPageTime: 500,
  resTime: 50,
  sslTime: 0,
  ttlTime: 400,
  firstPackTime: 80,
  fmpTime: 250,
};

const perfRes = await fetch(`${OAP}/browser/perfData`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(perfData),
});
console.log(`[harness] perfData → ${perfRes.status}`);
if (!perfRes.ok) {
  console.error('[harness] perfData POST failed:', await perfRes.text());
  process.exit(1);
}

// Step 2: Init the SDK and fire an error through the real collector.
const { init, flush, shutdown } = await import('../../dist/index.mjs');

init({
  service: SERVICE,
  serviceInstance: 'harness-1',
  serviceVersion: VERSION,
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
