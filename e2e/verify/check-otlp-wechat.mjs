import { execSync } from 'node:child_process';

let logs;
try {
  logs = execSync('docker logs otel-collector 2>&1', { encoding: 'utf-8', timeout: 10_000 });
} catch (e) {
  console.error('[verify] cannot read otel-collector logs:', e.message);
  process.exit(1);
}

let ok = true;
function assert(condition, msg) {
  if (!condition) { console.error(`[verify] FAIL: ${msg}`); ok = false; }
  else { console.log(`[verify] PASS: ${msg}`); }
}

assert(logs.includes('miniprogram.app_launch.duration'), 'metric miniprogram.app_launch.duration');
assert(logs.includes('miniprogram.first_render.duration'), 'metric miniprogram.first_render.duration');
assert(logs.includes('miniprogram.first_paint.time'), 'metric miniprogram.first_paint.time');
assert(logs.includes('miniprogram.request.duration'), 'metric miniprogram.request.duration');
assert(logs.includes('DataType: Histogram'), 'request metric is a histogram');
assert(logs.includes('HistogramDataPoints'), 'histogram data points present');
assert(logs.includes('SeverityText: ERROR'), 'log severity ERROR');
assert(logs.includes('TypeError'), 'log body contains TypeError');
assert(logs.includes('exception.type'), 'log has exception.type attribute');
assert(logs.includes('Str(mini-program-e2e)'), 'resource service.name = mini-program-e2e');
assert(logs.includes('Str(wechat)'), 'resource platform = wechat');

if (!ok) { console.error('\n--- otel-collector logs ---\n', logs); process.exit(1); }
console.log('[verify] all WeChat OTLP checks passed');
