#!/bin/zsh
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

APP_SOURCE_DIR="${0:A:h}"
VECTORAI_ROOT="${APP_SOURCE_DIR:h:h}"
OUTPUT_APP="${1:-$APP_SOURCE_DIR/Build/DSH.app}"
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT

BUNDLE="$TEMP_ROOT/DSH.app"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"

swiftc -O \
  -framework AppKit \
  -framework WebKit \
  "$APP_SOURCE_DIR/Sources/LauncherCore.swift" \
  "$APP_SOURCE_DIR/Sources/LauncherApp.swift" \
  -o "$BUNDLE/Contents/MacOS/DSH"

cp "$APP_SOURCE_DIR/Info.plist" "$BUNDLE/Contents/Info.plist"
cp "$APP_SOURCE_DIR/Resources/AppIcon.icns" "$BUNDLE/Contents/Resources/AppIcon.icns"
cp "$VECTORAI_ROOT/scripts/dsh-inline-workspace-patch.mjs" \
  "$BUNDLE/Contents/Resources/dsh-inline-workspace-patch.mjs"
codesign --force --deep --sign - "$BUNDLE"

mkdir -p "${OUTPUT_APP:h}"
if [[ -e "$OUTPUT_APP" ]]; then
  rm -rf "$OUTPUT_APP"
fi
mv "$BUNDLE" "$OUTPUT_APP"
print -r -- "$OUTPUT_APP"
