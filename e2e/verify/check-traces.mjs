// Reads collected segments from the mock-collector's /receiveData
// endpoint and validates segment structure.

const MOCK_URL = process.env.MOCK_COLLECTOR_URL ?? 'http://127.0.0.1:12801';

let data;
try {
  const res = await fetch(`${MOCK_URL}/receiveData`);
  const text = await res.text();
  data = text;
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

assert(data.includes('trace-e2e'), 'segment service name = trace-e2e');
assert(data.includes('httpbin.org'), 'span peer = httpbin.org');
assert(data.includes('Http'), 'span layer = Http');
assert(data.includes('Exit'), 'span type = Exit');
assert(data.includes('http.method'), 'span tag http.method present');
assert(data.includes('GET'), 'span tag http.method value = GET');
assert(data.includes('pages/index/index'), 'span operationName has page path (not unknown)');

if (!ok) {
  console.error('\n[verify-traces] --- raw receiveData ---');
  console.error(data);
  process.exit(1);
}
console.log('[verify-traces] all trace checks passed');
