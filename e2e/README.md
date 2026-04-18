# E2E testing

End-to-end tests that run the SDK inside Docker sim images against real backend containers, verifying both WeChat and Alipay platforms across multiple scenarios and encodings.

## Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib` | 4318 | OTLP metrics + logs receiver. Debug exporter prints payloads for grep-based verification. |
| `mock-collector` | `ghcr.io/apache/skywalking-agent-test-tool/mock-collector` | 12801 | SkyWalking `/v3/segments` receiver. Exposes `/receiveData` YAML for trace validation. |
| `sim-wechat` / `sim-alipay` | built locally from `Dockerfile.sim` | — | SDK under test. Drives telemetry per scenario in `MODE=timed`. |

An optional full OAP + BanyanDB + UI stack lives in `docker-compose.oap.yml` (`make oap-up` / `make oap-down`) for preview/manual exploration. It is not part of the default e2e path.

## Verification scripts

| Script | Checks |
|---|---|
| `verify/check-otlp-wechat.mjs` | `docker logs otel-collector` contains expected WeChat-platform OTLP shape. `SERVICE` env overrides the resource assertion. |
| `verify/check-otlp-alipay.mjs` | Same for Alipay. |
| `verify/check-traces.mjs` | `/receiveData` on mock-collector contains WeChat trace segments with expected tags. |
| `verify/check-traces-alipay.mjs` | Same for Alipay. |

All checks are string-grep against accumulated backend state — fine because each CI matrix cell brings up a fresh compose stack.

## Running locally

```bash
make e2e                 # build sim images, bring up backends, run WeChat + Alipay sims, verify
make mock-backend-down   # stop when done
```

Ad-hoc single-scenario run (from the repo root):

```bash
make mock-backend-up
make sim-run-wechat SCENARIO=error-storm ENCODING=proto
sleep 5
node e2e/verify/check-otlp-wechat.mjs
MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node e2e/verify/check-traces.mjs
make mock-backend-down
```

## CI

Runs via [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) on every push and PR to `main`:

- **Matrix job (`sim`)** — `{platform} × {scenario} × {encoding}` = 12 cells. Each cell builds the sim image for its platform, starts a fresh backend stack, runs `MODE=timed DURATION_MS=20000`, verifies, tears down.
- **`mixed-platforms` job** — both sim containers run concurrently against a shared backend; asserts both services appear in OTLP + trace data.

No cross-cell state to reset because every job is a fresh compose up.

## Preview (optional, full OAP stack)

`make preview` brings up OAP + UI + mock-collector + OTel Collector + both sims in `MODE=loop`. Browse [http://127.0.0.1:8080](http://127.0.0.1:8080). Stop with `make preview-down`. See [sim/README.md](../sim/README.md).
