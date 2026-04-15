#!/usr/bin/env bash
# Install Apache SkyWalking CLI (swctl) into e2e/bin/swctl so that e2e.yaml
# verify steps can call it via ./bin/swctl. Release-pinned so upgrades are
# intentional — bump SW_CTL_VERSION below when upstream cuts a new release.
#
# Apache SkyWalking does not attach binaries to GitHub releases; sources
# and binaries ship from archive.apache.org under /dist/skywalking/cli/.
set -euo pipefail

SW_CTL_VERSION="${SW_CTL_VERSION:-0.14.0}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

HERE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HERE/bin"

if [ -x "$HERE/bin/swctl" ]; then
  echo "swctl already installed: $($HERE/bin/swctl --version 2>&1 | head -1)"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="https://archive.apache.org/dist/skywalking/cli/${SW_CTL_VERSION}/skywalking-cli-${SW_CTL_VERSION}-bin.tgz"
echo "downloading $URL"
curl -sSfL "$URL" -o "$TMP/swctl.tgz"
tar -xz -C "$TMP" -f "$TMP/swctl.tgz"

BIN="$(find "$TMP" -type f -name "swctl-${SW_CTL_VERSION}-${OS}-${ARCH}" | head -1)"
if [ -z "$BIN" ]; then
  echo "could not find swctl binary for ${OS}-${ARCH} in release archive" >&2
  find "$TMP" -type f -name 'swctl*' >&2
  exit 1
fi

cp "$BIN" "$HERE/bin/swctl"
chmod +x "$HERE/bin/swctl"
"$HERE/bin/swctl" --version
