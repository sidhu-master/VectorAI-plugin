from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QEvent
from PySide6.QtGui import QFileOpenEvent
from PySide6.QtWidgets import QApplication

from .window import CadPreviewWindow


class CadPreviewApplication(QApplication):
    def __init__(self, arguments: list[str]) -> None:
        super().__init__(arguments)
        self.window: CadPreviewWindow | None = None
        self.pending_paths: list[Path] = []

    def event(self, event) -> bool:
        if event.type() == QEvent.Type.FileOpen and isinstance(event, QFileOpenEvent):
            path = Path(event.file())
            if self.window is None:
                self.pending_paths.append(path)
            else:
                self.window.open_path(path)
                self.window.show()
                self.window.raise_()
                self.window.activateWindow()
            return True
        return super().event(event)


def main() -> int:
    app = CadPreviewApplication(sys.argv)
    app.setApplicationName("VectorAI CAD Preview")
    app.setOrganizationName("VectorAI")
    window = CadPreviewWindow()
    app.window = window
    window.show()

    command_line_paths = [Path(value) for value in sys.argv[1:] if value.lower().endswith(".dxf")]
    paths = [*app.pending_paths, *command_line_paths]
    if paths:
        window.open_path(paths[-1])
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
