# @vectorai/plugin-dsh-space

Apache-2.0 licensed VectorAI 2D Space and Canvas bundle for DeepSeek Harness `0.1.0-rc.8`.

From the VectorAI repository root, build and install the local development bundle:

```bash
pnpm build:dsh-space
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client \
  ./packages/plugin-dsh-annotation
```

The four local paths are required during workspace development because pnpm
does not promote the bundle's `workspace:*` dependencies into the DSH profile.
Published packages will resolve those dependencies normally.

The bundle adds `drawing_import`, `drawing_summarize`, revision-bound
`drawing_query`, the Host-authoritative
`observe → context → ground → preview/revise → evaluate → finalize` chain,
operation lookup, compensating Undo, and the second-layer
`drawing_auto_annotate` tool. The canvas is mounted in the session-scoped
`conversation.workspace`, beside the native chat. `drawing_query` supports
bounded world slices, exact node lookup, and direct relation/feature neighbors.

The chain is activated lazily. Ordinary DSH turns receive no mandatory drawing
workflow prompt; when a Drawing or verified canvas selection exists, pre-step
adds only a conditional capability hint. The model enters the plugin by calling
`drawing_observe`, and each successful tool result exposes only the next
Host-valid tool choices. Child agents receive no drawing intake injection.

The view uses the shared VectorAI workspace: axes, adaptive grid, pan/zoom,
click and box selection, object browser, property inspector, source underlay,
annotation rendering, and revision-aware manual edits are available in DSH.
When a Preview exists, the candidate document is shown without replacing the
formal revision; created, updated, and deleted nodes receive distinct diff
styles and direct editing is paused until the Preview is committed or
discarded.

`auto-safe` is computed by the Host from the exact resulting effect, confirmed
source facts, mandatory diagnostics, reviewer outcome, scope, and verified
inverse transaction. Risk-qualified candidates use the DSH question UI;
hard-invalid or out-of-scope candidates are blocked. The model cannot submit an
approval or raw commit flag. `/drawing-policy review` immediately downgrades
the current task; `/drawing-policy auto-safe` applies only to future tasks.

Drawing state and rendering remain local. The Host persists one authoritative
Drawing per DSH session under `~/.dsh/vectorai/drawings/`, the source raster
stays in DSH's attachment store, and the Client resolves a temporary authorized
URL only while the view is mounted. The bundle adds no HTTP, Express, or
VectorAI cloud service.

Preview state is intentionally ephemeral and session-local. Formal commits are
persisted in a versioned local envelope with an operation ledger, forward and
inverse transactions, reviewer/assessment evidence, and compensating Undo
revisions. Browser property edits and Undo are Host-staged; the published
Remote surface has no raw commit or Preview-finalize route.

The image importer runs the packaged local Python/OpenCV clean-line worker and
produces analytic line/circle/arc/ellipse nodes, polyline fallbacks, topology
relations, and compound-path features. PDF, DXF, and optional WASM compute
backends remain separate adapters and do not require another Viewer migration.
