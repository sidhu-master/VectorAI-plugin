from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import ezdxf
from PySide6.QtCore import QUrl
from PySide6.QtGui import QFileOpenEvent

from vectorai_cad_preview.app import CadPreviewApplication
from vectorai_cad_preview.window import CadPreviewWindow, supported_drop_paths


def make_drawing(path: Path) -> Path:
    doc = ezdxf.new("R2010", setup=True)
    doc.layers.add("VISIBLE", color=4)
    doc.layers.add("OPTIONAL", color=3)
    modelspace = doc.modelspace()
    modelspace.add_line((0, 0), (40, 0), dxfattribs={"layer": "VISIBLE"})
    modelspace.add_line((0, 10), (40, 10), dxfattribs={"layer": "OPTIONAL"})
    modelspace.add_mtext("105", dxfattribs={"layer": "VISIBLE", "char_height": 3})
    doc.saveas(path)
    return path


def test_open_success_then_failure_preserves_the_loaded_drawing(qtbot, tmp_path: Path) -> None:
    errors: list[tuple[str, str]] = []
    window = CadPreviewWindow(show_error=lambda title, message: errors.append((title, message)))
    qtbot.addWidget(window)
    good = make_drawing(tmp_path / "sample.dxf")
    broken = tmp_path / "broken.dxf"
    broken.write_text("not dxf", encoding="utf-8")

    assert window.open_path(good) is True
    assert window.loaded is not None
    assert window.loaded.path == good.resolve()
    assert "sample.dxf" in window.windowTitle()
    assert window.layer_list.count() >= 2
    assert "3 个实体" in window.statusBar().currentMessage()
    previous_axes = len(window.figure.axes)

    assert window.open_path(broken) is False
    assert window.loaded.path == good.resolve()
    assert len(window.figure.axes) == previous_axes
    assert errors and "broken.dxf" in errors[-1][1]


def test_layer_toggle_redraws_without_changing_source_bytes(qtbot, tmp_path: Path) -> None:
    window = CadPreviewWindow(show_error=lambda _title, _message: None)
    qtbot.addWidget(window)
    source = make_drawing(tmp_path / "sample.dxf")
    original = source.read_bytes()
    assert window.open_path(source)

    window.set_layer_visible("OPTIONAL", False)

    assert "OPTIONAL" not in window.visible_layers
    assert window.render_summary is not None
    assert window.render_summary.visible_entity_count == 2
    assert source.read_bytes() == original


def test_export_current_png_uses_visible_layers(qtbot, tmp_path: Path) -> None:
    window = CadPreviewWindow(show_error=lambda _title, _message: None)
    qtbot.addWidget(window)
    assert window.open_path(make_drawing(tmp_path / "sample.dxf"))
    window.set_layer_visible("OPTIONAL", False)
    output = tmp_path / "export.png"

    assert window.export_current_png(output) is True
    assert output.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")


def test_drop_filter_accepts_only_local_dxf_files(tmp_path: Path) -> None:
    dxf = tmp_path / "part.DXF"
    text = tmp_path / "notes.txt"
    dxf.touch()
    text.touch()

    assert supported_drop_paths([QUrl.fromLocalFile(str(dxf)), QUrl.fromLocalFile(str(text))]) == [dxf]
    assert supported_drop_paths([QUrl("https://example.com/part.dxf")]) == []


def test_macos_file_open_event_routes_to_the_window(tmp_path: Path) -> None:
    path = tmp_path / "part.dxf"
    path.touch()

    class Window:
        opened: Path | None = None

        def open_path(self, candidate: Path) -> bool:
            self.opened = candidate
            return True

        def show(self) -> None:
            pass

        def raise_(self) -> None:
            pass

        def activateWindow(self) -> None:
            pass

    window = Window()
    fake_app = SimpleNamespace(window=window, pending_paths=[])

    assert CadPreviewApplication.event(fake_app, QFileOpenEvent(str(path))) is True
    assert window.opened == path
