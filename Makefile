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
        e2e clean

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

mock-backend-down:
	cd e2e && docker compose down

oap-up:
	cd e2e && docker compose -f docker-compose.yml -f docker-compose.oap.yml up -d

oap-down:
	cd e2e && docker compose -f docker-compose.yml -f docker-compose.oap.yml down

e2e: build mock-backend-up
	@echo "=== WeChat OTLP ==="
	node e2e/harness/run.mjs
	@echo "=== Alipay OTLP ==="
	node e2e/harness/run-alipay.mjs
	@echo "=== Tracing ==="
	node e2e/harness/run-tracing.mjs
	@sleep 5
	@echo "=== Verify OTLP ==="
	COMPOSE_DIR=e2e node e2e/verify/check-otlp.mjs
	@echo "=== Verify Traces ==="
	MOCK_COLLECTOR_URL=http://127.0.0.1:12801 node e2e/verify/check-traces.mjs

# ── Verify ──
#
# check-otlp: reads OTel Collector debug logs and verifies:
#   - miniprogram.app_launch.duration metric exists
#   - miniprogram.first_render.duration metric exists
#   - miniprogram.first_paint.time metric exists
#   - miniprogram.request.duration metric exists
#   - Error log with severityNumber=17 (ERROR) exists
#   - Error log body contains the exception message
#   - Error log has exception.type attribute
#   - Resource attribute service.name matches expected value
#   - Resource attribute miniprogram.platform = wechat or alipay
#
# check-traces: reads mock-collector /receiveData and verifies:
#   - Segment contains the expected service name
#   - Span peer matches the target domain (e.g. httpbin.org)
#   - Span layer = Http
#   - Span type = Exit
#   - Span has http.method tag
#   - http.method tag value = GET

check-otlp:
	@cd e2e && docker compose logs otel-collector 2>&1 | grep -E "Name:|Value:|SeverityText:|Body:|service.name:|miniprogram" || echo "(no OTLP data yet — click buttons in the example app first)"

check-traces:
	@curl -sS http://127.0.0.1:12801/receiveData || echo "(mock-collector not reachable — run 'make mock-backend-up' first)"

# ── Clean ──

clean:
	rm -rf dist node_modules
	rm -rf example-wx/node_modules example-wx/miniprogram_npm example-wx/package-lock.json
	rm -rf example-alipay/node_modules example-alipay/package-lock.json
