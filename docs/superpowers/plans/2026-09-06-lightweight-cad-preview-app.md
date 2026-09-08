# VectorAI CAD Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build and install a self-contained macOS DXF viewer that reproduces the existing ezdxf/Matplotlib acceptance preview and exports PNG images.

**Architecture:** A small Python package separates DXF loading/rendering from the PySide6 window. The renderer owns ezdxf and Matplotlib behavior; the UI only opens files, changes visible layers, controls the canvas, and requests PNG export. PyInstaller produces a standalone `.app` with DXF file association.

**Tech Stack:** Python 3.13, PySide6, ezdxf, Matplotlib, pytest, pytest-qt, PyInstaller, macOS codesign.

**Spec:** `docs/superpowers/specs/2026-09-06-lightweight-cad-preview-app-design.md`

## Global Constraints

- The app is read-only and must never modify or save a DXF.
- Rendering uses `Frontend(RenderContext(doc), MatplotlibBackend(ax))`.
- The packaged app is self-contained and must not invoke system, Homebrew, repository, or production vectorizer Python at runtime.
- Only modelspace is rendered; DWG and paper-space layouts are out of scope.
- The first acceptance uses the real golden, initial, and current exported DXF files named in the spec.
- DSH packaging and publication workflows are unaffected.
- Exact Python dependencies are `ezdxf==1.4.4`, `matplotlib==3.11.1`, `PySide6==6.11.2`, `PyInstaller==6.22.2`, `pytest==9.1.1`, and `pytest-qt==4.5.0`.

---

### Task 1: DXF document model and renderer

**Files:**
- Create: `tools/cad-preview-app/vectorai_cad_preview/__init__.py`
- Create: `tools/cad-preview-app/vectorai_cad_preview/model.py`
- Create: `tools/cad-preview-app/vectorai_cad_preview/renderer.py`
- Create: `tools/cad-preview-app/tests/test_renderer.py`
- Create: `tools/cad-preview-app/requirements.txt`

**Interfaces:**
- Produces: `load_dxf(path: Path) -> LoadedDrawing`
- Produces: `draw_loaded_dxf(loaded: LoadedDrawing, figure: Figure, visible_layers: frozenset[str] | None = None) -> RenderSummary`
- Produces: `export_png(loaded: LoadedDrawing, destination: Path, visible_layers: frozenset[str] | None = None, *, dpi: int = 150) -> RenderSummary`
- `LoadedDrawing` contains the resolved path, ezdxf document, ordered layer records, audit counts, and modelspace entity count.
- `RenderSummary` contains visible entity count, bounds, and visible text strings.

- [x] **Step 1: Create the dependency manifest and failing renderer tests**

Write tests that create a temporary standards-based DXF with two layers, LINE/HATCH/MTEXT entities, and MTEXT formatting controls. Assert that loading returns ordered layers and audit counts; rendering excludes a hidden layer, returns plain visible text without `\\f` or `\\W`, and writes a non-empty PNG. Also assert that an invalid DXF raises `DxfPreviewError` with the input filename.

- [x] **Step 2: Run the renderer tests and verify RED**

Run: `tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests/test_renderer.py -q`

Expected: collection fails because `vectorai_cad_preview` does not exist.

- [x] **Step 3: Implement the minimal model and renderer**

Use `ezdxf.readfile`, `doc.audit()`, and modelspace iteration for loading. Render through `RenderContext`, `Frontend`, and `MatplotlibBackend`; use an ezdxf `filter_func` based on the entity layer. Extract visible text with `plain_text()` for MTEXT and `dxf.text` for TEXT. Apply background `#10171d`, equal aspect, autoscale, hidden axes, and a fixed viewport margin.

- [x] **Step 4: Run the renderer tests and verify GREEN**

Run: `tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests/test_renderer.py -q`

Expected: all renderer tests pass without warnings.

- [x] **Step 5: Commit the renderer slice**

Run: `git add tools/cad-preview-app && git commit -m "feat: add deterministic DXF preview renderer"`

### Task 2: Interactive PySide6 window

**Files:**
- Create: `tools/cad-preview-app/vectorai_cad_preview/window.py`
- Create: `tools/cad-preview-app/vectorai_cad_preview/app.py`
- Create: `tools/cad-preview-app/tests/test_window.py`

**Interfaces:**
- Produces: `CadPreviewWindow.open_path(path: Path) -> bool`
- Produces: `CadPreviewWindow.set_layer_visible(layer_name: str, visible: bool) -> None`
- Produces: `CadPreviewWindow.export_current_png(path: Path) -> bool`
- Produces: `CadPreviewApplication.event(event: QEvent) -> bool` for macOS file-open events.

- [x] **Step 1: Write failing window tests**

Use a real temporary DXF and `pytest-qt`. Assert that `open_path` updates the title, canvas, layer list, status counts, and last successful path; a later invalid file returns false and preserves that state. Assert that toggling a layer redraws without changing the source file bytes, drag/drop accepts only `.dxf`, export creates a PNG, and a `QFileOpenEvent` routes to the active window.

- [x] **Step 2: Run the window tests and verify RED**

Run: `QT_QPA_PLATFORM=offscreen tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests/test_window.py -q`

Expected: collection fails because the window classes do not exist.

- [x] **Step 3: Implement the minimal application UI**

Embed `FigureCanvasQTAgg` and `NavigationToolbar2QT`. Add Open, Fit, Pan, Zoom, Export PNG actions; a checkable right-side layer dock; a dark central canvas; file drop handlers; status text for entity/layer/audit counts; and a diagnostic error dialog. File errors return false and leave the loaded drawing intact.

- [x] **Step 4: Run window and renderer tests and verify GREEN**

Run: `QT_QPA_PLATFORM=offscreen tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests -q`

Expected: all tests pass without Qt or Matplotlib warnings.

- [x] **Step 5: Commit the UI slice**

Run: `git add tools/cad-preview-app && git commit -m "feat: add interactive CAD preview window"`

### Task 3: Reproducible macOS app packaging

**Files:**
- Create: `tools/cad-preview-app/build_app.py`
- Create: `tools/cad-preview-app/VectorAICADPreview.spec`
- Create: `tools/cad-preview-app/tests/test_bundle_config.py`
- Create: `tools/cad-preview-app/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm build:cad-preview-app`
- Produces: `tools/cad-preview-app/dist/VectorAI CAD Preview.app`
- Produces: application bundle ID `com.vectorai.cadpreview` with `.dxf` document declarations.

- [x] **Step 1: Write failing bundle configuration tests**

Assert that the PyInstaller spec declares the expected app name, Bundle ID, `CFBundleDocumentTypes`, `CFBundleTypeExtensions = ["dxf"]`, and includes ezdxf drawing fonts/resources. Assert that `package.json` exposes `build:cad-preview-app`.

- [x] **Step 2: Run the bundle tests and verify RED**

Run: `tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests/test_bundle_config.py -q`

Expected: tests fail because the spec and root command do not exist.

- [x] **Step 3: Implement packaging and documentation**

Create a PyInstaller windowed `onedir` app with arm64 target, application icon generated from a deterministic local SVG/PNG asset, ezdxf resource collection, and the required Info.plist keys. `build_app.py` creates or reuses `.venv`, installs exact versions from `requirements.txt`, invokes PyInstaller, and applies ad-hoc deep signing. Document development, build, install, file opening, and limitations.

- [x] **Step 4: Run bundle tests and build the app**

Run: `tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests -q`

Run: `pnpm build:cad-preview-app`

Expected: tests pass and `tools/cad-preview-app/dist/VectorAI CAD Preview.app` exists.

- [x] **Step 5: Verify bundle metadata and architecture**

Run: `plutil -p "tools/cad-preview-app/dist/VectorAI CAD Preview.app/Contents/Info.plist"`

Run: `file "tools/cad-preview-app/dist/VectorAI CAD Preview.app/Contents/MacOS/VectorAI CAD Preview"`

Run: `codesign --verify --deep --strict "tools/cad-preview-app/dist/VectorAI CAD Preview.app"`

Expected: Bundle ID and DXF association are present, executable includes arm64, and signature verification exits 0.

- [x] **Step 6: Commit the packaging slice**

Run: `git add package.json pnpm-lock.yaml tools/cad-preview-app docs && git commit -m "build: package VectorAI CAD Preview for macOS"`

### Task 4: Install and real-DXF acceptance

**Files:**
- Create: `tools/cad-preview-app/tests/test_real_files.py`
- Create: `.local/cad-preview-app-acceptance/` outputs (ignored, not committed)

**Interfaces:**
- Consumes: packaged app and real DXF paths from the design spec.
- Produces: installed `/Applications/VectorAI CAD Preview.app` and PNG acceptance renders.

- [x] **Step 1: Write the real-file acceptance test**

Parameterize over every existing acceptance DXF. Load and render each file, assert a non-empty modelspace and PNG, assert visible text contains no raw `\\f` or `\\W`, and record layer/entity/audit counts plus PNG SHA-256 in `.local/cad-preview-app-acceptance/report.json`.

- [x] **Step 2: Run the real-file acceptance**

Run: `tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests/test_real_files.py -q`

Expected: all existing fixture parameters pass and write their PNG/report records. If one fails, preserve the failing file and assertion as the required RED regression before changing production code.

- [x] **Step 3: Resolve any evidenced real-file incompatibility**

If Step 2 fails, trace the failure to DXF loading, text interpretation, layer filtering, or Matplotlib output; add a focused assertion to `test_renderer.py`, then change only that responsible renderer/model boundary. Do not special-case fixture names, handles, expected paper coordinates, or golden content. If Step 2 passes, make no production change in this step.

- [x] **Step 4: Run all app tests and acceptance**

Run: `QT_QPA_PLATFORM=offscreen tools/cad-preview-app/.venv/bin/python -m pytest tools/cad-preview-app/tests -q`

Expected: all tests pass and three acceptance PNGs exist for the available real files.

- [x] **Step 5: Install and launch outside the development environment**

Copy the built app to `/Applications/VectorAI CAD Preview.app`, launch it with `/Users/sidhu/Downloads/样本图001.dxf`, and verify the process remains running. Repeat with the latest current exported DXF and export a PNG through the app.

- [x] **Step 6: Perform visual checklist**

Inspect the generated images and confirm dimensions, datum symbols, GD&T frames, roughness, hatches, centerlines, layer colors, and readable text individually. Record unsupported CAXA proxy entities or missing fonts rather than marking them visually equivalent.

- [x] **Step 7: Run repository regression checks and commit acceptance**

Run: `pnpm check`

Run: `pnpm test`

Expected: the app tests and existing repository tests pass; only explicitly configured existing skips remain.

Run: `git add tools/cad-preview-app package.json pnpm-lock.yaml && git commit -m "test: verify CAD preview app with real drawings"`
