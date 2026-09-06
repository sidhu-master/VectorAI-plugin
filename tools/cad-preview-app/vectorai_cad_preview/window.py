from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterable

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QAction, QDragEnterEvent, QDropEvent
from PySide6.QtWidgets import (
    QDockWidget,
    QFileDialog,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QSizePolicy,
    QToolBar,
)

from .model import LoadedDrawing, RenderSummary
from .renderer import DxfPreviewError, draw_loaded_dxf, export_png, load_dxf


ErrorPresenter = Callable[[str, str], None]


def supported_drop_paths(urls: Iterable[QUrl]) -> list[Path]:
    return [
        Path(url.toLocalFile())
        for url in urls
        if url.isLocalFile() and Path(url.toLocalFile()).suffix.lower() == ".dxf"
    ]


class InteractiveFigureCanvas(FigureCanvasQTAgg):
    def __init__(self, figure: Figure) -> None:
        super().__init__(figure)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setStyleSheet("background-color: #10171d;")
        self._fit_callback: Callable[[], None] | None = None
        self._drag_axes = None
        self._drag_point: tuple[float, float] | None = None
        self.mpl_connect("scroll_event", self._on_scroll)
        self.mpl_connect("button_press_event", self._on_press)
        self.mpl_connect("motion_notify_event", self._on_motion)
        self.mpl_connect("button_release_event", self._on_release)

    def set_fit_callback(self, callback: Callable[[], None]) -> None:
        self._fit_callback = callback

    def zoom_at(self, axes, x: float, y: float, scale: float) -> None:
        left, right = axes.get_xlim()
        bottom, top = axes.get_ylim()
        axes.set_xlim(x + (left - x) * scale, x + (right - x) * scale)
        axes.set_ylim(y + (bottom - y) * scale, y + (top - y) * scale)
        self.draw_idle()

    def pan_by(self, axes, dx: float, dy: float) -> None:
        left, right = axes.get_xlim()
        bottom, top = axes.get_ylim()
        axes.set_xlim(left - dx, right - dx)
        axes.set_ylim(bottom - dy, top - dy)
        self.draw_idle()

    def _on_scroll(self, event) -> None:
        if event.inaxes is None or event.xdata is None or event.ydata is None:
            return
        self.zoom_at(event.inaxes, event.xdata, event.ydata, 0.8 if event.button == "up" else 1.25)

    def _on_press(self, event) -> None:
        if event.dblclick and event.button == 1:
            if self._fit_callback is not None:
                self._fit_callback()
            return
        if event.button == 1 and event.inaxes is not None and event.xdata is not None and event.ydata is not None:
            self._drag_axes = event.inaxes
            self._drag_point = (event.xdata, event.ydata)

    def _on_motion(self, event) -> None:
        if (
            self._drag_axes is None
            or self._drag_point is None
            or event.inaxes is not self._drag_axes
            or event.xdata is None
            or event.ydata is None
        ):
            return
        previous_x, previous_y = self._drag_point
        self.pan_by(self._drag_axes, event.xdata - previous_x, event.ydata - previous_y)
        self._drag_point = (event.xdata, event.ydata)

    def _on_release(self, _event) -> None:
        self._drag_axes = None
        self._drag_point = None


class CadPreviewWindow(QMainWindow):
    def __init__(self, *, show_error: ErrorPresenter | None = None) -> None:
        super().__init__()
        self.loaded: LoadedDrawing | None = None
        self.render_summary: RenderSummary | None = None
        self.visible_layers: set[str] = set()
        self._show_error = show_error or self._show_error_dialog
        self._updating_layers = False

        self.setWindowTitle("VectorAI CAD Preview")
        self.resize(1280, 800)
        self.setAcceptDrops(True)

        self.figure = Figure(figsize=(12.8, 8), dpi=100)
        self.figure.patch.set_facecolor("#10171d")
        self.canvas = InteractiveFigureCanvas(self.figure)
        self.canvas.set_fit_callback(self.fit_drawing)
        self.setCentralWidget(self.canvas)

        self.layer_list = QListWidget()
        self.layer_list.itemChanged.connect(self._layer_item_changed)
        self.layer_dock = QDockWidget("图层", self)
        self.layer_dock.setObjectName("layers")
        self.layer_dock.setWidget(self.layer_list)
        self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, self.layer_dock)
        self.layer_dock.hide()

        self._build_actions()
        self.statusBar().showMessage("拖入 DXF，或点击“打开 DXF”")

    def _build_actions(self) -> None:
        toolbar = QToolBar("预览工具", self)
        toolbar.setMovable(False)
        self.addToolBar(toolbar)

        open_action = QAction("打开 DXF", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.choose_file)
        toolbar.addAction(open_action)

        fit_action = QAction("适应窗口", self)
        fit_action.setShortcut("F")
        fit_action.triggered.connect(self.fit_drawing)
        toolbar.addAction(fit_action)

        self.layers_action = QAction("图层", self)
        self.layers_action.setCheckable(True)
        self.layers_action.setChecked(False)
        self.layers_action.toggled.connect(self.layer_dock.setVisible)
        self.layer_dock.visibilityChanged.connect(self.layers_action.setChecked)
        toolbar.addAction(self.layers_action)

        export_action = QAction("导出 PNG", self)
        export_action.setShortcut("Ctrl+Shift+S")
        export_action.triggered.connect(self.choose_export_path)
        toolbar.addAction(export_action)

    def choose_file(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(self, "打开 DXF", "", "DXF 图纸 (*.dxf *.DXF)")
        if filename:
            self.open_path(Path(filename))

    def open_path(self, path: Path) -> bool:
        try:
            candidate = load_dxf(path)
            default_layers = frozenset(layer.name for layer in candidate.layers if layer.visible)
            summary = draw_loaded_dxf(candidate, self.figure, default_layers, fill_canvas=True)
            if summary.bounds is None:
                raise DxfPreviewError(f"图纸没有可显示的模型空间内容：{candidate.path.name}")
        except DxfPreviewError as exc:
            self._show_error("无法打开 DXF", str(exc))
            return False

        self.loaded = candidate
        self.render_summary = summary
        self.visible_layers = set(default_layers)
        self._replace_layer_items(candidate)
        self.setWindowTitle(f"{candidate.path.name} — VectorAI CAD Preview")
        self._update_status()
        self.canvas.draw_idle()
        return True

    def fit_drawing(self) -> None:
        if self.loaded is None:
            return
        self._redraw()

    def set_layer_visible(self, layer_name: str, visible: bool) -> None:
        if visible:
            self.visible_layers.add(layer_name)
        else:
            self.visible_layers.discard(layer_name)
        self._updating_layers = True
        try:
            for index in range(self.layer_list.count()):
                item = self.layer_list.item(index)
                if item.data(Qt.ItemDataRole.UserRole) == layer_name:
                    item.setCheckState(Qt.CheckState.Checked if visible else Qt.CheckState.Unchecked)
                    break
        finally:
            self._updating_layers = False
        self._redraw()

    def export_current_png(self, path: Path) -> bool:
        if self.loaded is None:
            self._show_error("无法导出 PNG", "请先打开一份 DXF 图纸。")
            return False
        try:
            export_png(self.loaded, path, frozenset(self.visible_layers))
        except DxfPreviewError as exc:
            self._show_error("无法导出 PNG", str(exc))
            return False
        self.statusBar().showMessage(f"已导出 {path.name}")
        return True

    def choose_export_path(self) -> None:
        if self.loaded is None:
            self._show_error("无法导出 PNG", "请先打开一份 DXF 图纸。")
            return
        suggested = str(self.loaded.path.with_suffix(".png"))
        filename, _ = QFileDialog.getSaveFileName(self, "导出 PNG", suggested, "PNG 图片 (*.png)")
        if filename:
            self.export_current_png(Path(filename))

    def dragEnterEvent(self, event: QDragEnterEvent) -> None:
        if supported_drop_paths(event.mimeData().urls()):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event: QDropEvent) -> None:
        paths = supported_drop_paths(event.mimeData().urls())
        if paths and self.open_path(paths[0]):
            event.acceptProposedAction()
        else:
            event.ignore()

    def _replace_layer_items(self, loaded: LoadedDrawing) -> None:
        self._updating_layers = True
        try:
            self.layer_list.clear()
            for layer in loaded.layers:
                item = QListWidgetItem(layer.name)
                item.setData(Qt.ItemDataRole.UserRole, layer.name)
                item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                item.setCheckState(
                    Qt.CheckState.Checked if layer.name in self.visible_layers else Qt.CheckState.Unchecked
                )
                self.layer_list.addItem(item)
        finally:
            self._updating_layers = False

    def _layer_item_changed(self, item: QListWidgetItem) -> None:
        if self._updating_layers:
            return
        name = str(item.data(Qt.ItemDataRole.UserRole))
        self.set_layer_visible(name, item.checkState() == Qt.CheckState.Checked)

    def _redraw(self) -> None:
        if self.loaded is None:
            return
        try:
            self.render_summary = draw_loaded_dxf(
                self.loaded,
                self.figure,
                frozenset(self.visible_layers),
                fill_canvas=True,
            )
        except DxfPreviewError as exc:
            self._show_error("无法渲染 DXF", str(exc))
            return
        self._update_status()
        self.canvas.draw_idle()

    def _update_status(self) -> None:
        if self.loaded is None:
            return
        self.statusBar().showMessage(
            f"{self.loaded.entity_count} 个实体 · {len(self.loaded.layers)} 个图层 · "
            f"audit {self.loaded.audit_errors} 错误 / {self.loaded.audit_fixes} 修复"
        )

    def _show_error_dialog(self, title: str, message: str) -> None:
        QMessageBox.critical(self, title, message)
