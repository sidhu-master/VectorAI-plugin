#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dir="$project_root/.local/vectorai/cv-venv"
python_command="${VECTORAI_BOOTSTRAP_PYTHON:-python3}"

if [[ ! -x "$runtime_dir/bin/python" ]]; then
  "$python_command" -m venv "$runtime_dir"
fi

"$runtime_dir/bin/python" -m pip install --disable-pip-version-check \
  -r "$project_root/python/requirements-vectorization.txt"

"$runtime_dir/bin/python" -c \
  'import cv2, numpy, scipy, skimage; print("VectorAI CV runtime ready")'
