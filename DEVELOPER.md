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
  core/               options, queue, scheduler (with preFlush hooks), sampler, histogram, resource builder
  adapters/           platform abstraction: wechat.ts, alipay.ts, detect.ts, types.ts
  collectors/         error (OTLP logs), perf (OTLP metrics), request (histogram + downloadFile/uploadFile + tracing)
  exporters/          otlp-http (proto + json), otlp-proto (encoder), proto-writer (wire format),
                      sw-trace (/v3/segments), composite, console
  shared/             log, time, base64, page, global helpers
  vendor/skywalking/  uuid.ts, constant.ts (vendored from skywalking-client-js)
  types/              options, events, OTLP wire types, SW segment types
test/                 vitest unit tests with wx/my mocks
example-wx/           WeChat mini-program for manual testing
example-alipay/       Alipay mini-program for manual testing
e2e/                  per-platform YAMLs + harnesses + verify scripts
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

The SDK posts OTLP to (default protobuf, `Content-Type: application/x-protobuf`; JSON on `encoding: 'json'`):
- `POST {collector}/v1/logs` — `ExportLogsServiceRequest`
- `POST {collector}/v1/metrics` — `ExportMetricsServiceRequest`

Proto bytes are produced by a hand-rolled, zero-dep encoder in [src/exporters/proto-writer.ts](src/exporters/proto-writer.ts) and [src/exporters/otlp-proto.ts](src/exporters/otlp-proto.ts). `fixed64` fields (timestamps, histogram counts) are derived from their decimal-string representation via long division so no BigInt is required.

SW trace segments are posted as JSON arrays to:
- `POST {collector}/v3/segments` — `SegmentObject[]`

### Request metric shape

`miniprogram.request.duration` is a **DELTA histogram** with explicit bounds `[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` ms. An in-memory aggregator ([src/core/histogram.ts](src/core/histogram.ts)) groups samples by attribute tuple (`http.request.method`, `http.response.status_code`, `server.address`, `miniprogram.page.path`, optional `url.path.group`). The `Scheduler` runs registered `onPreFlush` hooks before each flush and on app hide, so the pending aggregator is drained into the queue before persistence. `http.request.method` is the real HTTP verb for `wx.request`/`my.request`, and `DOWNLOAD`/`UPLOAD` for `wx.downloadFile`/`my.downloadFile`/`wx.uploadFile`/`my.uploadFile`.

## How testing works

### Layer 1 — unit tests (CI)

Vitest across `test/` — run `make test` (or `npm test`). Covers: adapters (wechat/alipay/detect), collectors (error/perf/request with and without tracing), exporters (otlp-http with encoding option, proto writer, proto encoder roundtrip via protobufjs dev-dep), core (queue/scheduler/options/histogram), persistence, and full integration (init→collect→flush→verify).

### Layer 2 — e2e (CI)

Split into two matrix jobs in `.github/workflows/e2e.yml`, one per platform, each driven by its own YAML:
- `e2e/e2e-wechat.yaml` — runs `harness/run.mjs` (OTLP) + `harness/run-tracing.mjs` (sw8 segments)
- `e2e/e2e-alipay.yaml` — runs `harness/run-alipay.mjs` (OTLP) + `harness/run-alipay-tracing.mjs` (sw8 segments)

Each job starts a standalone **OTel Collector** (port 4318, debug exporter) via `docker run`, then the infra-e2e-driven **mock-collector** (port 12801, skywalking-agent-test-tool) from `docker-compose.yml` to receive `/v3/segments`.

Verify scripts (grep OTel Collector debug logs for the expected OTLP fields):
- `check-otlp-wechat.mjs` / `check-otlp-alipay.mjs` — per-platform assertions including histogram shape
- `check-traces.mjs` / `check-traces-alipay.mjs` — per-platform assertions on mock-collector `/receiveData`

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

1. Update [CHANGES.md](./CHANGES.md) with the new version's entries.
2. `./scripts/release.sh <patch|minor>` (updates `package.json`, creates an annotated tag).
3. `git push --follow-tags`.
4. CI builds + publishes to npm (trusted publishing, requires npm ≥ 11.5.1).

## Changelog

Per-version release notes live in [CHANGES.md](./CHANGES.md).
