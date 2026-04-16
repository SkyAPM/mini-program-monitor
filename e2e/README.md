# E2E testing

End-to-end tests that run the compiled SDK in Node against real backend containers, verifying both WeChat and Alipay platforms.

## Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib` | 4318 | Receives OTLP metrics + logs, debug output for verification |
| `mock-collector` | `ghcr.io/apache/skywalking-agent-test-tool/mock-collector` | 12801 | Receives `/v3/segments`, exposes `/receiveData` YAML for trace validation |
| `oap` | `ghcr.io/apache/skywalking/oap` | 12800 | Kept for future OAP OTLP HTTP integration |
| `banyandb` | `ghcr.io/apache/skywalking-banyandb` | — | Storage for OAP |
| `ui` | `ghcr.io/apache/skywalking/ui` | 8080 | SkyWalking dashboard |

## Harnesses

| Harness | Platform | What it tests |
|---|---|---|
| `run.mjs` | WeChat | Error logs + perf metrics + request metrics via OTLP |
| `run-alipay.mjs` | Alipay | Error logs + request metrics via OTLP (lifecycle perf, no getPerformance) |
| `run-tracing.mjs` | WeChat | sw8 header injection + SegmentObject to mock-collector |

## Verification

| Script | Checks | Against |
|---|---|---|
| `check-otlp.mjs` | 13 checks | OTel Collector debug logs |
| `check-traces.mjs` | 6 checks | mock-collector `/receiveData` YAML |

## Running locally

```bash
npm ci        # from repo root
cd e2e
docker compose up -d
(cd .. && npm run build)
node harness/run.mjs
node harness/run-alipay.mjs
node harness/run-tracing.mjs
sleep 5
COMPOSE_DIR=. node verify/check-otlp.mjs
MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces.mjs
docker compose down
```

## CI

Runs via [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) on every push and PR to `main`, plus nightly. Uses `skywalking-infra-e2e` CLI to orchestrate setup → verify → cleanup.
