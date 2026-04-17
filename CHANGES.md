# Changes

Per-version release notes for `mini-program-monitor`. Newest at the top.

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
