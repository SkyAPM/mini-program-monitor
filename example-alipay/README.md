# Alipay Example mini-program

A minimal Alipay (支付宝) mini-program that integrates `mini-program-monitor`.

## Setup

```bash
# from the repo root, build the SDK first
npm install
npm run build

# wire the SDK into the example
cd example-alipay
npm install
```

## Open in Alipay Developer Tools

1. Download Alipay Mini Program Developer Tools (小程序开发者工具): <https://opendocs.alipay.com/mini/ide/download>
2. **Import project** → select this `example-alipay/` directory.
3. The mini-program should load with four buttons.

## What the buttons do

| Button | Triggers |
|---|---|
| Throw JS error | `my.onError` fires → OTLP error log |
| Reject promise | `my.onUnhandledRejection` fires → OTLP error log |
| my.request | Request to httpbin.org → OTLP request metric + trace segment (tracing is enabled in [app.js](./app.js)) |
| Flush now | Drains the queue immediately |

## Platform differences from WeChat

- No `my.getPerformance()` — perf metrics use lifecycle fallback (App.onLaunch→onShow, Page.onLoad→onReady)
- No `my.onPageNotFound` — page-not-found errors are not captured
- `my.request` uses `headers` (plural) and `status` (not `statusCode`)
- Uses `.axml` / `.acss` instead of `.wxml` / `.wxss`
