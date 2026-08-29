#!/bin/zsh
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

DSH_TAG="dsh-v0.1.2-alpha.1"
DSH_COMMIT="cd5ef8148158c3a752a658978873241fdf8e2bbc"
RUNTIME_DIR="${1:-$HOME/Library/Application Support/VectorAI/dsh-runtime/0.1.2-alpha.1}"

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
if [[ "$actual_version" != "0.1.2-alpha.1" ]]; then
  print -u2 -- "DSH runtime version mismatch: $actual_version"
  exit 1
fi

if [[ ! -x "$RUNTIME_DIR/apps/cli/lib/bin.js" ]]; then
  corepack pnpm@11.7.0 --dir "$RUNTIME_DIR" install --frozen-lockfile
  corepack pnpm@11.7.0 --dir "$RUNTIME_DIR" run build
  chmod +x "$RUNTIME_DIR/apps/cli/lib/bin.js"
fi

print -r -- "$RUNTIME_DIR/apps/cli/lib/bin.js"
