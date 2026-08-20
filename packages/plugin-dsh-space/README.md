# @vectorai/plugin-dsh-space

Apache-2.0 licensed VectorAI 2D Space and Canvas bundle for DeepSeek Harness `0.1.0-rc.8`.

From the VectorAI repository root, build and install the local development bundle:

```bash
pnpm build:dsh-space
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client
```

The three local paths are required during workspace development because pnpm
does not promote the bundle's `workspace:*` dependencies into the DSH profile.
Published packages will resolve those dependencies normally.

The bundle adds the `drawing_import` and `drawing_summarize` tools plus a session-scoped “图纸” conversation view. The view uses the shared VectorAI workspace: axes, adaptive grid, pan/zoom, click and box selection, object browser, property inspector, source underlay, annotation rendering, and revision-aware manual edits are available in DSH.

Drawing state and rendering remain local. The Host persists one authoritative
Drawing per DSH session under `~/.dsh/vectorai/drawings/`, the source raster
stays in DSH's attachment store, and the Client resolves a temporary authorized
URL only while the view is mounted. The bundle adds no HTTP, Express, or
VectorAI cloud service.

The image importer runs the packaged local Python/OpenCV clean-line worker and
produces analytic line/circle/arc/ellipse nodes, polyline fallbacks, topology
relations, and compound-path features. PDF, DXF, and optional WASM compute
backends remain separate adapters and do not require another Viewer migration.
