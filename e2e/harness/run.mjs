// Entry point for the Layer B e2e harness.
//
// Runs the compiled SDK in a Node process with a fake wx global and a
// custom exporter that posts to a real OAP at OAP_URL. Emits one error
// event, then exits so the verify phase can query OAP for it via swctl.
//
// Prerequisite: `npm run build` in the repo root so dist/index.mjs exists.

import './fake-wx.mjs';
import { init, record, flush } from '../../dist/index.mjs';
import { HarnessSkyWalkingExporter } from './exporter.mjs';

const OAP = process.env.OAP_URL ?? 'http://127.0.0.1:12800';
const SERVICE = process.env.SERVICE ?? 'mini-program-e2e';

const exporter = new HarnessSkyWalkingExporter({
  collector: OAP,
  service: SERVICE,
});

init({
  service: SERVICE,
  serviceInstance: 'harness-1',
  collector: OAP,
  exporter,
  flushInterval: 60_000,
  debug: true,
});

record('error', {
  category: 'JS',
  grade: 'ERROR',
  message: 'e2e: synthetic TypeError from harness',
  stack: 'at pages/index/index.js:42:18',
  pagePath: 'pages/index/index',
  errorUrl: 'pages/index/index',
});

try {
  await flush();
} catch (err) {
  console.error('[harness] flush failed:', err);
  process.exit(1);
}

console.log('[harness] done');
