# mini-program-monitor

Monitoring agent for WeChat (微信) and Alipay (支付宝) Mini Programs, reporting to [Apache SkyWalking](https://skywalking.apache.org/) via OTLP and SkyWalking native protocols.

> **Status: pre-alpha.** Active development. APIs are unstable until v0.1.0.

## What you get

- **Error tracking** — JS errors, unhandled promise rejections, page-not-found events. Reported as OTLP logs with OTel semantic conventions (`exception.type`, `exception.stacktrace`).
- **Performance metrics** — app launch, first render, first paint, route navigation, script execution, sub-package load. Reported as OTLP gauge metrics (`miniprogram.app_launch.duration`, etc.).
- **Request metrics** — `wx.request`/`my.request` duration and status by domain. Failed requests (4xx/5xx/timeout) also emit error logs with `exception.type: ajax`.
- **Distributed tracing** *(opt-in)* — `sw8` header propagation across outgoing requests. Reported as SkyWalking `SegmentObject` to `/v3/segments`. Enable with `enable: { tracing: true }`.
- **Queue persistence** — unsent events are saved to storage on app hide and restored on next launch.

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
  serviceInstance: 'instance-uuid',  // default auto-generated
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
  maxQueue: 200,       // default 200, ring buffer drop-oldest
  flushInterval: 5000, // default 5000ms

  debug: false,        // default false
});
```

## Data flow

```
Mini-program SDK              Backend (Apache SkyWalking OAP)
────────────────              ─────────────────────────────
Error logs     ──→ OTLP JSON ──→ POST /v1/logs     ──→ LAL rules ──→ Log storage
Perf metrics   ──→ OTLP JSON ──→ POST /v1/metrics  ──→ MAL rules ──→ Metric storage
Request metrics ──→ OTLP JSON ──→ POST /v1/metrics  ──→ MAL rules ──→ Metric storage
Trace segments ──→ SW native ──→ POST /v3/segments  ──→ Trace storage + topology
```

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

## License

Apache 2.0. See [LICENSE](./LICENSE).

## Contributing

See [DEVELOPER.md](./DEVELOPER.md).
