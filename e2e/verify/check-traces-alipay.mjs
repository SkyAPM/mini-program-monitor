const MOCK_URL = process.env.MOCK_COLLECTOR_URL ?? 'http://127.0.0.1:12801';

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

assert(data.includes('alipay-trace-e2e'), 'segment service name = alipay-trace-e2e');
assert(data.includes('httpbin.org'), 'span peer = httpbin.org');
assert(data.includes('Http'), 'span layer = Http');
assert(data.includes('Exit'), 'span type = Exit');
assert(data.includes('http.method'), 'span tag http.method present');
assert(data.includes('pages/index/index'), 'span operationName has page path');

if (!ok) { console.error('\n--- raw receiveData ---\n', data); process.exit(1); }
console.log('[verify-traces] all Alipay trace checks passed');
