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
docs/                 SIGNALS.md + SAMPLES.md (per-signal wire reference)
example-wx/           WeChat mini-program for manual testing
example-alipay/       Alipay mini-program for manual testing
sim/                  sim-wechat / sim-alipay — dockerized simulators
                      that drive realistic telemetry at any OTLP + SW backend
Dockerfile.sim        single Dockerfile, ARG PLATFORM=wechat|alipay
e2e/                  compose files (mock-collector, optional OAP),
                      otel-collector configs, verify scripts
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` / `make build` | One-shot build via tsup → `dist/{cjs,esm,d.ts}` |
| `npm run dev` | tsup watch mode |
| `npm test` / `make test` | vitest unit tests |
| `npm run test:watch` | vitest watch |
| `npm run typecheck` / `make typecheck` | `tsc --noEmit` |
| `make mock-backend-up` / `-down` | Bring up/down mock-collector (compose) + OTel Collector (`docker run`) |
| `make sim-build` | Build `sim-wechat` + `sim-alipay` images locally |
| `make sim-run-wechat` / `-alipay` | Run a single sim image against `127.0.0.1` backends (`SCENARIO=... ENCODING=...` override) |
| `make preview` / `make preview-down` | Full OAP + UI + mock-collector + OTel Collector + both sims in loop mode; browse `http://127.0.0.1:8080` |
| `make e2e` | Build sims + backends, run baseline scenario for both platforms, verify |
| `make release` | Tag + bump workflow (see Release process) |

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

For the full per-signal enumeration (attributes, semantic conventions, sample payloads) see [docs/SIGNALS.md](./docs/SIGNALS.md) and [docs/SAMPLES.md](./docs/SAMPLES.md).

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

### Layer 2 — e2e (CI, matrix over sim images)

[`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml) has two jobs:

- **`sim`** — `{platform: [wechat, alipay]} × {scenario: [baseline, error-storm, slow-api]} × {encoding: [proto, json]}` = 12 cells. Each cell builds its `sim-<platform>` image locally from [`Dockerfile.sim`](./Dockerfile.sim), boots a fresh `mock-collector` (compose) + `otel-collector` (`docker run`), runs the sim in `MODE=timed DURATION_MS=20000`, then greps `docker logs otel-collector` and `/receiveData` for the expected payloads.
- **`mixed-platforms`** — boots both sims concurrently against a shared backend, asserts both `service.name`s + both `miniprogram.platform` tag values land in OTLP + segment data. Catches cross-platform regressions.

Verify scripts under [`e2e/verify/`](./e2e/verify) (grep-based, accept `SERVICE` env overrides):

- `check-otlp-wechat.mjs` / `check-otlp-alipay.mjs` — OTel Collector debug output, per-platform signal shape + histogram presence.
- `check-traces.mjs` / `check-traces-alipay.mjs` — mock-collector `/receiveData`, segment shape + `miniprogram.platform` + `componentId` tag.

Multi-arch sim images (`linux/amd64`, `linux/arm64`) are published to GHCR on every push to `main` and on version tags by [`.github/workflows/sim-publish.yml`](./.github/workflows/sim-publish.yml). SHA-tagging policy — no `:latest`, no `:edge` — so third parties and the `make preview` compose file can pin to a specific build. See [`sim/README.md`](./sim/README.md) for sim env vars and scenarios.

### Layer 3 — preview / demo (local, full OAP stack)

`make preview` brings up OAP + UI + mock-collector + OTel Collector (forwarding OTLP into OAP) + both sims in `MODE=loop`. Browse `http://127.0.0.1:8080` to see both services land in topology. `make preview-down` to stop.

### Layer 4 — manual in WeChat/Alipay simulator

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

1. Implement `PlatformAdapter` from [src/adapters/types.ts](src/adapters/types.ts), including its `componentId` (needs a dedicated value in OAP's `component-libraries.yml` — coordinate upstream before shipping).
2. Add auto-detection logic in [src/adapters/detect.ts](src/adapters/detect.ts).
3. Add a mock in [test/setup.ts](test/setup.ts) and a sim fake under `sim/<platform>/fake-<global>.mjs` + entrypoint + per-scenario fixtures (copy the shape from `sim/wechat/` or `sim/alipay/`).
4. Add the platform to the e2e matrix in [`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml) and to `sim-publish.yml`.

## Release process

1. Update [CHANGES.md](./CHANGES.md) with the new version's entries under a `## vX.Y.Z` heading. Entries must be finalized before tagging — the release workflow copies the matching section verbatim into the GitHub Release page, it is not edited at tag time.
2. `make release` (wraps `scripts/release.sh`): bumps `package.json`, creates the `vX.Y.Z` annotated tag, and advances to the next `X.Y+1.0-dev` on `main`.
3. `git push origin main --follow-tags` (or `git push origin main && git push origin vX.Y.Z`).
4. The [`Release`](./.github/workflows/release.yml) workflow triggers on the `vX.Y.Z` tag and:
   - runs `make build` + `make test`,
   - extracts the `## vX.Y.Z` section from `CHANGES.md` into release notes,
   - publishes to npm with provenance (trusted publishing, npm ≥ 11.5.1),
   - creates the GitHub Release page with those notes attached.

## Changelog

Per-version release notes live in [CHANGES.md](./CHANGES.md).
