# Signals reference

What `mini-program-monitor` emits, where it goes, and what's on each signal. For concrete wire payloads, see [SAMPLES.md](./SAMPLES.md).

## Transport

| Signal kind | Endpoint | Protocol | Content-Type |
|---|---|---|---|
| Logs | `POST {collector}/v1/logs` | OTLP | `application/x-protobuf` (default) or `application/json` |
| Metrics | `POST {collector}/v1/metrics` | OTLP | `application/x-protobuf` (default) or `application/json` |
| Trace segments | `POST {traceCollector}/v3/segments` | SkyWalking native | `application/json` |

Encoding is selected per `init({ encoding: 'proto' \| 'json' })`; default is proto. SkyWalking segments are always JSON.

## Resource attributes

Every OTLP payload (logs + metrics) carries the same resource attributes, built once at `init()`.

| Key | Example | Source |
|---|---|---|
| `service.name` | `my-mini-program` | `init.service` |
| `service.version` | `v1.2.0` | `init.serviceVersion` (default `v0.0.0`) |
| `service.instance.id` | `instance-uuid` | `init.serviceInstance`; **attribute omitted entirely when unset** (per-device auto-generation was dropped in v0.4.0 because device-cardinality swamps OAP instance aggregation) |
| `telemetry.sdk.name` | `mini-program-monitor` | hardcoded |
| `telemetry.sdk.version` | `<current SDK version>` | SDK build-time constant from `package.json#version` |
| `miniprogram.platform` | `wechat` or `alipay` | auto-detected, or `init.platform` override |

Instrumentation scope is `{ name: "mini-program-monitor", version: <SDK version> }` on every OTLP batch.

## Metrics

All metrics carry `miniprogram.page.path` (e.g. `pages/index/index`) as an attribute so backend rules can slice by page.

### Performance (gauges)

Emitted by the **perf collector**. On WeChat via `wx.getPerformance()` + `PerformanceObserver` entries; on Alipay via lifecycle hooks (`wrapApp`, `wrapPage`) as a fallback.

| Metric | Unit | Value source | Platform |
|---|---|---|---|
| `miniprogram.app_launch.duration` | ms | PerformanceEntry `navigation/appLaunch` duration (WeChat); `onLaunch→onShow` or install-time→first `onReady` (Alipay) | both |
| `miniprogram.first_render.duration` | ms | PerformanceEntry `render/firstRender` duration (WeChat); page `onLoad→onReady` (Alipay) | both |
| `miniprogram.first_paint.time` | ms (**timestamp**, not duration) | PerformanceEntry `render/firstPaint` `startTime` — wall-clock epoch-ms of when first paint fired | WeChat only |
| `miniprogram.route.duration` | ms | PerformanceEntry `navigation/route` duration | WeChat only |
| `miniprogram.script.duration` | ms | PerformanceEntry `script` duration | WeChat only |
| `miniprogram.package_load.duration` | ms | PerformanceEntry `loadPackage` duration | WeChat only |

All are OTLP **gauges** with a single data point per event, `asInt` in milliseconds.

### Request duration (histogram)

| Metric | Unit | Shape | Temporality |
|---|---|---|---|
| `miniprogram.request.duration` | ms | histogram | DELTA, per flush interval |

Explicit bucket bounds (ms): `[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` — i.e. 11 bucket counts per data point.

Covers `wx.request` / `my.request`, `wx.downloadFile` / `my.downloadFile`, and `wx.uploadFile` / `my.uploadFile`. The histogram is aggregated in-memory by attribute tuple and drained by the scheduler as a single metric on every flush.

Attributes per data point:

| Key | Example |
|---|---|
| `http.request.method` | `GET`, `POST`, `DOWNLOAD`, `UPLOAD` |
| `http.response.status_code` | `200`, `404`, `0` (fail/timeout) |
| `server.address` | `api.example.com` (attribute omitted when the URL has no parseable `https?://host` prefix) |
| `miniprogram.page.path` | `pages/index/index` |
| `url.path.group` | optional; only present when a rule in `init.request.urlGroupRules` matches the URL |

Cardinality notes:
- `server.address` uses the URL host (no port). If you call many distinct hosts, expect one time series per host × method × status.
- `url.path.group` is the primary cardinality escape hatch for per-endpoint slicing (e.g. `/api/users/*` matches `/api/users/12345`).
- Never expose the full URL as an attribute — we only log it on the error path (see Logs below).

## Logs

Emitted by the **error collector** and the **request collector** (on HTTP failure). All logs are OTLP logs with `severityNumber: 17` / `severityText: "ERROR"`.

Common attributes:

| Key | Example |
|---|---|
| `exception.type` | `js` \| `promise` \| `pageNotFound` \| `ajax` |
| `miniprogram.page.path` | `pages/index/index` |

Per-type variants:

| `exception.type` | Body | Extra attributes | Trigger |
|---|---|---|---|
| `js` | first line of the error (with `MiniProgramError` wrapper unwrapped on WeChat) | `exception.stacktrace` (rest of the stack) | `wx.onError` / `my.onError` |
| `promise` | rejection reason (`.message` if `Error`, else `String(reason)`) | `exception.stacktrace` | `wx.onUnhandledRejection` / `my.onUnhandledRejection` |
| `pageNotFound` | `page not found: {path}` | none | `wx.onPageNotFound` (WeChat only — Alipay has no equivalent) |
| `ajax` | `{METHOD} {url} failed: {errMsg or statusCode}` | `http.request.method`, `http.response.status_code`, `server.address`, `miniprogram.page.path` | Request collector on statusCode ≥ 400 or `fail` |

## Trace segments (opt-in)

Emitted by the **request collector** when `init({ enable: { tracing: true } })`. One `SegmentObject` per sampled outgoing request, posted as a JSON array to `/v3/segments`.

A sampled request injects an `sw8` header on the wire, so the downstream service can join the same trace.

Segment shape (SkyWalking native):

| Field | Value |
|---|---|
| `traceId` | SkyWalking UUID |
| `traceSegmentId` | SkyWalking UUID |
| `service` | from `init.service` |
| `serviceInstance` | from `init.serviceInstance`; substituted with `-` when unset (SkyWalking's segment protocol requires a non-empty value) |
| `spans[0].operationName` | current page path |
| `spans[0].spanLayer` | `Http` |
| `spans[0].spanType` | `Exit` |
| `spans[0].componentId` | `10002` on WeChat, `10003` on Alipay (per-platform SkyWalking component IDs; OAP's `component-libraries.yml` registration tracks these values) |
| `spans[0].peer` | `server.address` (URL host), or `-` when the URL has no parseable host |
| `spans[0].isError` | `true` if statusCode ≥ 400, statusCode = 0, or request failed |
| `spans[0].tags` | `http.method`, `url`, `miniprogram.platform`, and `http.status_code` (success) or `error.message` (fail) |

Sampling and URL-blacklist controls:
- `init.tracing.sampleRate` (default `1.0`)
- `init.tracing.urlBlacklist` (default `[]` — an array of strings or `RegExp`)

## What we don't emit

Worth listing so nobody goes looking:
- **WebSocket signals** — `wx.connectSocket` / `my.connectSocket` are not instrumented in v0.2.x.
- **Memory warnings, network-status changes, page lifecycle events** other than perf timing.
- **Any attribute derived from the request body, URL path/query, or response body** — privacy-preserving by default. `url` is only on segment tags (when tracing is on).
- **Counts of how many events were dropped by the ring queue overflow** — `onAppHide` persistence mitigates most of this, but there's no dropped-events metric yet.
