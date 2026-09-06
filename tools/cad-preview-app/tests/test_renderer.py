from __future__ import annotations

from pathlib import Path

import ezdxf
import pytest

from vectorai_cad_preview.renderer import (
    DxfPreviewError,
    draw_loaded_dxf,
    export_png,
    load_dxf,
)


def make_drawing(path: Path) -> Path:
    doc = ezdxf.new("R2010", setup=True)
    doc.layers.add("VISIBLE", color=4)
    doc.layers.add("OPTIONAL", color=3)
    modelspace = doc.modelspace()
    modelspace.add_line((0, 0), (40, 0), dxfattribs={"layer": "VISIBLE"})
    modelspace.add_line((0, 10), (40, 10), dxfattribs={"layer": "OPTIONAL"})
    modelspace.add_mtext(
        r"{\fArial|b0|i0;尺寸链}\P\W0.707;105",
        dxfattribs={"layer": "VISIBLE", "char_height": 3},
    ).set_location((10, 5))
    doc.saveas(path)
    return path


def test_loads_layers_and_audit_counts(tmp_path: Path) -> None:
    loaded = load_dxf(make_drawing(tmp_path / "drawing.dxf"))

    assert loaded.path.name == "drawing.dxf"
    assert [layer.name for layer in loaded.layers if layer.name in {"VISIBLE", "OPTIONAL"}] == [
        "VISIBLE",
        "OPTIONAL",
    ]
    assert loaded.entity_count == 3
    assert loaded.audit_errors == 0


def test_renders_filtered_layers_and_plain_mtext(tmp_path: Path) -> None:
    from matplotlib.figure import Figure

    loaded = load_dxf(make_drawing(tmp_path / "drawing.dxf"))
    figure = Figure(figsize=(8, 4), dpi=100)

    summary = draw_loaded_dxf(loaded, figure, frozenset({"VISIBLE"}))

    assert summary.visible_entity_count == 2
    assert summary.bounds is not None
    assert "尺寸链\n105" in summary.visible_texts
    assert all("\\f" not in text and "\\W" not in text for text in summary.visible_texts)
    assert figure.axes[0].get_facecolor()[:3] == pytest.approx((16 / 255, 23 / 255, 29 / 255))


def test_exports_non_empty_png(tmp_path: Path) -> None:
    loaded = load_dxf(make_drawing(tmp_path / "drawing.dxf"))
    output = tmp_path / "drawing.png"

    summary = export_png(loaded, output, frozenset({"VISIBLE"}), dpi=100)

    assert summary.visible_entity_count == 2
    assert output.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert output.stat().st_size > 1_000


def test_invalid_dxf_reports_the_filename(tmp_path: Path) -> None:
    path = tmp_path / "broken.dxf"
    path.write_text("not a DXF", encoding="utf-8")

    with pytest.raises(DxfPreviewError, match="broken.dxf"):
        load_dxf(path)
