# Example mini-program (WeChat)

A minimal WeChat mini-program that integrates `mini-program-monitor` and exposes a button for every collector.

## Setup

```bash
# from the repo root, build the SDK first
npm install
npm run build

# wire the SDK into the example
cd example
npm install
```

`npm install` runs a `postinstall` hook that copies the SDK's built output into `miniprogram_npm/`, bypassing WeChat's "Build npm" which doesn't work with local `file:` dependencies.

When the SDK changes:

```bash
npm run build           # at repo root
cd example && npm run relink
```

## Open in WeChat Developer Tools

1. Download: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
2. **Import project** → select this `example/` directory.
3. Use **测试号 / Test account** when prompted for AppID.
4. Reload the simulator (Cmd-B).

## What the buttons do

| Button | Triggers |
|---|---|
| Throw JS error | `wx.onError` fires → OTLP error log |
| Reject promise | `wx.onUnhandledRejection` fires → OTLP error log |
| Record error (manual) | `record('log', ...)` + `flush()` → OTLP error log |
| Navigate to unknown route | `wx.onPageNotFound` fires → OTLP error log |
| wx.request | Request to httpbin.org → OTLP request duration metric |
| Flush now | Drains the queue immediately |

## Collector endpoint

The example points `collector` at `http://127.0.0.1:4318` (OTel Collector). To see data, start the e2e infrastructure:

```bash
cd ../e2e && docker compose up -d
# OTel Collector on :4318, SkyWalking UI on :8080
```
