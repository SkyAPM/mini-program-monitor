# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

.PHONY: install build test typecheck lint \
        example-wx example-alipay examples \
        mock-backend-up mock-backend-down \
        check-otlp check-traces \
        oap-up oap-down \
        sim-build sim-run-wechat sim-run-alipay \
        preview preview-down \
        e2e release clean

# Resolved lazily so subcommands always see the current HEAD sha.
SIM_IMAGE_TAG ?= $(shell git rev-parse HEAD)
SIM_IMAGE_WECHAT = ghcr.io/skyapm/mini-program-monitor/sim-wechat:$(SIM_IMAGE_TAG)
SIM_IMAGE_ALIPAY = ghcr.io/skyapm/mini-program-monitor/sim-alipay:$(SIM_IMAGE_TAG)

# ── Core ──

install:
	npm ci

build: install
	npx tsup

test: install
	npx vitest run

typecheck: install
	npx tsc --noEmit

# ── Examples ──

example-wx: build
	cd example-wx && rm -rf node_modules miniprogram_npm package-lock.json && npm install

example-alipay: build
	cd example-alipay && rm -rf node_modules package-lock.json && npm install
	@echo "Alipay example ready — open example-alipay/ in Alipay Developer Tools"

examples: example-wx example-alipay

# ── E2E ──

mock-backend-up:
	cd e2e && docker compose up -d
	docker rm -f otel-collector 2>/dev/null || true
	docker run -d --name otel-collector -p 4318:4318 -v $(shell pwd)/e2e/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml otel/opentelemetry-collector-contrib:latest

mock-backend-down:
	docker rm -f otel-collector 2>/dev/null || true
	cd e2e && docker compose down

oap-up:
	cd e2e && docker compose -f docker-compose.yml -f docker-compose.oap.yml up -d

oap-down:
	cd e2e && docker compose -f docker-compose.yml -f docker-compose.oap.yml down

e2e: sim-build mock-backend-up
	@sleep 3
	@echo "=== WeChat sim (baseline / proto) ==="
	docker run --rm --network host \
		-e MODE=timed -e DURATION_MS=15000 -e SCENARIO=baseline -e ENCODING=proto \
		-e COLLECTOR_URL=http://127.0.0.1:4318 -e TRACE_COLLECTOR_URL=http://127.0.0.1:12801 \
		$(SIM_IMAGE_WECHAT)
	@sleep 5
	@echo "=== Verify WeChat ==="
	cd e2e && node verify/check-otlp-wechat.mjs
	cd e2e && MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces.mjs
	@$(MAKE) mock-backend-down >/dev/null 2>&1; $(MAKE) mock-backend-up >/dev/null 2>&1; sleep 3
	@echo "=== Alipay sim (baseline / proto) ==="
	docker run --rm --network host \
		-e MODE=timed -e DURATION_MS=15000 -e SCENARIO=baseline -e ENCODING=proto \
		-e COLLECTOR_URL=http://127.0.0.1:4318 -e TRACE_COLLECTOR_URL=http://127.0.0.1:12801 \
		$(SIM_IMAGE_ALIPAY)
	@sleep 5
	@echo "=== Verify Alipay ==="
	cd e2e && node verify/check-otlp-alipay.mjs
	cd e2e && MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces-alipay.mjs

# ── Simulator images ──

sim-build: build
	docker build --build-arg PLATFORM=wechat -f Dockerfile.sim -t $(SIM_IMAGE_WECHAT) .
	docker build --build-arg PLATFORM=alipay -f Dockerfile.sim -t $(SIM_IMAGE_ALIPAY) .

sim-run-wechat:
	docker run --rm --network host \
		-e MODE=timed -e DURATION_MS=10000 -e SCENARIO=$(or $(SCENARIO),demo) \
		-e ENCODING=$(or $(ENCODING),proto) \
		-e COLLECTOR_URL=http://127.0.0.1:4318 \
		-e TRACE_COLLECTOR_URL=http://127.0.0.1:12801 \
		-e DEBUG=true \
		$(SIM_IMAGE_WECHAT)

sim-run-alipay:
	docker run --rm --network host \
		-e MODE=timed -e DURATION_MS=10000 -e SCENARIO=$(or $(SCENARIO),demo) \
		-e ENCODING=$(or $(ENCODING),proto) \
		-e COLLECTOR_URL=http://127.0.0.1:4318 \
		-e TRACE_COLLECTOR_URL=http://127.0.0.1:12801 \
		-e DEBUG=true \
		$(SIM_IMAGE_ALIPAY)

# ── Preview: full OAP stack + both simulators in loop mode ──

preview: sim-build
	@echo "Starting OAP + UI + simulators (SIM_IMAGE_TAG=$(SIM_IMAGE_TAG))"
	cd e2e && SIM_IMAGE_TAG=$(SIM_IMAGE_TAG) docker compose \
		-f docker-compose.yml \
		-f docker-compose.oap.yml \
		-f docker-compose.preview.yml up -d
	@echo ""
	@echo "SkyWalking UI: http://127.0.0.1:8080 (data populates in ~30s)"
	@echo "Stop with: make preview-down"

preview-down:
	cd e2e && SIM_IMAGE_TAG=$(SIM_IMAGE_TAG) docker compose \
		-f docker-compose.yml \
		-f docker-compose.oap.yml \
		-f docker-compose.preview.yml down

# ── Peek at local e2e state ──

check-otlp:
	@docker logs otel-collector 2>&1 | grep -E "Name:|Value:|SeverityText:|Body:|service.name:|miniprogram" || echo "(no OTLP data yet — run 'make e2e' or exercise the example app first)"

check-traces:
	@curl -sS http://127.0.0.1:12801/receiveData || echo "(mock-collector not reachable — run 'make mock-backend-up' first)"

# ── Release ──

release:
	bash scripts/release.sh

# ── Clean ──

clean:
	rm -rf dist node_modules
	rm -rf example-wx/node_modules example-wx/miniprogram_npm example-wx/package-lock.json
	rm -rf example-alipay/node_modules example-alipay/package-lock.json
