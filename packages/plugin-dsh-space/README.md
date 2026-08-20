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

Drawing state and rendering remain local. The Host stores one authoritative Drawing per DSH session, the source raster stays in DSH's attachment store, and the Client resolves a temporary authorized URL only while the view is mounted. The bundle adds no HTTP, Express, or VectorAI cloud service.

The current image vectorizer creates a provisional source-boundary Drawing. Improving image/PDF/DXF reconstruction is a separate local-compute slice and does not require another Viewer migration.
