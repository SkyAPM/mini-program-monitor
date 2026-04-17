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
9. **Always run `make typecheck` and `make test` before pushing.** Never push code that fails typecheck or tests.

## Repo layout

```
src/
  index.ts            public API: init, record, flush, shutdown
  core/               options, queue, scheduler, sampler, resource builder
  adapters/           platform abstraction (wechat.ts, alipay.ts, detect.ts)
  collectors/         error (OTLP logs), perf (OTLP metrics), request (OTLP metrics + sw8 tracing)
  exporters/          otlp-http (JSON), sw-trace (/v3/segments), composite, console
  shared/             log, time, base64 helpers
  vendor/skywalking/  uuid.ts, constant.ts (for segment ID generation)
  types/              options, events, OTLP wire types, segment types
test/                 vitest unit tests with wx/my mocks
example-wx/              WeChat mini-program for manual testing
example-alipay/       Alipay mini-program for manual testing
e2e/                  docker-compose (OTel Collector + mock-collector + OAP) + harnesses + verify
```

## Out of scope for v0.1

- Source-map upload tooling (planned for v1.1)
- Non-WeChat/Alipay mini-programs: ByteDance, Baidu (architect for it, don't ship it)
- Visual UI — SkyWalking OAP already provides one

## Testing layers

- **Unit (CI):** vitest + platform mocks in `test/setup.ts`. 73 tests across 15 files.
- **E2E (CI):** OTel Collector for OTLP verification (13 checks), mock-collector for trace segment verification (6 checks). Both WeChat + Alipay platforms tested.
- **Manual (local):** `example-wx/` (WeChat) and `example-alipay/` (Alipay) in their respective DevTools.

See [DEVELOPER.md](./DEVELOPER.md) for the full dev loop.

## Roadmap

- **M1–M3** — skeleton, error collector, perf collector (browser protocol, since replaced)
- **M4** — OTLP refactor: platform adapters + OTLP HTTP/JSON exporter + OTel Collector e2e
- **M5** — Alipay perf fallback (lifecycle-based timing)
- **M6** — Request metrics collector (always-on, domain-level)
- **M7** — Distributed tracing: sw8 injection + SW segment exporter (opt-in)
- **M8** — Storage-backed queue persistence + onAppHide flush
- **M9** — Example apps (WeChat + Alipay) + Alipay e2e + trace validation via mock-collector
- **M10** — v0.1.0 release ← *next*
