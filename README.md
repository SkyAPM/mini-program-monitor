# mini-program-monitor

Monitoring agent for WeChat (微信) and Alipay (支付宝) Mini Programs, reporting to [Apache SkyWalking](https://skywalking.apache.org/) via OTLP and SkyWalking native protocols.

## What you get

- **Error tracking** — JS errors, unhandled promise rejections, page-not-found events. Reported as OTLP logs with OTel semantic conventions (`exception.type`, `exception.stacktrace`).
- **Performance metrics** — app launch, first render, first paint, route navigation, script execution, sub-package load. Reported as OTLP gauge metrics (`miniprogram.app_launch.duration`, etc.).
- **Request metrics** — `wx.request`/`my.request`, plus `downloadFile`/`uploadFile`, reported as an OTLP delta histogram (`miniprogram.request.duration`) bucketed per flush interval. Failed requests (4xx/5xx/timeout) also emit error logs with `exception.type: ajax`.
- **Distributed tracing** *(opt-in)* — `sw8` header propagation across outgoing requests. Reported as SkyWalking `SegmentObject` to `/v3/segments`. Enable with `enable: { tracing: true }`.
- **Per-platform distinguishable at the backend** — every signal carries `miniprogram.platform: wechat | alipay` (resource attribute on OTLP, span tag on segments) and each platform has its own SkyWalking component ID (WeChat = 10002, Alipay = 10003). Operators with one WeChat + one Alipay app against the same backend can slice by platform without forcing distinct `service.name`s.
- **Queue persistence** — unsent events are saved to storage on app hide and restored on next launch.
- **OTLP wire format** — protobuf by default (`application/x-protobuf`), JSON available via `encoding: 'json'`. No runtime dependencies.

## Supported platforms

| Platform | Global | Error hooks | Perf API | Status |
|---|---|---|---|---|
| **WeChat** (微信) | `wx.*` | `wx.onError`, `wx.onUnhandledRejection`, `wx.onPageNotFound` | `wx.getPerformance()` + PerformanceObserver | Implemented |
| **Alipay** (支付宝) | `my.*` | `my.onError`, `my.onUnhandledRejection` | Lifecycle-based fallback (`App.onLaunch→onShow`, `Page.onLoad→onReady`) | Implemented |

## Install

```bash
npm install mini-program-monitor
```

Then in WeChat Developer Tools: **Tools → Build npm** (工具 → 构建 npm).

## Quickstart

```js
// app.js (WeChat)
const { init } = require('mini-program-monitor');

App({
  onLaunch() {
    init({
      service: 'my-mini-program',
      collector: 'https://your-skywalking-oap.example.com',
    });
  },
});
```

```js
// app.js (Alipay)
const { init } = require('mini-program-monitor');

App({
  onLaunch() {
    init({
      service: 'my-mini-program',
      collector: 'https://your-skywalking-oap.example.com',
      platform: 'alipay',
    });
  },
});
```

## Options

```ts
init({
  // Required
  service: 'my-mini-program',
  collector: 'https://oap.example.com',

  // Optional
  serviceVersion: 'v1.2.0',         // default 'v0.0.0'
  serviceInstance: 'instance-uuid',  // default unset — OTLP omits `service.instance.id`; SkyWalking segments send `-`
  platform: 'wechat',               // 'wechat' | 'alipay', auto-detected if omitted

  // Feature flags
  enable: {
    error: true,       // default true  — error logs via OTLP
    perf: true,        // default true  — perf metrics via OTLP
    request: true,     // default true  — request metrics via OTLP
    tracing: false,    // default false — sw8 header injection + trace segments
  },

  // Tracing options (when enable.tracing = true)
  tracing: {
    sampleRate: 1.0,
    urlBlacklist: [/\/heartbeat/],
  },

  // Request options
  request: {
    urlGroupRules: {                 // cardinality control for metric labels
      '/api/users/*': /\/api\/users\/\d+/,
    },
  },

  // Transport
  maxQueue: 200,        // default 200, ring buffer drop-oldest
  flushInterval: 5000,  // default 5000ms
  encoding: 'proto',    // default 'proto' | 'json' — OTLP wire format

  debug: false,         // default false
});
```

## Data flow

```
Mini-program SDK               Backend (Apache SkyWalking OAP)
────────────────               ─────────────────────────────
Error logs      ──→ OTLP proto ──→ POST /v1/logs     ──→ LAL rules ──→ Log storage
Perf metrics    ──→ OTLP proto ──→ POST /v1/metrics  ──→ MAL rules ──→ Metric storage
Request metrics ──→ OTLP proto ──→ POST /v1/metrics  ──→ MAL rules ──→ Metric storage
Trace segments  ──→ SW native  ──→ POST /v3/segments ──→ Trace storage + topology
```

OTLP body encoding defaults to protobuf (`application/x-protobuf`). Pass `encoding: 'json'` to switch to JSON for debugging.

OTLP resource attributes identify the service:

| Attribute | Example |
|---|---|
| `service.name` | `my-mini-program` |
| `service.version` | `v1.2.0` |
| `miniprogram.platform` | `wechat` or `alipay` |
| `telemetry.sdk.name` | `mini-program-monitor` |

## Compatibility

- WeChat base library ≥ 2.11 (for `wx.getPerformance`)
- Alipay base library ≥ 2.0
- Apache SkyWalking OAP ≥ 10.x (with OTLP HTTP receiver)
- Any OTLP-compatible backend (OTel Collector, Grafana, etc.)

## What the SDK emits

- [docs/SIGNALS.md](./docs/SIGNALS.md) — every metric name, log attribute, and trace-segment field the SDK produces, with the OTel semantic conventions each uses.
- [docs/SAMPLES.md](./docs/SAMPLES.md) — concrete OTLP + SkyWalking payloads for each signal.

## Preview / demo

Want to see the data in a real SkyWalking UI without wiring a mini-program into DevTools? Clone the repo and run:

```bash
make preview          # builds sim images, starts OAP + UI + mock-collector + OTel Collector + both sims
# open http://127.0.0.1:8080, wait ~30 s for topology to populate
make preview-down
```

The `sim-wechat` and `sim-alipay` containers drive realistic telemetry (`miniprogram.app_launch.duration`, request histograms, error logs, trace segments) against the running backend. Multi-arch images (`linux/amd64`, `linux/arm64`) are also published to GHCR per SHA — pin to any commit for third-party integration testing:

```
ghcr.io/skyapm/mini-program-monitor/sim-wechat:<sha>
ghcr.io/skyapm/mini-program-monitor/sim-alipay:<sha>
```

See [sim/README.md](https://github.com/SkyAPM/mini-program-monitor/blob/main/sim/README.md) for scenarios (`demo`, `baseline`, `error-storm`, `slow-api`) and env-var knobs.

## Changelog

See [CHANGES.md](./CHANGES.md) for per-version release notes.

## License

Apache 2.0. See [LICENSE](./LICENSE).

## Contributing

See [DEVELOPER.md](https://github.com/SkyAPM/mini-program-monitor/blob/main/DEVELOPER.md).
