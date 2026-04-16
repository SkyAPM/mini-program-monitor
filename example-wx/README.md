# Example mini-program (WeChat)

A minimal WeChat mini-program that integrates `mini-program-monitor` and exposes a button for every collector.

## Setup

```bash
# from the repo root, build the SDK first
npm install
npm run build

# wire the SDK into the example
cd example-wx
npm install
```

`npm install` runs a `postinstall` hook that copies the SDK's built output into `miniprogram_npm/`, bypassing WeChat's "Build npm" which doesn't work with local `file:` dependencies.

When the SDK changes:

```bash
npm run build              # at repo root
cd example-wx && npm run relink
```

## Local backend setup

Before opening the example, start the e2e infrastructure:

```bash
cd ../e2e && docker compose up -d
```

This starts:

| Container | Port | Purpose |
|---|---|---|
| **OTel Collector** | `:4318` | Receives OTLP metrics + logs |
| **mock-collector** | `:12801` | Receives `/v3/segments` (trace segments) |
| **SkyWalking UI** | `:8080` | Dashboard |

The example app sends:
- OTLP logs + metrics → `http://127.0.0.1:4318` (`collector`)
- Trace segments → `http://127.0.0.1:12801` (`traceCollector`)

## Open in WeChat Developer Tools

1. Download: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
2. **Import project** → select this `example-wx/` directory.
3. Use **测试号 / Test account** when prompted for AppID.
4. Reload the simulator (Cmd-B).

## What the buttons do

| Button | Triggers |
|---|---|
| Throw JS error | `wx.onError` fires → OTLP error log |
| Reject promise | `wx.onUnhandledRejection` fires → OTLP error log |
| Record error (manual) | `record('log', ...)` + `flush()` → OTLP error log |
| Navigate to unknown route | `wx.onPageNotFound` fires → OTLP error log |
| wx.request | Request to httpbin.org → OTLP request metric + trace segment |
| Flush now | Drains the queue immediately |

## Verify data is flowing

Watch OTel Collector logs (metrics + error logs):
```bash
cd ../e2e && docker compose logs -f otel-collector
```

Check received trace segments:
```bash
curl http://127.0.0.1:12801/receiveData
```
