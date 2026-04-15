# Vendored upstream files

Files under this directory are copies of pure, DOM-free modules from
[`apache/skywalking-client-js`](https://github.com/apache/skywalking-client-js).
Each file keeps its original Apache 2.0 header plus a `// Source:` comment
pointing at the exact upstream path and commit SHA.

**Do not edit vendored files in place.** If a behavior change is needed,
wrap them in a sibling module. To bump:

1. Update the SHA below.
2. Re-copy the files from upstream at that SHA.
3. Adjust the `// Source:` headers.
4. Run `npm test` — a drift in the `BrowserErrorLog` shape will show up
   as a type error in [`src/exporters/skywalking.ts`](../../exporters/skywalking.ts).

## Pinned commit

`apache/skywalking-client-js@636dda072aee5b132ee25ca64b555ba3c6a71dec`

| Upstream path | Local path | Notes |
|---|---|---|
| `src/services/constant.ts` | `constant.ts` | copied verbatim |
| `src/services/uuid.ts` | `uuid.ts` | copied verbatim |
| `src/services/types.ts` | `types.ts` | **subset** — only `ErrorInfoFields` + `ReportFields` are kept. Performance-related types in upstream depend on DOM interfaces (`PerformanceEntry`, `Element`, `Node`) that do not exist in WeChat's JSCore and would break type-checking here. |
| *(ours)* | `protocol.ts` | not vendored — composes the two subsets above into the concrete `BrowserErrorLog` wire type that OAP's `/browser/errorLogs` endpoint expects. |
