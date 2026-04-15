# CLAUDE.md

Rules and conventions for AI assistants working in this repo. Read this before editing.

## What this is

A monitoring SDK for WeChat Mini Programs (微信小程序), reporting to Apache SkyWalking OAP. Wire-format compatible with [`apache/skywalking-client-js`](https://github.com/apache/skywalking-client-js) so existing OAP browser dashboards work unchanged.

## Hard rules

1. **No DOM, no browser globals.** WeChat runs in a sandboxed JSCore/V8 environment. There is no `window`, `document`, `XMLHttpRequest`, `fetch`, `localStorage`, `MutationObserver`, or browser-style `PerformanceObserver`. Code that imports or references any of these will crash at load.
2. **All `wx.*` access goes through `src/shared/wx.ts`.** No file outside that module may reference `wx` directly. This is what makes the SDK testable in plain Node — tests stub one module instead of the entire `wx` surface.
3. **Vendored files are not edited.** Anything under `src/vendor/skywalking/` is copied from upstream Apache projects with original headers. Sync, don't fork. If a behavior change is needed, wrap it in a sibling module — never modify the vendored file.
4. **Zero runtime dependencies.** `package.json#dependencies` stays empty. Mini-programs have a 2 MB main-package size limit; every dep we ship comes out of a user's budget.
5. **Wire format follows OAP, not us.** The shape we POST to `/browser/errorLogs`, `/browser/perfData`, `/v3/segments` must match [`apache/skywalking-data-collect-protocol`](https://github.com/apache/skywalking-data-collect-protocol) byte-for-byte. If a field name looks awkward, that's because the proto says so.
6. **The SDK must never crash the host mini-program.** Every collector entry point and every exporter call is wrapped in try/catch. A failing exporter logs and drops events; it never throws into user code.
7. **Don't instrument our own transport.** The network collector must skip the configured `collector` URL or it will infinite-loop.
8. **No comments explaining what code does.** Only comments for non-obvious *why*. Identifiers should carry the meaning.

## Repo layout

```
src/
  index.ts            public API: init, record, flush
  core/               options, queue, scheduler, sampler, ids
  collectors/         (M2+) error / perf / network / lifecycle / memory
  exporters/          console (M1), skywalking (M2+)
  shared/             wx facade, log, time helpers
  vendor/skywalking/  (M2+) vendored from skywalking-client-js + protocol types
  types/              public TS types
test/                 vitest unit tests with a wx mock in setup.ts
example/              (M6) minimal mini-program for manual + e2e testing
```

## Out of scope for v0.1

- Source-map upload tooling (planned for v1.1)
- OTLP exporter (planned for v0.2)
- Non-WeChat mini-programs: Alipay, ByteDance, Baidu (architect for it, don't ship it)
- Visual UI — SkyWalking OAP already provides one

## Testing layers

- **Unit (CI):** vitest + a `wx` mock in `test/setup.ts`. Runs in plain Node. This is what `npm test` runs and what CI gates on.
- **Manual (local):** the `example/` mini-program, opened in WeChat Developer Tools. Drives real `wx.*` against a real JSCore.
- **E2E (local):** `miniprogram-automator` puppeteers the WeChat simulator and asserts payloads against a fake-OAP HTTP recorder. Local-only — the WeChat IDE is not headless and is not available in CI.

See [DEVELOPER.md](./DEVELOPER.md) for the full dev loop.

## Roadmap

- **M1** — skeleton: options, queue, scheduler, console exporter, wx facade, unit tests ← *current*
- **M2** — error collector + SkyWalking errorLogs exporter
- **M3** — perf collector + perfData exporter
- **M4** — network collector + `sw8` propagation + segment exporter
- **M5** — storage-backed queue persistence + onAppHide flush
- **M6** — example app + e2e harness + docs polish
- **M7** — v0.1.0 release
