# Simulator

Two Docker images that drive realistic mini-program telemetry into any OTLP + SkyWalking backend. Use them for preview/demo, third-party integration testing, or as the e2e workload in CI.

- `ghcr.io/skyapm/mini-program-monitor/sim-wechat:<sha-or-version>`
- `ghcr.io/skyapm/mini-program-monitor/sim-alipay:<sha-or-version>`

There is intentionally no `:latest` tag. Every image is addressable by its full commit SHA; release builds additionally get the `vX.Y.Z` tag. Pin what you pull.

## Quickstart

```bash
SIM_TAG=<full-sha>    # e.g. 8f2a1b... or v0.3.0
docker run --rm \
  -e MODE=loop \
  -e SCENARIO=demo \
  -e COLLECTOR_URL=http://your-otlp-receiver:4318 \
  -e TRACE_COLLECTOR_URL=http://your-oap:12800 \
  ghcr.io/skyapm/mini-program-monitor/sim-wechat:$SIM_TAG
```

OTLP logs + metrics go to `COLLECTOR_URL`. SkyWalking trace segments go to `TRACE_COLLECTOR_URL` (`/v3/segments`). The image won't crash on unreachable collectors — it re-queues and retries until shutdown.

## Environment

| Var | Default | Notes |
|---|---|---|
| `MODE` | `loop` | `loop` runs forever; `timed` runs for `DURATION_MS` then exits clean; `once` fires one of each signal and exits (legacy CI parity). |
| `DURATION_MS` | — | Required when `MODE=timed`. |
| `SCENARIO` | `demo` | Scenario profile name: `demo`, `baseline`, `error-storm`, `slow-api`. |
| `ENCODING` | `proto` | `proto` or `json` — wire format for OTLP. Both are production code paths. |
| `COLLECTOR_URL` | `http://127.0.0.1:4318` | OTLP HTTP endpoint for logs + metrics. |
| `TRACE_COLLECTOR_URL` | `http://127.0.0.1:12801` | SkyWalking `/v3/segments` endpoint. |
| `SERVICE` | `mini-program-sim-<platform>` | `service.name` resource attribute. |
| `SERVICE_VERSION` | `sim` | `service.version`. |
| `SERVICE_INSTANCE` | random `sim-xxxx` | `service.instance.id`. |
| `DEBUG` | `false` | Verbose SDK logging to stdout. |

`SIGTERM` / `SIGINT` trigger a clean flush + shutdown.

## Scenarios

Each scenario is a JSON profile under `sim/<platform>/scenarios/`. Timers per signal type are independent with ±20% jitter.

| Scenario | Character |
|---|---|
| `demo` | Healthy traffic + **all four error surfaces** trigger at reasonable intervals (js ~45s, promise ~75s, pageNotFound ~2min *wechat-only*, manual ~3min). Good default for live dashboards. |
| `baseline` | Steady happy stream, minimal errors. |
| `error-storm` | High error rate + elevated 5xx responses — stresses log batching, populates error metrics. |
| `slow-api` | Heavy tail latency (1.5s–8s). Exercises upper histogram buckets and long trace segments. |

Alipay scenarios omit the `pageNotFound` block because Alipay's runtime doesn't expose `onPageNotFound`. Alipay perf simulation drives the SDK's lifecycle-timing fallback (M5) rather than a perf observer — the metric names emitted are identical.

## Fixtures

`sim/fixtures/*` and `sim/<platform>/fixtures/system-info.json` hold the data a scenario pulls from: URL pools, error stack traces, system info. They are **currently placeholders** — plausible but hand-crafted. See `sim/fixtures/README.md` for the scrubbing policy if you replace them with captured real-device data.

## Preview stack (one command)

From the repo root:

```bash
make preview
```

This builds both sim images at the current HEAD SHA, starts OAP + BanyanDB + UI + mock-collector + an OTel Collector forwarding to OAP, then starts both sims in `MODE=loop`. Browse `http://127.0.0.1:8080` — data populates within ~30s.

Stop with `make preview-down`.

## CI integration

The repo's `.github/workflows/e2e.yml` runs the same images in `MODE=timed` across a matrix of `{platform, scenario, encoding}` — 12 cells plus a `mixed-platforms` job. If you vendor the image into your own CI, the `timed` mode + a 15–20 s duration is a good smoke test against any OTLP/SW backend.
