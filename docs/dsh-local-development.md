# DSH Local Development

## Prerequisites

- Node.js and pnpm versions accepted by the repository.
- DeepSeek Harness `0.1.0-rc.8` with the `web` profile.
- Python 3 with the repository's local vectorization dependencies. Run `pnpm setup:vectorization` once when the local environment has not been prepared.

No VectorAI Express process, API key, AI gateway, or VectorAI cloud account is required.

## Build and install

From the repository root:

```bash
pnpm install
pnpm build:dsh-space
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client \
  ./packages/plugin-dsh-annotation
```

The four paths are needed only for local `workspace:*` development. A published bundle resolves its package dependencies normally.

If the local DSH rc.8 installation does not yet expose `conversation.workspace`, apply the guarded compatibility patch before launch:

```bash
pnpm patch:dsh-workspace
```

The patch validates known source anchors and creates a backup before changing DSH. It fails closed on an unknown DSH version/layout.

## Runtime behavior

- Paste or attach a drawing image in the direct user message.
- `drawing_import` reads the DSH attachment and runs the packaged local clean-line worker.
- The same conversation page shows chat and the shared VectorAI canvas.
- The canvas supports pan/zoom, axes/grid, click and box selection, object/property panels, source-underlay toggle, annotation display, staged property edits, and Undo.
- A semantic transform request uses `drawing_observe`, `drawing_build_context`, `drawing_ground`, `drawing_preview_grounded_transform`, `drawing_evaluate_preview`, and `drawing_finalize_preview`. Visual revisions use `drawing_revise_grounded_transform`; the generic `drawing_preview_program` remains the advanced path for non-transform operations.
- Drawing tools are lazily activated: unrelated turns receive no fixed workflow injection, while an active Drawing or verified selection contributes only a conditional capability hint. After `drawing_observe`, each tool result reports the next Host-valid tool choices.
- Legacy version-1 local Drawing files are promoted in place to the durable version-2 commit/Undo envelope on their first semantic commit.
- `/drawing-policy review` immediately makes the current task review-only. `/drawing-policy auto-safe` applies to future tasks and never upgrades an existing review task.
- Formal Drawing state is stored under `~/.dsh/vectorai/drawings/`. Source images remain in DSH's attachment store.

## Verification

Fast package checks:

```bash
pnpm --filter @vectorai/drawing-edit-protocol test
pnpm --filter @vectorai/drawing-edit-core test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/plugin-dsh-annotation test
```

Release gate:

```bash
pnpm check
pnpm test
pnpm build:dsh-space
```

The built Host Typert and Client bundle must not contain the old raw write routes:

```bash
! rg "drawingSpace/(commit|createPreview|commitPreview|discardPreview)" \
  packages/plugin-dsh-space-host/lib/typert.js \
  packages/plugin-dsh-space-client/lib/client.js
```

## Troubleshooting

- `PENDING_DRAWING_SOURCE_REQUIRED`: attach or paste the image in a direct user message, then call import again.
- `EDIT_TARGET_UNRESOLVED`: query the current revision and ground exact node ids/interfaces before previewing.
- `EDIT_PREVIEW_STALE` / `EDIT_TASK_STALE`: a newer task, revision, Preview, or manual edit superseded the handle; observe from the current Drawing again.
- `confirmation_required`: inspect the Preview. Confirmed source + clean diagnostics + satisfied reviewer are required for auto-safe.
- `COMMIT_OUTCOME_UNKNOWN`: do not retry with a new operation; use `drawing_get_operation` with the original operation id and binding digest.
- Python vectorizer startup failure: rerun `pnpm setup:vectorization`, then verify `.local/vectorai/cv-venv/bin/python` or a working `python3` is available.
