# Developer Guide

Internal docs for working on `mini-program-monitor`.

## Prerequisites

- Node.js ≥ 18
- Docker + Docker Compose — for e2e tests (OAP + BanyanDB + OTel Collector)
- WeChat Developer Tools (微信开发者工具) — required only for the `example/` app. Download: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>

## First-time setup

```bash
git clone https://github.com/SkyAPM/mini-program-monitor.git
cd mini-program-monitor
npm install
npm run build
npm test
```

## Repo layout

```
src/
  index.ts            public API: init, record, flush, shutdown
  core/               options, queue, scheduler, sampler, resource builder
  adapters/           platform abstraction: wechat.ts, alipay.ts, detect.ts, types.ts
  collectors/         error (OTLP logs), perf (OTLP metrics)
  exporters/          otlp-http (JSON over HTTP/1.1), console (debug)
  shared/             log, time helpers
  vendor/skywalking/  uuid.ts, constant.ts (vendored from skywalking-client-js)
  types/              options, events, OTLP JSON wire types
test/                 vitest unit tests with wx/my mocks
example/              WeChat mini-program for manual testing
e2e/                  docker-compose + harness + verify scripts
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` | One-shot build via tsup → `dist/{cjs,esm,d.ts}` |
| `npm run dev` | tsup watch mode |
| `npm test` | vitest unit tests |
| `npm run test:watch` | vitest watch |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

### Platform adapters

All platform-specific API calls (wx.*/my.*) go through `src/adapters/types.ts#PlatformAdapter`. This interface normalizes differences between WeChat and Alipay:

- `request()` — unifies `header`/`headers` and `statusCode`/`status` field name differences
- `onError()`, `onUnhandledRejection()` — same on both platforms
- `onPageNotFound()` — WeChat-only, optional on the interface
- `getPerformance()` — WeChat-only. Alipay has `hasPerformanceObserver: false` and the perf collector falls back to lifecycle-based timing.

Platform is auto-detected from `globalThis.wx` or `globalThis.my`, or explicitly set via `init({platform: 'alipay'})`.

### Signal flow

```
Collector          Event kind    Exporter path
──────────         ──────────    ─────────────
error collector  → kind:'log'  → OTLP POST /v1/logs
perf collector   → kind:'metric' → OTLP POST /v1/metrics
request collector → kind:'metric' → OTLP POST /v1/metrics  (planned M6)
tracing          → kind:'segment' → SW POST /v3/segments  (planned M7)
```

All events go through the same RingQueue → Scheduler → Exporter pipeline. The OTLP exporter groups by kind and posts logs and metrics in parallel.

### OTLP wire format

The SDK posts OTLP JSON (proto3 JSON mapping, `Content-Type: application/json`) to:
- `POST {collector}/v1/logs` — `ExportLogsServiceRequest`
- `POST {collector}/v1/metrics` — `ExportMetricsServiceRequest`

Types are defined in `src/types/otlp.ts`. Resource attributes include `service.name`, `service.version`, `miniprogram.platform`, `telemetry.sdk.name`, `telemetry.sdk.version`.

## How testing works

### Layer 1 — unit tests (CI)

Vitest, Node only. [test/setup.ts](test/setup.ts) injects a stub `wx` global before every test. All production code goes through the `PlatformAdapter` interface, so tests only mock the adapter.

### Layer 2 — e2e (CI)

Docker compose brings up OAP + BanyanDB + OTel Collector. The Node-based harness (`e2e/harness/run.mjs`) imports the compiled SDK with a fake `wx` global, fires synthetic perf entries and errors, flushes to the OTel Collector. A verify script (`e2e/verify/check-otlp.mjs`) reads the collector's debug logs and asserts expected metric names, log severity, and resource attributes.

```bash
cd e2e
docker compose up -d
(cd .. && npm run build)
node harness/run.mjs
sleep 5
COMPOSE_DIR=. node verify/check-otlp.mjs
docker compose down
```

### Layer 3 — manual in WeChat/Alipay simulator

The `example/` mini-program for hands-on testing. See [example/README.md](example/README.md).

## Adding a collector

1. Create `src/collectors/<name>.ts` with an `install(adapter, queue, options)` function.
2. The collector receives the `PlatformAdapter` and the central `RingQueue` — never reach for globals.
3. Wrap every callback body in try/catch and route exceptions to the `log` helper. Never re-throw.
4. Push events with the appropriate kind: `'log'` for OTLP logs, `'metric'` for OTLP metrics, `'segment'` for SW traces.
5. Register it in [src/index.ts](src/index.ts) behind an `enable.<name>` flag.
6. Add unit tests in `test/collectors/<name>.spec.ts`.

## Adding a platform adapter

1. Implement `PlatformAdapter` from [src/adapters/types.ts](src/adapters/types.ts).
2. Add auto-detection logic in [src/adapters/detect.ts](src/adapters/detect.ts).
3. Add a mock in [test/setup.ts](test/setup.ts).

## Vendored code

`src/vendor/skywalking/` contains `uuid.ts` and `constant.ts` copied from `apache/skywalking-client-js@636dda0`. These provide UUID generation and span layer/component constants for the future SW trace segment exporter. See `UPSTREAM.md` for bump procedure.

## Release process

1. Update `CHANGELOG.md`.
2. `npm version <patch|minor>` — tags + bumps `package.json`.
3. `git push --follow-tags`.
4. CI builds + publishes via `NPM_TOKEN`.
5. Before v0.1.0: delete local `legacy-v0` tag (`git tag -d legacy-v0`).

## Roadmap

- **M1** — skeleton: options, queue, scheduler, console exporter, unit tests
- **M2** — error collector + SkyWalking errorLogs exporter
- **M3** — perf collector + perfData exporter
- **M4** — OTLP refactor: platform adapters + OTLP HTTP/JSON exporter + OTel Collector e2e ← *current*
- **M5** — Alipay perf fallback (lifecycle-based timing)
- **M6** — Request metrics: patch wx.request/my.request, emit OTLP metrics
- **M7** — Tracing: sw8 injection + SW segment exporter (opt-in)
- **M8** — Storage-backed queue persistence + onAppHide flush
- **M9** — Example apps (WeChat + Alipay) + docs polish
- **M10** — v0.1.0 release
