from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from vectorai_cad_preview.renderer import export_png, load_dxf


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_ROOT = REPOSITORY_ROOT / ".local" / "cad-preview-app-acceptance"
CASES = {
    "golden": Path("/Users/sidhu/Downloads/样本图001.dxf"),
    "initial": Path("/Users/sidhu/Downloads/初始图.dxf"),
    "current-export": Path("/Users/sidhu/Downloads/#样本图001.dxf"),
}


@pytest.mark.skipif(
    not all(path.exists() for path in CASES.values()),
    reason="local CAD acceptance files are unavailable",
)
def test_real_drawings_render_without_raw_mtext_controls() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {}

    for name, path in CASES.items():
        if not path.exists():
            continue
        loaded = load_dxf(path)
        output = OUTPUT_ROOT / f"{name}.png"
        summary = export_png(loaded, output)

        assert loaded.entity_count > 0, name
        assert summary.visible_entity_count > 0, name
        assert summary.bounds is not None, name
        assert output.stat().st_size > 10_000, name
        assert all("\\f" not in text and "\\F" not in text and "\\W" not in text for text in summary.visible_texts), name
        if name != "initial":
            assert summary.visible_texts, name

        report[name] = {
            "source": str(path),
            "entities": loaded.entity_count,
            "visibleEntities": summary.visible_entity_count,
            "layers": len(loaded.layers),
            "auditErrors": loaded.audit_errors,
            "auditFixes": loaded.audit_fixes,
            "visibleTexts": list(summary.visible_texts),
            "bounds": summary.bounds,
            "png": str(output),
            "pngSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        }

    assert set(report) == set(CASES)
    (OUTPUT_ROOT / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
