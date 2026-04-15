# mini-program-monitor

Monitoring agent for WeChat Mini Programs (微信小程序), reporting to Apache SkyWalking.

> **Status: pre-alpha.** Active rewrite. APIs are unstable until v0.1.0.

## What you get

- JavaScript errors and unhandled promise rejections
- Page lifecycle, route timing, and `wx.getPerformance()` metrics (first paint, first render, app launch, sub-package load)
- Network traces with SkyWalking `sw8` header propagation across `wx.request` / `downloadFile` / `uploadFile`
- Memory warnings, network status, scene values

All data is reported to Apache SkyWalking OAP using the same wire format as [skywalking-client-js](https://github.com/apache/skywalking-client-js), so existing browser dashboards work unchanged.

## Install

```bash
npm install mini-program-monitor
```

Then in WeChat Developer Tools: **Tools → Build npm** (工具 → 构建 npm).

## Quickstart

```js
// app.js
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

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `service` | `string` | required | Service name shown in SkyWalking |
| `serviceInstance` | `string` | auto | Instance identifier; auto-generated if omitted |
| `collector` | `string` | required for skywalking exporter | OAP base URL |
| `sampleRate` | `number` | `1.0` | Trace sample rate, 0–1. Errors are always sampled. |
| `maxQueue` | `number` | `200` | Max events buffered before drop-oldest |
| `flushInterval` | `number` | `5000` | Flush cadence in ms |
| `debug` | `boolean` | `false` | Verbose console logging |

## Compatibility

- WeChat base library ≥ 2.11 (for `wx.getPerformance`)
- WeChat Developer Tools ≥ 1.05
- Apache SkyWalking OAP ≥ 9.0

## License

Apache 2.0. See [LICENSE](./LICENSE).

## Contributing

See [DEVELOPER.md](./DEVELOPER.md).
