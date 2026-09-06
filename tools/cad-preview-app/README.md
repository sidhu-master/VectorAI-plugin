# VectorAI CAD Preview

A read-only macOS DXF viewer using the same ezdxf and Matplotlib rendering path as the repository's golden CAD review images.

## Develop

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
QT_QPA_PLATFORM=offscreen .venv/bin/python -m pytest tests -q
.venv/bin/python -m vectorai_cad_preview.app drawing.dxf
```

## Build and install

From the repository root:

```sh
pnpm build:cad-preview-app
ditto "tools/cad-preview-app/dist/VectorAI CAD Preview.app" "/Applications/VectorAI CAD Preview.app"
open -a "VectorAI CAD Preview" drawing.dxf
```

The app bundle contains Python and its runtime dependencies. It does not require an activated virtual environment.

## Supported workflow

- Open a DXF from the toolbar, Finder, or drag and drop.
- Pan, zoom, and fit the modelspace drawing.
- Toggle DXF layers without changing the source file.
- Export the complete drawing with current layer visibility as PNG.

The first version does not edit DXF, open DWG, or render paper-space layouts. Proprietary CAXA objects require standard or proxy DXF graphics in the file, and unavailable proprietary fonts use ezdxf/Matplotlib fallback fonts.
