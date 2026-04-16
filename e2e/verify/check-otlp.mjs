// Reads the OTel Collector's debug exporter output from docker compose
// logs and asserts that expected OTLP metrics and logs were received.
//
// The debug exporter (verbosity: detailed) logs metric names, resource
// attributes, log bodies, and severity. We grep for expected strings.

import { execSync } from 'node:child_process';

const COMPOSE_DIR = process.env.COMPOSE_DIR ?? '.';

let logs;
try {
  logs = execSync(`docker logs otel-collector 2>&1`, {
    encoding: 'utf-8',
    timeout: 10_000,
  });
} catch (e) {
  console.error('[verify] cannot read otel-collector logs:', e.message);
  process.exit(1);
}

let ok = true;
function assert(condition, msg) {
  if (!condition) {
    console.error(`[verify] FAIL: ${msg}`);
    ok = false;
  } else {
    console.log(`[verify] PASS: ${msg}`);
  }
}

// Metrics verification
assert(logs.includes('miniprogram.app_launch.duration'), 'metric miniprogram.app_launch.duration');
assert(logs.includes('miniprogram.first_render.duration'), 'metric miniprogram.first_render.duration');
assert(logs.includes('miniprogram.first_paint.time'), 'metric miniprogram.first_paint.time');

// Request metrics
assert(logs.includes('miniprogram.request.duration'), 'metric miniprogram.request.duration exists');

// Log verification
assert(logs.includes('SeverityText: ERROR'), 'log severity ERROR');
assert(logs.includes('TypeError'), 'log body contains TypeError');
assert(logs.includes('exception.type'), 'log has exception.type attribute');

// Resource verification — WeChat
assert(logs.includes('mini-program-e2e'), 'resource service.name = mini-program-e2e');
assert(logs.includes('miniprogram.platform'), 'resource has miniprogram.platform');
assert(logs.includes('Str(wechat)'), 'resource platform value = wechat');

// Alipay verification
assert(logs.includes('alipay-e2e'), 'alipay resource service.name = alipay-e2e');
assert(logs.includes('Str(alipay)'), 'alipay resource platform value = alipay');
assert(logs.includes('alipay test error'), 'alipay error log body present');

if (!ok) {
  console.error('\n[verify] --- full otel-collector logs ---');
  console.error(logs);
  process.exit(1);
}
console.log('[verify] all checks passed');
