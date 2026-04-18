# Sample payloads

Concrete OTLP (JSON-mapped) and SkyWalking-native payloads that the SDK posts. Shown as JSON — in proto mode the exact same structure goes on the wire as protobuf-encoded bytes. For semantics, see [SIGNALS.md](./SIGNALS.md).

All examples assume `init({ service: 'my-mini-program', serviceVersion: 'v1.2.0', collector: 'https://oap.example.com', platform: 'wechat' })` and a page path of `pages/index/index`.

## Shared resource block

Every OTLP payload (logs + metrics) uses this resource and scope. It's shown once here and elided in the per-signal examples below (as `"resource": <see above>`).

```json
{
  "resource": {
    "attributes": [
      { "key": "service.name", "value": { "stringValue": "my-mini-program" } },
      { "key": "service.version", "value": { "stringValue": "v1.2.0" } },
      { "key": "service.instance.id", "value": { "stringValue": "mp-ax91z2pf" } },
      { "key": "telemetry.sdk.name", "value": { "stringValue": "mini-program-monitor" } },
      { "key": "telemetry.sdk.version", "value": { "stringValue": "0.2.1" } },
      { "key": "miniprogram.platform", "value": { "stringValue": "wechat" } }
    ]
  },
  "scope": { "name": "mini-program-monitor", "version": "0.2.1" }
}
```

## Metrics

### Performance gauge (`miniprogram.app_launch.duration`)

POST `/v1/metrics`:

```json
{
  "resourceMetrics": [{
    "resource": <see above>,
    "scopeMetrics": [{
      "scope": <see above>,
      "metrics": [{
        "name": "miniprogram.app_launch.duration",
        "unit": "ms",
        "gauge": {
          "dataPoints": [{
            "asInt": "1200",
            "timeUnixNano": "1776455400000000000",
            "attributes": [
              { "key": "miniprogram.page.path", "value": { "stringValue": "pages/index/index" } }
            ]
          }]
        }
      }]
    }]
  }]
}
```

The other duration gauges (`first_render.duration`, `route.duration`, `script.duration`, `package_load.duration`) have the same shape with different `name` values.

`miniprogram.first_paint.time` has the same shape but carries a wall-clock epoch-millisecond **timestamp** rather than a duration (it's `entry.startTime` from the platform's `PerformanceObserver`), so `asInt` looks like this:

```json
{
  "name": "miniprogram.first_paint.time",
  "unit": "ms",
  "gauge": {
    "dataPoints": [{
      "asInt": "1776513486256",
      "timeUnixNano": "1776513486256000000",
      "attributes": [
        { "key": "miniprogram.page.path", "value": { "stringValue": "pages/index/index" } }
      ]
    }]
  }
}
```

### Request histogram (`miniprogram.request.duration`)

Three requests (two to `/api/users/12345`, one to `/api/orders`) emitted over one flush interval produce this single metric:

```json
{
  "resourceMetrics": [{
    "resource": <see above>,
    "scopeMetrics": [{
      "scope": <see above>,
      "metrics": [{
        "name": "miniprogram.request.duration",
        "unit": "ms",
        "histogram": {
          "aggregationTemporality": 1,
          "dataPoints": [
            {
              "timeUnixNano": "1776455400000000000",
              "count": "2",
              "sum": 310,
              "bucketCounts": ["0", "0", "0", "1", "1", "0", "0", "0", "0", "0", "0"],
              "explicitBounds": [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
              "attributes": [
                { "key": "http.request.method", "value": { "stringValue": "GET" } },
                { "key": "http.response.status_code", "value": { "stringValue": "200" } },
                { "key": "server.address", "value": { "stringValue": "api.example.com" } },
                { "key": "miniprogram.page.path", "value": { "stringValue": "pages/index/index" } },
                { "key": "url.path.group", "value": { "stringValue": "/api/users/*" } }
              ]
            },
            {
              "timeUnixNano": "1776455400000000000",
              "count": "1",
              "sum": 820,
              "bucketCounts": ["0", "0", "0", "0", "0", "0", "1", "0", "0", "0", "0"],
              "explicitBounds": [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
              "attributes": [
                { "key": "http.request.method", "value": { "stringValue": "POST" } },
                { "key": "http.response.status_code", "value": { "stringValue": "200" } },
                { "key": "server.address", "value": { "stringValue": "api.example.com" } },
                { "key": "miniprogram.page.path", "value": { "stringValue": "pages/index/index" } }
              ]
            }
          ]
        }
      }]
    }]
  }]
}
```

`bucketCounts` has N+1 entries for N bounds — the last entry counts values greater than the final bound. A request of 5ms lands in bucket index 0 (`<= 10`), a request of 75ms in index 3 (`<= 100`), and so on.

## Logs

POST `/v1/logs`:

### JS error (`exception.type = js`)

`body` is the error message with any leading `MiniProgramError` / `Error:` prefix stripped. `exception.stacktrace` is the raw platform stack (the frames carry the WeChat runtime's `WASubContext.js` / `WAServiceMainContext.js` entries, which is useful for filtering framework noise out at the backend).

```json
{
  "resourceLogs": [{
    "resource": <see above>,
    "scopeLogs": [{
      "scope": <see above>,
      "logRecords": [{
        "timeUnixNano": "1776455400000000000",
        "severityNumber": 17,
        "severityText": "ERROR",
        "body": { "stringValue": "demo: synchronous throw from button tap" },
        "attributes": [
          { "key": "exception.type", "value": { "stringValue": "js" } },
          { "key": "exception.stacktrace", "value": { "stringValue": "Error: demo: synchronous throw from button tap\n    at pi.onThrowError (pages/index/index.js:10:11)\n    at Object.o.safeCallback (WASubContext.js:1:213529)\n    at Fn (WASubContext.js:1:353882)\n    at WAServiceMainContext.js:1:1058177" } },
          { "key": "miniprogram.page.path", "value": { "stringValue": "pages/index/index" } }
        ]
      }]
    }]
  }]
}
```

### Promise rejection (`exception.type = promise`)

Same shape; `body` is the rejection reason, `exception.type = "promise"`, `exception.stacktrace` is the `.stack` of the rejection if it was an `Error`.

### Page not found (`exception.type = pageNotFound`, WeChat only)

```json
{
  "body": { "stringValue": "page not found: pages/missing/index" },
  "attributes": [
    { "key": "exception.type", "value": { "stringValue": "pageNotFound" } },
    { "key": "exception.stacktrace", "value": { "stringValue": "" } },
    { "key": "miniprogram.page.path", "value": { "stringValue": "pages/missing/index" } }
  ]
}
```

### HTTP failure (`exception.type = ajax`)

Emitted alongside the histogram bucket increment when a request returns ≥ 400 or fails:

```json
{
  "body": { "stringValue": "POST https://api.example.com/checkout failed: 500" },
  "attributes": [
    { "key": "exception.type", "value": { "stringValue": "ajax" } },
    { "key": "http.request.method", "value": { "stringValue": "POST" } },
    { "key": "http.response.status_code", "value": { "stringValue": "500" } },
    { "key": "server.address", "value": { "stringValue": "api.example.com" } },
    { "key": "miniprogram.page.path", "value": { "stringValue": "pages/checkout/index" } }
  ]
}
```

For network failure / timeout, `http.response.status_code` is `"0"` and the body ends with the platform `errMsg`.

## Trace segments (opt-in)

POST `/v3/segments` as a JSON array. One object per sampled request:

```json
[{
  "traceId": "0e9f6d8a-2b4a-4f3e-9c1d-7a3b2c1d4e5f",
  "traceSegmentId": "5a7d8e9f-1234-4abc-9def-abcdef012345",
  "service": "my-mini-program",
  "serviceInstance": "mp-ax91z2pf",
  "spans": [{
    "operationName": "pages/checkout/index",
    "startTime": 1776455400123,
    "endTime": 1776455400587,
    "spanId": 0,
    "parentSpanId": -1,
    "spanLayer": "Http",
    "spanType": "Exit",
    "componentId": 10001,
    "peer": "api.example.com",
    "isError": false,
    "tags": [
      { "key": "http.method", "value": "POST" },
      { "key": "url", "value": "https://api.example.com/checkout" },
      { "key": "http.status_code", "value": "200" },
      { "key": "miniprogram.platform", "value": "wechat" }
    ]
  }]
}]
```

The outgoing request carries an `sw8` header of the form:

```
sw8: 1-{base64 traceId}-{base64 segmentId}-0-{base64 service}-{base64 serviceInstance}-{base64 operationName}-{base64 peer}
```

so the downstream service can continue the same trace.
