# Developer Guide

Internal docs for working on `mini-program-monitor`.

## Prerequisites

- Node.js ≥ 18
- Docker + Docker Compose — for e2e tests
- WeChat Developer Tools — for `example-wx/` app. Download: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
- Alipay Developer Tools — for `example-alipay/` app. Download: <https://opendocs.alipay.com/mini/ide/download>

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
  collectors/         error (OTLP logs), perf (OTLP metrics), request (OTLP metrics + tracing)
  exporters/          otlp-http (JSON), sw-trace (/v3/segments), composite, console
  shared/             log, time, base64 helpers
  vendor/skywalking/  uuid.ts, constant.ts (vendored from skywalking-client-js)
  types/              options, events, OTLP JSON wire types, SW segment types
test/                 vitest unit tests with wx/my mocks (73 tests, 15 files)
example-wx/              WeChat mini-program for manual testing
example-alipay/       Alipay mini-program for manual testing
e2e/                  docker-compose + harnesses + verify scripts
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

All platform-specific API calls go through `src/adapters/types.ts#PlatformAdapter`. Key differences normalized:

| API | WeChat | Alipay |
|---|---|---|
| Request headers field | `header` (singular) | `headers` (plural) |
| Response status field | `statusCode` | `status` |
| Performance API | `wx.getPerformance()` + observer | None — lifecycle fallback |
| Page not found | `wx.onPageNotFound` | Not available |
| Storage API | `wx.setStorageSync(key, data)` | `my.setStorageSync({key, data})` |

Platform is auto-detected from `globalThis.wx` or `globalThis.my`, or explicitly set via `init({platform: 'alipay'})`.

### Signal flow

```
Collector          Event kind      Exporter path
──────────         ──────────      ─────────────
error collector  → kind:'log'    → OTLP POST /v1/logs
perf collector   → kind:'metric' → OTLP POST /v1/metrics
request collector → kind:'metric' → OTLP POST /v1/metrics
request collector → kind:'segment' → SW POST /v3/segments (when tracing enabled)
```

All events go through the same RingQueue → Scheduler → Exporter pipeline. The composite exporter dispatches OTLP (metrics+logs) and SW trace (segments) in parallel.

### OTLP wire format

The SDK posts OTLP JSON (proto3 JSON mapping, `Content-Type: application/json`) to:
- `POST {collector}/v1/logs` — `ExportLogsServiceRequest`
- `POST {collector}/v1/metrics` — `ExportMetricsServiceRequest`

SW trace segments are posted as JSON arrays to:
- `POST {collector}/v3/segments` — `SegmentObject[]`

## How testing works

### Layer 1 — unit tests (CI)

73 tests across 15 files. Covers: adapters (wechat/alipay/detect), collectors (error/perf/request with and without tracing), exporters (otlp-http), core (queue/scheduler/options), persistence, and full integration (init→collect→flush→verify).

### Layer 2 — e2e (CI)

Docker compose brings up:
- **OTel Collector** — receives OTLP metrics + logs, debug output for verification
- **mock-collector** (skywalking-agent-test-tool) — receives `/v3/segments`, exposes `/receiveData` YAML
- **OAP + BanyanDB** — kept for future OAP OTLP HTTP integration

Three harnesses:
- `run.mjs` — WeChat adapter → OTLP (error + perf + request metrics)
- `run-alipay.mjs` — Alipay adapter → OTLP (error + request metrics, lifecycle perf)
- `run-tracing.mjs` — WeChat adapter with tracing enabled → sw8 + segments

Verify scripts:
- `check-otlp.mjs` — 13 checks against OTel Collector debug logs
- `check-traces.mjs` — 6 checks against mock-collector `/receiveData`

```bash
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

### Layer 3 — manual in WeChat/Alipay simulator

- `example-wx/` — WeChat, see [example-wx/README.md](example-wx/README.md)
- `example-alipay/` — Alipay, see [example-alipay/README.md](example-alipay/README.md)

## Adding a collector

1. Create `src/collectors/<name>.ts` with an `install(adapter, queue, options)` function.
2. Use the `PlatformAdapter` interface — never reach for globals.
3. Wrap every callback body in try/catch. Never re-throw.
4. Push events: `'log'` for OTLP logs, `'metric'` for OTLP metrics, `'segment'` for SW traces.
5. Register in [src/index.ts](src/index.ts) behind `enable.<name>`.
6. Add unit tests in `test/collectors/`.

## Adding a platform adapter

1. Implement `PlatformAdapter` from [src/adapters/types.ts](src/adapters/types.ts).
2. Add auto-detection logic in [src/adapters/detect.ts](src/adapters/detect.ts).
3. Add a mock in [test/setup.ts](test/setup.ts) and a fake for e2e in `e2e/harness/`.

## Release process

1. Update `CHANGELOG.md`.
2. `npm version <patch|minor>`.
3. `git push --follow-tags`.
4. CI builds + publishes via `NPM_TOKEN`.
5. Before v0.1.0: delete local `legacy-v0` tag (`git tag -d legacy-v0`).

## Roadmap

- **M1–M3** — skeleton, error collector, perf collector
- **M4** — OTLP refactor: platform adapters + OTLP HTTP/JSON exporter
- **M5** — Alipay perf fallback (lifecycle-based timing)
- **M6** — Request metrics collector
- **M7** — Distributed tracing: sw8 injection + SW segment exporter
- **M8** — Storage-backed queue persistence + onAppHide flush
- **M9** — Example apps + Alipay e2e + trace validation via mock-collector
- **M10** — v0.1.0 release ← *next*
