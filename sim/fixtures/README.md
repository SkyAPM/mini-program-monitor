# Fixtures

**These are placeholder fixtures.** Values are plausible but hand-crafted, not captured from real devices or production traffic.

To replace with real data, run a capture session (DevTools or real device) and overwrite these files. The image contract and scenario schemas do not change.

## Files

- `urls.json` — weighted URL list. Each entry: `url`, `method`, `weight`, `statusMix` (code → probability), `latencyMs` (`[min, max]`).
- `error-messages.json` — stack traces by `exception.type` (`js`, `promise`, `manual`).
- `../wechat/fixtures/system-info.json` — WeChat `wx.getSystemInfoSync()` shape.
- `../alipay/fixtures/system-info.json` — Alipay `my.getSystemInfoSync()` shape.

## Scrubbing policy (for captured data)

Before checking captured fixtures into git:

- Remove any real user IDs, phone numbers, OpenIDs, UnionIDs.
- Replace production API hosts with `api.example.com` / `cdn.example.com`.
- Remove device identifiers (IMEI, MAC, advertising IDs).
- Keep only `brand`, `model`, `SDKVersion`, `platform`, `system` in system-info — drop other fields the SDK doesn't consume.
