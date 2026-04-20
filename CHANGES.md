# Changes

Per-version release notes for `mini-program-monitor`. Newest at the top.

## v0.4.0

### Changed

- **`serviceInstance` is no longer auto-generated.** Prior versions populated `service.instance.id` (OTLP) and segment `serviceInstance` (SkyWalking) with a per-session device id of the form `mp-{random}`. At mini-program scale this created one OAP instance entity per session, which swamped instance-level aggregation. The auto-generator is removed; `serviceInstance` now defaults to unset.
  - **OTLP wire behavior:** when `serviceInstance` is unset, the `service.instance.id` resource attribute is **omitted entirely** (spec-allowed — it's RECOMMENDED, not REQUIRED). OAP aggregates at the service level.
  - **SkyWalking segment wire behavior:** `serviceInstance` is a protocol-mandatory field, so the segment builder substitutes the literal `-` when unset. Same substitution applies inside the `sw8` header so downstream trace-join stays valid.
  - **Migration:** operators who need per-instance dimensionality should pass `init({ serviceInstance: '…' })` explicitly. Dashboards that previously filtered on `mp-*` instances will now see the signal aggregated at the service level.
  - **Recommended value when set:** treat `serviceInstance` as a **version-scoped identifier** — e.g. the same string as `service.version`, or a release tag — *not* a per-device id. Version-scoped instances let OAP aggregate at the release level, which is usually what release-tracking and regression dashboards actually want. CI e2e pins both `SERVICE_VERSION` and `SERVICE_INSTANCE` to the same value to mirror this recommended pattern.
- **`server.address` / segment `peer` sentinel changed from `unknown` to omitted / `-`.** When the request URL has no parseable `https?://host` prefix, OTLP now **omits** the `server.address` attribute on the request histogram and ajax error log, and SkyWalking segments substitute `-` for `peer` (again because the SW protocol requires a non-empty value). Dashboard queries that filtered or grouped on `server.address == "unknown"` need to union the old sentinel with the new behavior for any data that spans the v0.3 → v0.4 boundary.

## v0.3.0

### Added

- **`miniprogram.platform` span tag on SkyWalking trace segments.** OTLP logs and metrics already carried `miniprogram.platform` as a resource attribute, but segments (SkyWalking native protocol) had no equivalent — two mini-programs sharing a `service.name` were indistinguishable on the trace side. Every exit span now tags `miniprogram.platform: wechat | alipay` on both success and failure paths.
- **Per-platform SkyWalking component IDs on exit spans.** Previously every segment used `componentId: 10001` (the vendored "ajax" ID inherited from `skywalking-client-js`). The adapter interface now owns `componentId`: WeChat reports `10002`, Alipay reports `10003`. OAP's `component-libraries.yml` registration will follow; until the target OAP release lands, these IDs render as "N/A" in topology but the tag data is still captured.
- **Simulator ecosystem (`sim-wechat`, `sim-alipay`).** Two multi-arch (amd64 + arm64) Docker images published to `ghcr.io/skyapm/mini-program-monitor/sim-{wechat,alipay}:<sha>` drive realistic mini-program telemetry at any OTLP + SkyWalking backend. Three run modes (`loop`, `timed`, `once`), four scenarios (`demo`, `baseline`, `error-storm`, `slow-api`), both encodings. Used for our own CI e2e (a 12-cell `{platform × scenario × encoding}` matrix + a mixed-platforms concurrent job), `make preview` (full OAP + UI + both sims in loop mode for demo browsing), and third-party integration testing. Source under [`sim/`](./sim/); see [`sim/README.md`](./sim/README.md) and [`e2e/README.md`](./e2e/README.md). Replaces the previous harness-script e2e path.

### Docs

- Added [`docs/SIGNALS.md`](./docs/SIGNALS.md) and [`docs/SAMPLES.md`](./docs/SAMPLES.md): every metric name, log type, and trace-segment field the SDK emits, with concrete OTLP + SkyWalking JSON payloads. Shapes are verified against real captures from example-wx in WeChat DevTools and example-alipay in Alipay DevTools, so samples reflect actual wire data — real framework stack frames (`WASubContext.js` / `af-appx.worker.min.js`), per-platform `componentId`/`miniprogram.platform`, and the empty-stack quirk of Alipay's `my.onError` on synchronous throws.
- Fixed semantic drift: `miniprogram.first_paint.time` is a wall-clock epoch-millisecond **timestamp** (it's `PerformanceEntry.startTime`), not a duration like the other `*.duration` gauges. Called out in both the SIGNALS table and as its own SAMPLES example.

## v0.2.1

Docs-only follow-up to v0.2.0 so the npmjs.com package page reflects the current state.

- Drop the hand-maintained "Status: vX.Y released on npm, vZ.W in development" line from `README.md` — it rotted the moment v0.2.0 went out.

## v0.2.0

SDK-side feature work and correctness fixes on top of v0.1.0. No breaking API changes at the `init()` level.

### Added

- **OTLP protobuf encoding, default.** Hand-rolled zero-dep proto writer and OTLP encoder. `Content-Type: application/x-protobuf`. JSON encoding still available via `init({ encoding: 'json' })` for debugging.
- **Request duration as a delta histogram.** `miniprogram.request.duration` is now an OTLP DELTA histogram with explicit bounds `[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` ms, bucketed per flush interval. Replaces the per-request gauge point from v0.1 so per-domain p50/p95/p99 can be computed in the backend without high-cardinality labels.
- **Scheduler pre-flush hooks.** `Scheduler.onPreFlush(hook)` runs registered hooks before every flush and before persistence, so aggregator-held state (like the request histogram) makes it into the queue.
- **Download and upload instrumentation.** `wx.downloadFile` / `my.downloadFile` / `wx.uploadFile` / `my.uploadFile` are now wrapped by the request collector. They record into the same `miniprogram.request.duration` histogram, distinguished by `http.request.method = DOWNLOAD | UPLOAD`.

### Fixed

- **`shutdown()` is now a real teardown.** Every adapter hook and monkey-patch (`onError`, `onAppHide`, `interceptRequest`, `wrapApp`, `wrapPage`, …) returns an `Uninstall` function; `shutdown()` calls them all. Collectors bubble the uninstalls up to `init()`, so `init()` → `shutdown()` → `init()` restores the originals instead of stacking wrappers and leaking stale closures. Calling `init()` twice without an intervening `shutdown()` now tears the previous instance down automatically with a warning.
- **Alipay `miniprogram.app_launch.duration` fires even when `init()` runs inside `App.onLaunch`.** The lifecycle fallback now remembers the SDK install time; if `wrapApp.onLaunch`/`onShow` never fire (because `App({...})` had already been invoked), the first page's `onReady` emits an approximate launch duration using install-time as the origin. Subsequent `onReady`s do not re-emit.
- **Partial exporter failures no longer duplicate healthy-path data.** `Exporter.export` now returns the events it couldn't deliver (instead of throwing), and `CompositeExporter` intersects per-sub-exporter failure sets. The scheduler re-queues only the subset that actually failed, so an OTLP success + trace-segment failure doesn't re-send the logs/metrics on the next flush tick.
- **`record()` no longer accepts event kinds the exporters silently ignore.** `EventKind` narrowed from `'error' | 'perf' | 'metric' | 'log' | 'segment'` to `'log' | 'metric' | 'segment'`, so TypeScript catches the `record('error', ...)` / `record('perf', ...)` no-ops at the call site.
- **Wrapped `wx.request`/`downloadFile`/`uploadFile` no longer drop the native task.** The monkey-patched globals now return the real `RequestTask`/`DownloadTask`/`UploadTask`, so host-app code calling `.abort()`, `onProgressUpdate(...)`, or `onHeadersReceived(...)` keeps working after the SDK is enabled. Same fix on the Alipay side.
- **Proto encoder now handles gauge and sum.** The v0.2 proto exporter only wrote histogram metrics, so every perf gauge (`miniprogram.app_launch.duration`, `first_render.duration`, `first_paint.time`, …) was silently dropped under the default `encoding: 'proto'`. Gauge + Sum + NumberDataPoint encoders added, guarded by a protobufjs-based roundtrip test.
- **Platform auto-detection now actually runs.** `resolveOptions` used to hardcode `platform` to `'wechat'` when unset, so `detectPlatform` was always fed a hint and never probed `wx` vs `my`. On Alipay, omitting `platform: 'alipay'` would instantiate the WeChat adapter and fail. Detection is now the default.
- **Transient exporter failures no longer discard queued telemetry.** `Scheduler.flush` drained the queue before the POST, so a brief network error lost events forever (and they couldn't be recovered by app-hide persistence). On exporter rejection the events are re-queued, so the next flush tick retries.
- **Self-instrumentation skip is now endpoint-scoped.** The request collector previously skipped any URL starting with the configured collector root, which quietly excluded ordinary app traffic sharing that host. It now skips only the SDK's own endpoints (`/v1/logs`, `/v1/metrics`, `/v3/segments`).
- **Histogram data lost on app hide.** The `onAppHide` handler drained the queue directly and skipped `preFlush` hooks, so any request durations accumulated since the last flush were lost when the app was suspended. The handler now calls `Scheduler.collectPending()` which runs hooks then drains.
- **Alipay `getCurrentPages` was resolved off `_global`.** Alipay injects `getCurrentPages` into module scope rather than on the global, so the page-path helper returned `unknown`. Moved to `declare const getCurrentPages` so TS and the runtime both see it.
- **WeChat `MiniProgramError` wrapping.** Error strings of the shape `MiniProgramError\nError: real message` now unwrap to the inner message instead of reporting `MiniProgramError` as the exception text.

### Test hardening

- Integration tests exercise the default proto path end-to-end (decode via protobufjs), with a dedicated opt-in test covering `encoding: 'json'`. Previously every integration case passed `encoding: 'json'` and the default proto pipeline was untested.
- Options tests now split "apply defaults" from platform detection, and cover both the `wx`-present and `my`-only cases so a regression to a hardcoded platform default is caught.
- Request collector tests assert that the native `RequestTask`/`DownloadTask`/`UploadTask` is returned to the caller on every path, including the collector-URL skip path.

### CI / infra

- Split e2e into per-platform GitHub Actions matrix jobs (`wechat`, `alipay`), each driven by its own `e2e/e2e-<platform>.yaml`.
- Removed schedule + manual-dispatch triggers from e2e.
- npm ≥ 11.5.1 required in the release workflow for trusted publishing.
- Added project rule: typecheck + test must pass before push ([CLAUDE.md](./CLAUDE.md)).

## v0.1.0 (2026-03-30)

First npm release. Full telemetry stack for WeChat + Alipay mini-programs reporting to Apache SkyWalking.

### Core

- Public API: `init`, `record`, `flush`, `shutdown`.
- Ring-buffer queue with drop-oldest overflow (`maxQueue`, default 200).
- Interval scheduler (`flushInterval`, default 5000 ms).
- `onAppHide`-triggered persistence: pending events are written to `mpm:pending` storage and replayed on next `init()`.

### Platform adapters

- **WeChat** (`wx.*`): request, error, unhandled rejection, page-not-found, app show/hide, `wx.getPerformance()` + `PerformanceObserver`, storage.
- **Alipay** (`my.*`): request, error, unhandled rejection, app show/hide, lifecycle-based perf fallback (`App.onLaunch→onShow`, `Page.onLoad→onReady`), storage with `{ key, data }` shape normalization.
- Auto-detection of platform from the available global, with explicit `platform: 'wechat' | 'alipay'` override.

### Collectors

- **Error collector** → OTLP logs with OTel semantic conventions (`exception.type`, `exception.stacktrace`).
- **Perf collector** → OTLP gauge metrics for app launch, first render, first paint, route navigation, script execution, sub-package load.
- **Request collector** → per-request OTLP metric point by domain, plus error log on 4xx/5xx/timeout (`exception.type: ajax`).

### Exporters

- **OTLP HTTP/JSON** exporter posting to `/v1/logs` and `/v1/metrics` (`application/json`).
- **SkyWalking trace exporter** posting `SegmentObject[]` to `/v3/segments`.
- **Composite** exporter fanning out in parallel, plus a **console** exporter for local debugging.

### Distributed tracing (opt-in)

- `sw8` header injection on outgoing requests, with configurable sample rate and URL blacklist.
- Trace segment generation against the SkyWalking native protocol (vendored `uuid.ts`/`constant.ts` under `src/vendor/skywalking/`).

### Build + constraints

- Zero runtime dependencies. ES5 build target via `@swc/core` for compatibility with older JSCore/V8 variants.
- Dual CJS + ESM output, with `miniprogram` entry for WeChat's `Build npm` toolchain.
- No DOM or browser globals referenced anywhere in the SDK.

### Testing + examples

- Vitest unit suite with WeChat + Alipay mocks.
- E2E harnesses driving the real OTel Collector (OTLP verification) and the SkyWalking mock-collector (trace segment verification) for both platforms.
- Example apps: `example-wx/` and `example-alipay/` for manual testing in each vendor's DevTools.
