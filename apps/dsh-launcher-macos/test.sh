#!/bin/zsh
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

APP_SOURCE_DIR="${0:A:h}"
BUILD_DIR="$APP_SOURCE_DIR/Build"
mkdir -p "$BUILD_DIR"

if grep -q '\.fullSizeContentView' "$APP_SOURCE_DIR/Sources/LauncherApp.swift"; then
  print -u2 -- "FAIL: web content must start below the native draggable titlebar"
  exit 1
fi

print -r -- "PASS: native titlebar remains a dedicated drag and content-safe area"

swiftc \
  "$APP_SOURCE_DIR/Sources/DSHRuntimeBaseline.generated.swift" \
  "$APP_SOURCE_DIR/Sources/LauncherCore.swift" \
  "$APP_SOURCE_DIR/Sources/DSHVersion.swift" \
  "$APP_SOURCE_DIR/Sources/UpdateChecker.swift" \
  "$APP_SOURCE_DIR/Sources/RuntimeRegistry.swift" \
  "$APP_SOURCE_DIR/Sources/RuntimeInstaller.swift" \
  "$APP_SOURCE_DIR/Sources/UpdateCoordinator.swift" \
  "$APP_SOURCE_DIR/Tests/LauncherCoreTests.swift" \
  -o "$BUILD_DIR/LauncherCoreTests"

"$BUILD_DIR/LauncherCoreTests"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
TEST_APP="$TEST_ROOT/DSH.app"
"$APP_SOURCE_DIR/build.sh" "$TEST_APP" >/dev/null

if [[ ! -f "$TEST_APP/Contents/Resources/AppIcon.icns" ]]; then
  print -u2 -- "FAIL: built DSH app contains its declared icon resource"
  exit 1
fi

if [[ "$(plutil -extract CFBundleIconFile raw -o - "$TEST_APP/Contents/Info.plist")" != "AppIcon" ]]; then
  print -u2 -- "FAIL: built DSH app declares AppIcon"
  exit 1
fi

print -r -- "PASS: built DSH app contains its declared icon resource"
