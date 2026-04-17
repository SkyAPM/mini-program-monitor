# CLAUDE.md

Rules and conventions for AI assistants working in this repo. Read this before editing.

## What this is

A monitoring SDK for WeChat and Alipay mini-programs, reporting to Apache SkyWalking OAP via OTLP (metrics + logs) and SkyWalking native protocol (trace segments). Supports multi-platform through a platform adapter layer.

## Hard rules

1. **No DOM, no browser globals.** Mini-programs run in sandboxed JSCore/V8 environments. There is no `window`, `document`, `XMLHttpRequest`, `fetch`, `localStorage`, `MutationObserver`. Code that references any of these will crash at load.
2. **All platform API access goes through `src/adapters/`.** No file outside the adapter layer may reference `wx` or `my` directly. Collectors and exporters use the `PlatformAdapter` interface. This is what makes the SDK testable in plain Node and portable across platforms.
3. **Vendored files are not edited.** Anything under `src/vendor/skywalking/` is copied from upstream Apache projects with original headers. Sync, don't fork.
4. **Zero runtime dependencies.** `package.json#dependencies` stays empty. Mini-programs have a 2 MB main-package size limit; every dep we ship comes out of a user's budget.
5. **OTLP wire format follows the OpenTelemetry spec.** The proto3 binary and JSON shapes we POST to `/v1/logs` and `/v1/metrics` must match [`opentelemetry-proto`](https://github.com/open-telemetry/opentelemetry-proto). Default wire format is protobuf (`application/x-protobuf`); JSON is available via `encoding: 'json'`. Trace segments posted to `/v3/segments` follow SkyWalking's native protocol.
6. **The SDK must never crash the host mini-program.** Every collector entry point and every exporter call is wrapped in try/catch. A failing exporter logs *and re-queues* events — it never drops them silently, and it never throws into user code.
7. **Don't instrument our own transport, but don't be greedy either.** The request collector skips only the specific OTLP/SW endpoints it posts to (`/v1/logs`, `/v1/metrics`, `/v3/segments` on the configured collectors). Never match by host prefix — that excludes legitimate app traffic sharing the backend host.
8. **Wrapping native APIs must preserve their return values.** `wx.request`, `wx.downloadFile`, `wx.uploadFile` (and Alipay equivalents) return native task handles the host app uses for `.abort()` and progress callbacks. Monkey-patches must capture and return those task handles — returning `undefined` or a stub breaks every consumer.
9. **No comments explaining what code does.** Only comments for non-obvious *why*. Identifiers should carry the meaning.
10. **Always run `make typecheck` and `make test` before pushing.** Never push code that fails typecheck or tests.
11. **Tests must exercise the default code path, not bypass it.** When you add a new default (new encoding, new behavior), at least one test has to hit that default. If an existing test only passes because of an opt-in escape hatch (e.g. `encoding: 'json'`, or a hardcoded default that coincidentally matches the detected value), the test is giving false confidence.
12. **Every global patch must have a teardown.** Monkey-patches of `wx.request` / `my.request` / `App` / `Page`, and every `onError` / `onAppHide` / observer registration, return an `Uninstall` function from the adapter. Collectors bubble these up so `shutdown()` actually restores the original APIs and unregisters hooks. Without this, `init()` → `shutdown()` → `init()` stacks wrappers and leaks stale closures.
13. **Exporters return what they couldn't deliver; the scheduler re-queues only those.** `Exporter.export` returns the subset of input events that weren't successfully exported. `CompositeExporter` intersects per-sub-exporter failure sets so a partial failure (OTLP ok, SkyWalking trace failed) doesn't duplicate healthy log/metric data on the next flush tick.
14. **`EventKind` only lists values the exporters actually consume (`'log' | 'metric' | 'segment'`).** Don't re-introduce 'error'/'perf' as public kinds — `record()` would quietly drop them.

## Repo layout

```
src/
  index.ts            public API: init, record, flush, shutdown
  core/               options, queue, scheduler, sampler, resource builder
  adapters/           platform abstraction (wechat.ts, alipay.ts, detect.ts)
  collectors/         error (OTLP logs), perf (OTLP metrics), request (histogram + download/upload + sw8 tracing)
  exporters/          otlp-http (proto + json), otlp-proto (encoder), proto-writer, sw-trace (/v3/segments), composite, console
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
