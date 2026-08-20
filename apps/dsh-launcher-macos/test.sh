#!/bin/zsh
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

APP_SOURCE_DIR="${0:A:h}"
BUILD_DIR="$APP_SOURCE_DIR/Build"
mkdir -p "$BUILD_DIR"

swiftc \
  "$APP_SOURCE_DIR/Sources/LauncherCore.swift" \
  "$APP_SOURCE_DIR/Tests/LauncherCoreTests.swift" \
  -o "$BUILD_DIR/LauncherCoreTests"

"$BUILD_DIR/LauncherCoreTests"
