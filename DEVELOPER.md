# Developer Guide

Internal docs for working on `mini-program-monitor`.

## Prerequisites

- Node.js ≥ 18
- WeChat Developer Tools (微信开发者工具) — required only for the `example/` app and e2e tests. Download: <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
- Optional: a local Apache SkyWalking OAP for end-to-end smoke testing (`docker run -p 12800:12800 apache/skywalking-oap-server`)

## First-time setup

```bash
git clone https://github.com/SkyAPM/mini-program-monitor.git
cd mini-program-monitor
npm install
npm run build
npm test
```

## Repo layout

```
src/
  index.ts            public API: init, record, flush
  core/               options resolution, ring queue, scheduler, sampler
  collectors/         (M2+) error, perf, network, lifecycle
  exporters/          console (M1), skywalking (M2+)
  shared/             wx facade, log, time helpers
  vendor/skywalking/  (M2+) vendored from skywalking-client-js + UPSTREAM.md
  types/              public TS types
test/                 vitest unit tests with a wx mock
example/              (M6) minimal mini-program for manual + e2e testing
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` | One-shot build via tsup → `dist/{cjs,esm,d.ts}` |
| `npm run dev` | tsup watch mode |
| `npm test` | vitest unit tests |
| `npm run test:watch` | vitest watch |
| `npm run typecheck` | `tsc --noEmit` |

## How testing works

### Layer 1 — unit tests (CI)

Vitest, Node only. [test/setup.ts](test/setup.ts) injects a stub `wx` global before every test. All production code that needs `wx` goes through [src/shared/wx.ts](src/shared/wx.ts), so tests never have to monkey-patch deeply.

Rule of thumb: every collector and every exporter has unit tests against the `wx` mock and a recording exporter. A failing assertion should pinpoint *exactly* which `wx.*` call was wrong.

### Layer 2 — integration in the WeChat simulator (manual)

The unit-test layer cannot verify that `wx.getPerformance()` actually returns the entries we expect, that the bundle loads in JSCore, or that `miniprogram_npm` packaging works. For this you run the `example/` app inside the real WeChat Developer Tools.

Dev loop (M6+):

1. `npm run dev` — tsup watch builds `dist/` on save.
2. `cd example && npm install` — installs the SDK as a file dep.
3. Open `example/` in WeChat Developer Tools.
4. Click **Tools → Build npm** once after each `npm install`.
5. Reload the simulator. The example has buttons that trigger every collector — error throw, promise reject, `wx.request`, route navigation, sub-package load.
6. Optional: point the example's `collector` at a local OAP to verify data lands in SkyWalking UI.

### Layer 3 — e2e (local-only)

[`miniprogram-automator`](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/) drives the WeChat simulator over a local websocket, paired with a fake-OAP HTTP recorder in Node. `npm run test:e2e` taps the example app's buttons and asserts the right payloads land at the recorder. **Local-only** — there is no headless WeChat IDE for CI.

## Wire format / SkyWalking compatibility

We send to three OAP endpoints, in JSON shapes defined by [`apache/skywalking-data-collect-protocol`](https://github.com/apache/skywalking-data-collect-protocol):

- `POST {collector}/browser/errorLogs` → `BrowserErrorLog[]` (`browser/BrowserPerf.proto`)
- `POST {collector}/browser/perfData` → `BrowserPerfData[]` (`browser/BrowserPerf.proto`)
- `POST {collector}/v3/segments` → `SegmentObject[]` (`language-agent/Tracing.proto`)

We do not depend on the `.proto` files at build time. TypeScript interfaces under `src/vendor/skywalking/protocol.ts` are hand-translated and pinned to a documented upstream commit in `src/vendor/skywalking/UPSTREAM.md`. To sync: read upstream, update interfaces, bump the commit hash. Don't add codegen unless the schema explodes in size.

## Vendored code

`src/vendor/skywalking/` (added in M2) will contain files copied from `apache/skywalking-client-js`:

- `services/report.ts`, `services/task.ts`, `services/uuid.ts`, `services/constant.ts`
- `trace/segment.ts`, `trace/type.ts`

Each file keeps its original Apache 2.0 header plus a `// Source:` line with the upstream path and commit SHA. **Do not edit these files in place** — if behavior needs to change, wrap them in a sibling module. To bump: re-copy from upstream, update the SHAs in `UPSTREAM.md`, run tests.

## Adding a collector

1. Create `src/collectors/<name>.ts` exporting an `install(api, queue)` function.
2. The collector receives the `wx` facade and the central `RingQueue` — never reach for globals.
3. Wrap every `wx.*` callback body in try/catch and route exceptions to the `log` helper. Never re-throw into user code.
4. Register it in [src/index.ts](src/index.ts) behind an `enable.<name>` flag (default true).
5. Add a unit test in `test/collectors/<name>.spec.ts` using the `wx` mock.

## Adding an exporter

1. Implement the `Exporter` interface from [src/exporters/types.ts](src/exporters/types.ts).
2. Never instrument your own outbound traffic — the network collector also skips the configured `collector` URL.
3. Add to the resolver in [src/core/options.ts](src/core/options.ts).

## Release process

1. Update `CHANGELOG.md`.
2. `npm version <patch|minor>` — tags + bumps `package.json`.
3. `git push --follow-tags`.
4. CI builds + publishes via `NPM_TOKEN`.
5. Before the v0.1.0 publish: delete the local `legacy-v0` reference tag (`git tag -d legacy-v0`).

## Roadmap

- **M1** — skeleton: options, queue, scheduler, console exporter, wx facade, unit tests
- **M2** — error collector + SkyWalking errorLogs exporter
- **M3** — perf collector (`wx.getPerformance` observer) + perfData exporter ← *current*
- **M4** — network collector + `sw8` propagation + segment exporter
- **M5** — storage-backed queue persistence + onAppHide flush
- **M6** — example app + e2e harness + docs polish
- **M7** — v0.1.0 release
