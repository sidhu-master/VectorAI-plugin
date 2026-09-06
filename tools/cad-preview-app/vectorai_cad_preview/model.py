from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class LayerRecord:
    name: str
    color: int
    visible: bool


@dataclass(frozen=True)
class LoadedDrawing:
    path: Path
    document: Any
    layers: tuple[LayerRecord, ...]
    audit_errors: int
    audit_fixes: int
    entity_count: int


@dataclass(frozen=True)
class RenderSummary:
    visible_entity_count: int
    bounds: tuple[float, float, float, float] | None
    visible_texts: tuple[str, ...]
