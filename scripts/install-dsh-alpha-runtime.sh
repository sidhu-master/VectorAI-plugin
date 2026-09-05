#!/bin/zsh
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
VECTORAI_ROOT="${SCRIPT_DIR:h}"
runtime_coordinates=("${(@f)$(node "$SCRIPT_DIR/dsh-runtime-manifest.mjs")}")
if [[ ${#runtime_coordinates[@]} -ne 3 ]]; then
  print -u2 -- "Could not read the tested DSH runtime baseline."
  exit 1
fi
DSH_VERSION="${runtime_coordinates[1]}"
DSH_TAG="${runtime_coordinates[2]}"
DSH_COMMIT="${runtime_coordinates[3]}"
RUNTIME_DIR="${1:-$HOME/Library/Application Support/VectorAI/dsh-runtime/$DSH_VERSION}"

if [[ ! -d "$RUNTIME_DIR/.git" ]]; then
  mkdir -p "${RUNTIME_DIR:h}"
  git clone --depth 1 --branch "$DSH_TAG" \
    https://github.com/deepseek-ai/deepseek-harness.git "$RUNTIME_DIR"
fi

actual_commit="$(git -C "$RUNTIME_DIR" rev-parse HEAD)"
if [[ "$actual_commit" != "$DSH_COMMIT" ]]; then
  print -u2 -- "DSH runtime commit mismatch: expected $DSH_COMMIT, got $actual_commit"
  exit 1
fi

actual_version="$(node -p "require(process.argv[1]).version" "$RUNTIME_DIR/package.json")"
if [[ "$actual_version" != "$DSH_VERSION" ]]; then
  print -u2 -- "DSH runtime version mismatch: expected $DSH_VERSION, got $actual_version"
  exit 1
fi

node "$SCRIPT_DIR/check-dsh-source-runtime.mjs" "$RUNTIME_DIR"

if [[ ! -x "$RUNTIME_DIR/apps/cli/lib/bin.js" ]]; then
  corepack pnpm@11.7.0 --dir "$RUNTIME_DIR" install --frozen-lockfile
  corepack pnpm@11.7.0 --dir "$RUNTIME_DIR" run build
  chmod +x "$RUNTIME_DIR/apps/cli/lib/bin.js"
fi

print -r -- "$RUNTIME_DIR/apps/cli/lib/bin.js"
