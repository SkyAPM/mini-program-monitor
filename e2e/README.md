# Layer B — end-to-end harness

A headless, dockerized end-to-end test that runs the compiled SDK in Node against a real Apache SkyWalking OAP + UI + BanyanDB stack, then asserts the data landed via `swctl` GraphQL queries.

Layer A is [`example/`](../example/) — the manual-in-WeChat-Devtools version.
Layer B is this directory — the automated version that does not need the WeChat simulator.

## How it works

```
Node process                        docker compose
┌─────────────────────┐             ┌────────────────────────┐
│  harness/run.mjs    │  POST       │  oap  (latest master)  │
│   ├─ fake-wx.mjs    │ ─────────►  │  browser receiver      │
│   ├─ SDK (init)     │             │  │                     │
│   └─ HarnessExporter│             │  ▼                     │
└─────────────────────┘             │  banyandb (commit-pin) │
         ▲                          └──┬─────────────────────┘
         │                             │
         │   swctl browser logs ls     ▼
         └───────────────────────── GraphQL ports 12800
```

The SDK runs unmodified — imported from `../dist/index.mjs` after a normal `npm run build`. The harness replaces `globalThis.wx` with a minimal stub and passes a custom `Exporter` implementation that POSTs `BrowserErrorLog[]` to OAP's `/browser/errorLogs` endpoint.

The custom exporter is a temporary stand-in. When M2 lands the real vendored SkyWalking exporter under `src/vendor/skywalking/`, [`harness/exporter.mjs`](harness/exporter.mjs) deletes and the harness imports the production one.

## Image pinning

- **OAP** — `skywalking/oap:latest` (Docker Hub). Upstream CI auto-builds this from master; upstream's own e2e uses the same reference.
- **UI** — `skywalking/ui:latest` (same).
- **BanyanDB** — `ghcr.io/apache/skywalking-banyandb:<commit>` pinned in [.env](.env). Mirrored from `apache/skywalking test/e2e-v2/script/env`. Bump when upstream bumps.
- **swctl** — release-pinned in [scripts/install-swctl.sh](scripts/install-swctl.sh).

## Running locally

You need Docker, Node ≥ 18, and the [`skywalking-infra-e2e` CLI](https://github.com/apache/skywalking-infra-e2e):

```bash
go install github.com/apache/skywalking-infra-e2e/cmd/e2e@latest
```

Then:

```bash
cd e2e
e2e run -c e2e.yaml
```

This executes setup → verify → cleanup in one shot. On success you should see the two `verify` cases pass. On failure the compose logs are preserved under the case directory.

### Running pieces by hand (debug)

```bash
cd e2e
docker compose up -d                 # bring up oap/ui/banyandb
bash scripts/install-swctl.sh        # populate ./bin/swctl
(cd .. && npm run build)             # make dist/ for the harness
node harness/run.mjs                 # emit one synthetic error

# wait a few seconds for OAP to index, then:
./bin/swctl --display yaml --base-url http://127.0.0.1:12800/graphql browser service ls
./bin/swctl --display yaml --base-url http://127.0.0.1:12800/graphql browser logs ls --service-name mini-program-e2e

# visit http://localhost:8080 for the SkyWalking UI

docker compose down
```

## Milestone status

- **M1 (now)** — infrastructure + harness skeleton + one synthetic error path. The SDK's own exporters don't produce BrowserErrorLog JSON yet, so the harness temporarily does the translation.
- **M2** — replace `harness/exporter.mjs` with the real `SkyWalkingExporter` from `src/vendor/skywalking/`. Harness just calls `record('error', …)` (or later, triggers the actual collector's `wx.onError` callback) and lets the SDK do the work.
- **M3–M4** — extend the harness with perf + segment paths, add more verify cases.
