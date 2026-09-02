# @newwe/vectorai-plugin-dsh-space

Apache-2.0 licensed VectorAI 2D Space and Canvas bundle for DeepSeek Harness `0.1.2-alpha.5`.

Install the prebuilt public Bundle through DSH's official profile command:

```bash
dsh plugin --profile web add @newwe/vectorai-plugin-dsh-space@alpha
```

For offline installation, pass the packaged `.tgz` path to the same command. The package contains prebuilt Host and Client faces and selects a self-contained vectorizer runtime for the current operating system and CPU. End users do not need Python, pip, a virtual environment, or install-time build permission.

Repository development uses `pnpm build:dsh-space`; the private Host and Client source packages are build inputs and are not separately published.

The bundle adds `drawing_import`, `drawing_summarize`, revision-bound
`drawing_query`, the Host-authoritative
`observe → select_parts → preview_spatial_intent/revise → evaluate → finalize` chain,
operation lookup and compensating Undo. The Client registers in alpha's public
`shell.overlay` extension point and declares one session-scoped VectorAI drawing
child. When a Drawing exists it reserves the left side of the native Conversation
column for the canvas; the chat remains on the right. `drawing_query` supports
bounded world slices, exact node lookup, and direct relation/feature neighbors.

The chain is activated lazily. Ordinary DSH turns receive no mandatory drawing
workflow prompt; when a Drawing or verified canvas selection exists, pre-step
adds only a conditional capability hint. The model enters the plugin by calling
`drawing_observe`, and each successful tool result exposes only the next
Host-valid tool choices. Internal task/context/grounding/Preview handles stay in
the Host. The model selects semantic parts and qualitative relations; the local
deterministic solver computes coordinates, rotations, interfaces, and the
minimum-deformation transaction. Child agents receive no drawing intake injection.

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

Engineering Annotation is installed separately through
`@newwe/vectorai-plugin-dsh-annotation`; its absence does not affect this fallback
workspace.
