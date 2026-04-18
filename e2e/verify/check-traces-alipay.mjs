const MOCK_URL = process.env.MOCK_COLLECTOR_URL ?? 'http://127.0.0.1:12801';
const SERVICE = process.env.SERVICE ?? 'mini-program-sim-alipay';

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
  if (!condition) { console.error(`[verify-traces] FAIL: ${msg}`); ok = false; }
  else { console.log(`[verify-traces] PASS: ${msg}`); }
}

assert(data.includes(SERVICE), `segment service name = ${SERVICE}`);
assert(data.includes('example.com'), 'span peer contains example.com');
assert(data.includes('Http'), 'span layer = Http');
assert(data.includes('Exit'), 'span type = Exit');
assert(data.includes('http.method'), 'span tag http.method present');
assert(data.includes('pages/'), 'span operationName has a page path');
assert(data.includes('miniprogram.platform') && data.includes('alipay'), 'span tag miniprogram.platform = alipay');

if (!ok) { console.error('\n--- raw receiveData ---\n', data); process.exit(1); }
console.log('[verify-traces] all Alipay trace checks passed');
