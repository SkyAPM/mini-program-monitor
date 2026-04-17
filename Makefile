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
        e2e release clean

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

e2e: build mock-backend-up
	@echo "=== WeChat OTLP ==="
	cd e2e && COLLECTOR_URL=http://127.0.0.1:4318 node harness/run.mjs
	@echo "=== Alipay OTLP ==="
	cd e2e && COLLECTOR_URL=http://127.0.0.1:4318 node harness/run-alipay.mjs
	@echo "=== WeChat tracing ==="
	cd e2e && COLLECTOR_URL=http://127.0.0.1:12801 node harness/run-tracing.mjs
	@echo "=== Alipay tracing ==="
	cd e2e && COLLECTOR_URL=http://127.0.0.1:12801 node harness/run-alipay-tracing.mjs
	@sleep 5
	@echo "=== Verify WeChat OTLP ==="
	cd e2e && node verify/check-otlp-wechat.mjs
	@echo "=== Verify Alipay OTLP ==="
	cd e2e && node verify/check-otlp-alipay.mjs
	@echo "=== Verify WeChat traces ==="
	cd e2e && MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces.mjs
	@echo "=== Verify Alipay traces ==="
	cd e2e && MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node verify/check-traces-alipay.mjs

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
