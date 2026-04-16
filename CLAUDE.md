# CLAUDE.md

Rules and conventions for AI assistants working in this repo. Read this before editing.

## What this is

A monitoring SDK for WeChat and Alipay mini-programs, reporting to Apache SkyWalking OAP via OTLP (metrics + logs) and SkyWalking native protocol (trace segments). Supports multi-platform through a platform adapter layer.

## Hard rules

1. **No DOM, no browser globals.** Mini-programs run in sandboxed JSCore/V8 environments. There is no `window`, `document`, `XMLHttpRequest`, `fetch`, `localStorage`, `MutationObserver`. Code that references any of these will crash at load.
2. **All platform API access goes through `src/adapters/`.** No file outside the adapter layer may reference `wx` or `my` directly. Collectors and exporters use the `PlatformAdapter` interface. This is what makes the SDK testable in plain Node and portable across platforms.
3. **Vendored files are not edited.** Anything under `src/vendor/skywalking/` is copied from upstream Apache projects with original headers. Sync, don't fork.
4. **Zero runtime dependencies.** `package.json#dependencies` stays empty. Mini-programs have a 2 MB main-package size limit; every dep we ship comes out of a user's budget.
5. **OTLP wire format follows the OpenTelemetry spec.** The JSON shapes we POST to `/v1/logs` and `/v1/metrics` must match [`opentelemetry-proto`](https://github.com/open-telemetry/opentelemetry-proto) proto3 JSON mapping. Trace segments posted to `/v3/segments` follow SkyWalking's native protocol.
6. **The SDK must never crash the host mini-program.** Every collector entry point and every exporter call is wrapped in try/catch. A failing exporter logs and drops events; it never throws into user code.
7. **Don't instrument our own transport.** The request collector must skip the configured `collector` URL or it will infinite-loop.
8. **No comments explaining what code does.** Only comments for non-obvious *why*. Identifiers should carry the meaning.

## Repo layout

```
src/
  index.ts            public API: init, record, flush, shutdown
  core/               options, queue, scheduler, sampler, resource builder
  adapters/           platform abstraction (wechat.ts, alipay.ts, detect.ts)
  collectors/         error (OTLP logs), perf (OTLP metrics), request (planned), tracing (planned)
  exporters/          otlp-http (JSON), console, sw-trace (planned)
  shared/             log, time helpers
  vendor/skywalking/  uuid.ts, constant.ts (for future segment ID generation)
  types/              options, events, OTLP wire types
test/                 vitest unit tests with wx/my mocks
example/              WeChat mini-program for manual testing
e2e/                  docker-compose (OAP + BanyanDB + OTel Collector) + harness + verify
```

## Out of scope for v0.1

- Source-map upload tooling (planned for v1.1)
- Non-WeChat/Alipay mini-programs: ByteDance, Baidu (architect for it, don't ship it)
- Visual UI — SkyWalking OAP already provides one

## Testing layers

- **Unit (CI):** vitest + platform mocks in `test/setup.ts`. Runs in plain Node.
- **E2E (CI):** OTel Collector receives OTLP metrics+logs from the harness, verify script checks collector debug output. OAP + BanyanDB for future trace verification.
- **Manual (local):** `example/` mini-program in WeChat Developer Tools.

See [DEVELOPER.md](./DEVELOPER.md) for the full dev loop.

## Roadmap

- **M1** — skeleton: options, queue, scheduler, console exporter, unit tests
- **M2** — error collector + SkyWalking errorLogs exporter
- **M3** — perf collector + perfData exporter
- **M4** — OTLP refactor: platform adapters (wechat/alipay) + OTLP HTTP/JSON exporter + OTel Collector e2e ← *current*
- **M5** — Alipay perf fallback (lifecycle-based timing) + request metrics collector
- **M6** — Request metrics: patch wx.request/my.request, emit OTLP metrics (duration/status/size)
- **M7** — Tracing: sw8 injection + SW segment exporter (opt-in)
- **M8** — Storage-backed queue persistence + onAppHide flush
- **M9** — Example apps (WeChat + Alipay) + docs polish
- **M10** — v0.1.0 release
