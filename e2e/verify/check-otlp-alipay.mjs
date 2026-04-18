import { execSync } from 'node:child_process';

const SERVICE = process.env.SERVICE ?? 'mini-program-sim-alipay';

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

assert(logs.includes('miniprogram.request.duration'), 'metric miniprogram.request.duration');
assert(logs.includes('DataType: Histogram'), 'request metric is a histogram');
assert(logs.includes('SeverityText: ERROR'), 'log severity ERROR');
assert(logs.includes('exception.type'), 'log has exception.type attribute');
assert(logs.includes(`Str(${SERVICE})`), `resource service.name = ${SERVICE}`);
assert(logs.includes('Str(alipay)'), 'resource platform = alipay');

if (!ok) { console.error('\n--- otel-collector logs ---\n', logs); process.exit(1); }
console.log('[verify] all Alipay OTLP checks passed');
