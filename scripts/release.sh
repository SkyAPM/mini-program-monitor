#!/usr/bin/env bash
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

# Release script for mini-program-monitor.
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.1.0

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Releasing v${VERSION} ==="

# 1. Verify clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean. Commit or stash changes first."
  exit 1
fi

# 2. Verify on main branch
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: must be on main branch (currently on $BRANCH)"
  exit 1
fi

# 3. Run tests
echo "--- typecheck ---"
make typecheck

echo "--- test ---"
make test

# 4. Build
echo "--- build ---"
make build

# 5. Bump version in package.json (no git tag yet)
npm version "$VERSION" --no-git-tag-version

# 6. Update description to include Alipay
sed -i '' 's/"description": ".*"/"description": "WeChat and Alipay Mini Program monitoring agent for Apache SkyWalking"/' package.json

# 7. Commit version bump
git add package.json package-lock.json
git commit -m "release: v${VERSION}"
git tag "v${VERSION}"

echo ""
echo "=== v${VERSION} tagged ==="
echo ""
echo "Next steps:"
echo "  1. git push origin main --follow-tags"
echo "  2. npm publish --access public"
echo "  3. Verify: https://www.npmjs.com/package/mini-program-monitor"
echo ""
echo "Or dry-run first:"
echo "  npm publish --access public --dry-run"
