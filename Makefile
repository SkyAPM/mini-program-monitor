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
        mock-backend-up mock-backend-down e2e clean

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
	cd example-wx && npm install

example-alipay: build
	cd example-alipay && npm install

examples: example-wx example-alipay

# ── E2E ──

mock-backend-up:
	cd e2e && docker compose up -d

mock-backend-down:
	cd e2e && docker compose down

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

# ── Clean ──

clean:
	rm -rf dist node_modules
	rm -rf example-wx/node_modules example-wx/miniprogram_npm example-wx/package-lock.json
	rm -rf example-alipay/node_modules example-alipay/package-lock.json
