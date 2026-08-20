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

The bundle adds `drawing_import`, `drawing_summarize`, revision-bound
`drawing_query`, and Host-authoritative Preview/Commit/Discard tools plus a
session-scoped “图纸” conversation view. `drawing_query` supports bounded
world slices, exact node lookup, and direct relation/feature neighbors.

The view uses the shared VectorAI workspace: axes, adaptive grid, pan/zoom,
click and box selection, object browser, property inspector, source underlay,
annotation rendering, and revision-aware manual edits are available in DSH.
When a Preview exists, the candidate document is shown without replacing the
formal revision; created, updated, and deleted nodes receive distinct diff
styles and direct editing is paused until the Preview is committed or
discarded.

Drawing state and rendering remain local. The Host persists one authoritative
Drawing per DSH session under `~/.dsh/vectorai/drawings/`, the source raster
stays in DSH's attachment store, and the Client resolves a temporary authorized
URL only while the view is mounted. The bundle adds no HTTP, Express, or
VectorAI cloud service.

Preview state is intentionally ephemeral and session-local. Only a successful
Preview commit is persisted, and it advances the formal Drawing by exactly one
revision.

The image importer runs the packaged local Python/OpenCV clean-line worker and
produces analytic line/circle/arc/ellipse nodes, polyline fallbacks, topology
relations, and compound-path features. PDF, DXF, and optional WASM compute
backends remain separate adapters and do not require another Viewer migration.
