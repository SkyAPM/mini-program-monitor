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
#
# Reads the current version from package.json, confirms with the user,
# creates a release commit + tag, then bumps to the next development
# version.
#
# Usage: make release

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

# 3. Read current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version in package.json: ${CURRENT_VERSION}"

# 4. Derive release version (strip -dev, -alpha, -SNAPSHOT suffixes)
RELEASE_VERSION=$(echo "$CURRENT_VERSION" | sed -E 's/-(dev|alpha|beta|SNAPSHOT|rc)\.[0-9]+$//')
RELEASE_VERSION=$(echo "$RELEASE_VERSION" | sed -E 's/-(dev|alpha|beta|SNAPSHOT|rc)$//')

echo ""
read -p "Release version [${RELEASE_VERSION}]: " INPUT_VERSION
RELEASE_VERSION="${INPUT_VERSION:-$RELEASE_VERSION}"

# 5. Derive next development version (bump minor)
IFS='.' read -r MAJOR MINOR PATCH <<< "$RELEASE_VERSION"
NEXT_VERSION="${MAJOR}.$((MINOR + 1)).0-dev"

echo ""
read -p "Next development version [${NEXT_VERSION}]: " INPUT_NEXT
NEXT_VERSION="${INPUT_NEXT:-$NEXT_VERSION}"

echo ""
echo "=== Release plan ==="
echo "  Release:     ${RELEASE_VERSION}  (tag: v${RELEASE_VERSION})"
echo "  Next dev:    ${NEXT_VERSION}"
echo ""
read -p "Proceed? [y/N]: " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# 6. Run tests
echo ""
echo "--- typecheck ---"
make typecheck

echo "--- test ---"
make test

# 7. Build
echo "--- build ---"
make build

# 8. Release commit + tag
npm version "$RELEASE_VERSION" --no-git-tag-version
git add package.json package-lock.json
git commit -m "release: v${RELEASE_VERSION}"
git tag "v${RELEASE_VERSION}"

echo ""
echo "=== Tagged v${RELEASE_VERSION} ==="

# 9. Next development version commit
npm version "$NEXT_VERSION" --no-git-tag-version
git add package.json package-lock.json
git commit -m "build: bump version to ${NEXT_VERSION} for development"

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  git push origin main --follow-tags"
echo "  # GHA will publish v${RELEASE_VERSION} to npm on tag push"
