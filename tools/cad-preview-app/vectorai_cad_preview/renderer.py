from __future__ import annotations

from pathlib import Path
from typing import Iterable

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.entities import DXFGraphic
from matplotlib.figure import Figure

from .model import LayerRecord, LoadedDrawing, RenderSummary


BACKGROUND = "#10171d"


class DxfPreviewError(RuntimeError):
    """A DXF could not be loaded or rendered for preview."""


def load_dxf(path: Path) -> LoadedDrawing:
    resolved = path.expanduser().resolve()
    try:
        document = ezdxf.readfile(resolved)
        auditor = document.audit()
        modelspace = document.modelspace()
    except Exception as exc:
        raise DxfPreviewError(f"无法打开 {resolved.name}: {exc}") from exc

    layers = tuple(
        LayerRecord(
            name=layer.dxf.name,
            color=abs(int(layer.dxf.get("color", 7))),
            visible=not layer.is_off() and not layer.is_frozen(),
        )
        for layer in document.layers
    )
    return LoadedDrawing(
        path=resolved,
        document=document,
        layers=layers,
        audit_errors=len(auditor.errors),
        audit_fixes=len(auditor.fixes),
        entity_count=len(modelspace),
    )


def draw_loaded_dxf(
    loaded: LoadedDrawing,
    figure: Figure,
    visible_layers: frozenset[str] | None = None,
    *,
    fill_canvas: bool = False,
) -> RenderSummary:
    figure.clear()
    figure.set_facecolor(BACKGROUND)
    axes = figure.add_axes((0, 0, 1, 1))
    axes.set_facecolor(BACKGROUND)

    modelspace = loaded.document.modelspace()
    entities = tuple(modelspace)
    allowed = visible_layers if visible_layers is not None else frozenset(
        layer.name for layer in loaded.layers if layer.visible
    )

    def is_visible(entity: DXFGraphic) -> bool:
        return entity.dxf.get("layer", "0") in allowed

    try:
        Frontend(
            RenderContext(loaded.document),
            MatplotlibBackend(axes, adjust_figure=not fill_canvas),
        ).draw_layout(modelspace, finalize=True, filter_func=is_visible)
    except Exception as exc:
        raise DxfPreviewError(f"无法渲染 {loaded.path.name}: {exc}") from exc

    axes.set_aspect("equal", adjustable="datalim" if fill_canvas else "box", anchor="C")
    # ezdxf owns the axes background, while the surrounding letterbox belongs
    # to the preview window. Reapply it after finalize so resizing never exposes
    # Qt's default white widget background.
    figure.patch.set_facecolor(BACKGROUND)
    visible = tuple(entity for entity in entities if is_visible(entity))
    bounds = _axes_bounds(axes)
    texts = tuple(_visible_texts(visible))
    return RenderSummary(
        visible_entity_count=len(visible),
        bounds=bounds,
        visible_texts=texts,
    )


def export_png(
    loaded: LoadedDrawing,
    destination: Path,
    visible_layers: frozenset[str] | None = None,
    *,
    dpi: int = 150,
) -> RenderSummary:
    output = destination.expanduser().resolve()
    figure = Figure(figsize=(16, 9), dpi=dpi, facecolor=BACKGROUND)
    summary = draw_loaded_dxf(loaded, figure, visible_layers)
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        figure.savefig(
            output,
            dpi=dpi,
            facecolor=BACKGROUND,
            bbox_inches="tight",
            pad_inches=0.15,
        )
    except Exception as exc:
        raise DxfPreviewError(f"无法导出 {output}: {exc}") from exc
    return summary


def _axes_bounds(axes) -> tuple[float, float, float, float] | None:
    points = axes.dataLim.get_points()
    if points.shape != (2, 2):
        return None
    min_x, min_y = (float(value) for value in points[0])
    max_x, max_y = (float(value) for value in points[1])
    if not all(value == value and abs(value) != float("inf") for value in (min_x, min_y, max_x, max_y)):
        return None
    return min_x, min_y, max_x, max_y


def _visible_texts(entities: Iterable[DXFGraphic]) -> Iterable[str]:
    for entity in entities:
        kind = entity.dxftype()
        if kind == "MTEXT":
            yield entity.plain_text()
        elif kind in {"TEXT", "ATTRIB", "ATTDEF"}:
            yield entity.dxf.get("text", "")
        elif kind in {"INSERT", "DIMENSION", "MLEADER"} and hasattr(entity, "virtual_entities"):
            try:
                yield from _visible_texts(entity.virtual_entities())
            except Exception:
                continue
