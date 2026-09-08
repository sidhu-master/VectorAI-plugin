from __future__ import annotations

import json
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = APP_ROOT.parents[1]


def test_pyinstaller_spec_declares_macos_identity_and_dxf_documents() -> None:
    spec = (APP_ROOT / "VectorAICADPreview.spec").read_text(encoding="utf-8")

    assert 'name="VectorAI CAD Preview.app"' in spec
    assert 'bundle_identifier="com.vectorai.cadpreview"' in spec
    assert '"CFBundleDocumentTypes"' in spec
    assert '"CFBundleTypeExtensions": ["dxf"]' in spec
    assert "collect_data_files(\"ezdxf\")" in spec
    assert 'icon=str(APP_ROOT / "assets" / "AppIcon.icns")' in spec


def test_root_package_exposes_the_app_build_command() -> None:
    package = json.loads((REPOSITORY_ROOT / "package.json").read_text(encoding="utf-8"))

    assert package["scripts"]["build:cad-preview-app"] == (
        "python3 tools/cad-preview-app/build_app.py"
    )
