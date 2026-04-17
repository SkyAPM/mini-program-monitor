# E2E testing

End-to-end tests that run the compiled SDK in Node against real backend containers, verifying both WeChat and Alipay platforms.

## Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib` | 4318 | Receives OTLP metrics + logs, debug output for verification (started via `docker run`, not compose) |
| `mock-collector` | `ghcr.io/apache/skywalking-agent-test-tool/mock-collector` | 12801 | Receives `/v3/segments`, exposes `/receiveData` YAML for trace validation (via `docker-compose.yml`) |

An optional OAP + BanyanDB + UI stack lives in `docker-compose.oap.yml` (`make oap-up` / `make oap-down`) for manual exploration — it is not part of the default e2e path.

## Harnesses

| Harness | Platform | What it tests |
|---|---|---|
| `run.mjs` | WeChat | Error logs + perf metrics + request metrics via OTLP |
| `run-alipay.mjs` | Alipay | Error logs + request metrics via OTLP (lifecycle perf, no getPerformance) |
| `run-tracing.mjs` | WeChat | sw8 header injection + SegmentObject to mock-collector |
| `run-alipay-tracing.mjs` | Alipay | sw8 header injection + SegmentObject to mock-collector |

## Verification

| Script | Against |
|---|---|
| `check-otlp-wechat.mjs` / `check-otlp-alipay.mjs` | OTel Collector debug logs (per-platform OTLP shape) |
| `check-traces.mjs` / `check-traces-alipay.mjs` | mock-collector `/receiveData` (per-platform segment shape) |

## Running locally

```bash
# from repo root
make e2e          # build SDK, start mock-collector + otel-collector, run all harnesses, verify
make mock-backend-down   # stop when done
```

Or step by step, from the `e2e/` directory:

```bash
docker compose up -d                                 # mock-collector only
docker run -d --name otel-collector -p 4318:4318 \
  -v "$PWD/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml" \
  otel/opentelemetry-collector-contrib:latest        # otel-collector

(cd .. && npm run build)
COLLECTOR_URL=http://127.0.0.1:4318  node harness/run.mjs
COLLECTOR_URL=http://127.0.0.1:4318  node harness/run-alipay.mjs
COLLECTOR_URL=http://127.0.0.1:12801 node harness/run-tracing.mjs
COLLECTOR_URL=http://127.0.0.1:12801 node harness/run-alipay-tracing.mjs
sleep 5
node verify/check-otlp-wechat.mjs
node verify/check-otlp-alipay.mjs
MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces.mjs
MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces-alipay.mjs

docker rm -f otel-collector && docker compose down
```

## CI

Runs via [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) on every push and PR to `main`. Split into two matrix jobs, one per platform, each driven by `e2e-<platform>.yaml` through the `skywalking-infra-e2e` CLI.
