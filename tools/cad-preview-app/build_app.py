from __future__ import annotations

import hashlib
import subprocess
import sys
import venv
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parent
VENV = APP_ROOT / ".venv"
VENV_PYTHON = VENV / "bin" / "python"
REQUIREMENTS = APP_ROOT / "requirements.txt"
MARKER = VENV / ".requirements.sha256"


def run(command: list[str], *, cwd: Path = APP_ROOT) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def ensure_environment() -> None:
    if not VENV_PYTHON.exists():
        venv.EnvBuilder(with_pip=True).create(VENV)
    digest = hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()
    if not MARKER.exists() or MARKER.read_text(encoding="utf-8").strip() != digest:
        run([str(VENV_PYTHON), "-m", "pip", "install", "-r", str(REQUIREMENTS)])
        MARKER.write_text(f"{digest}\n", encoding="utf-8")


def main() -> int:
    if sys.platform != "darwin":
        raise SystemExit("VectorAI CAD Preview can only be packaged on macOS")
    ensure_environment()
    run([str(VENV_PYTHON), str(APP_ROOT / "make_icon.py")])
    run([
        str(VENV_PYTHON),
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        str(APP_ROOT / "VectorAICADPreview.spec"),
    ])
    bundle = APP_ROOT / "dist" / "VectorAI CAD Preview.app"
    if not bundle.exists():
        raise SystemExit(f"missing application bundle: {bundle}")
    run(["codesign", "--force", "--deep", "--sign", "-", str(bundle)])
    print(bundle)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
