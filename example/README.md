# Example mini-program

A minimal WeChat mini-program that integrates `mini-program-monitor` and exposes a button for every collector. Use this for local dogfooding and manual verification in WeChat Developer Tools.

## Setup

```bash
# from the repo root, build the SDK first — WeChat's "Build npm" copies
# the dist directory indicated by the "miniprogram" field in package.json
npm install
npm run build

# then wire the SDK into the example as a file dep
cd example
npm install
```

> **Note — symlinks**: `example/.npmrc` forces `install-links=true`. WeChat's "Build npm" step does not follow symlinks, and npm's default for `file:` dependencies is to symlink. Without this flag you will see `Error: module 'mini-program-monitor.js' is not defined` in the IDE console.

## Open in WeChat Developer Tools

1. Download and install the IDE: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
2. **Import project** → select this `example/` directory.
3. When prompted for AppID, pick **测试号 / Test account** (no registration). The project file ships with `touristappid` which the IDE treats as test mode.
4. In the IDE, click **Tools → Build npm** (工具 → 构建 npm). This generates `miniprogram_npm/mini-program-monitor/` from `node_modules/`.
5. Reload the simulator.

## What the buttons do

| Button | Triggers | What you should see |
|---|---|---|
| Throw JS error | a synchronous `throw` | M2: `wx.onError` fires → `BrowserErrorLog` posted |
| Reject promise | `Promise.reject` | M2: `wx.onUnhandledRejection` fires → `BrowserErrorLog` posted |
| Record error (manual) | `record('error', …)` + `flush()` | Event flows through queue → exporter immediately |
| Navigate to unknown route | `wx.navigateTo` to a missing page | M2: `wx.onPageNotFound` fires |
| wx.request | a GET to httpbin.org | M4: network collector traces the call with `sw8` header |
| Flush now | `flush()` | Drains the queue immediately |

The example points the `collector` at `http://127.0.0.1:12800` by default. To see data land in SkyWalking, also start the e2e infrastructure (`cd ../e2e && docker compose up`) which brings up OAP + UI + BanyanDB.

## Milestone status

Right now (M1) only the queue + scheduler + console exporter are wired, so buttons will print events to the IDE console. As each subsequent milestone lands, more buttons become useful:

- **M2** — JS error / promise reject / unknown route buttons post real `BrowserErrorLog` data.
- **M3** — page lifecycle and `wx.getPerformance` data land as `BrowserPerfData`.
- **M4** — the wx.request button produces a trace segment with `sw8` propagation.
