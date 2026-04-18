const MOCK_URL = process.env.MOCK_COLLECTOR_URL ?? 'http://127.0.0.1:12801';
const SERVICE = process.env.SERVICE ?? 'mini-program-sim-wechat';

let data;
try {
  const res = await fetch(`${MOCK_URL}/receiveData`);
  data = await res.text();
} catch (e) {
  console.error('[verify-traces] cannot reach mock-collector:', e.message);
  process.exit(1);
}

let ok = true;
function assert(condition, msg) {
  if (!condition) {
    console.error(`[verify-traces] FAIL: ${msg}`);
    ok = false;
  } else {
    console.log(`[verify-traces] PASS: ${msg}`);
  }
}

assert(data.includes(SERVICE), `segment service name = ${SERVICE}`);
assert(data.includes('example.com'), 'span peer contains example.com');
assert(data.includes('Http'), 'span layer = Http');
assert(data.includes('Exit'), 'span type = Exit');
assert(data.includes('http.method'), 'span tag http.method present');
assert(data.includes('pages/'), 'span operationName has a page path');
assert(data.includes('miniprogram.platform') && data.includes('wechat'), 'span tag miniprogram.platform = wechat');

if (!ok) {
  console.error('\n[verify-traces] --- raw receiveData ---');
  console.error(data);
  process.exit(1);
}
console.log('[verify-traces] all trace checks passed');
