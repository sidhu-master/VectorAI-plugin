# Shared Drawing Workspace

## Purpose

VectorAI's first-layer plugin is a host-neutral two-dimensional workspace. The standalone website and DeepSeek Harness render the same Drawing document with the same React Viewer, but each host owns its own local repository and lifecycle. There is no VectorAI cloud service and no live synchronization between the two hosts.

## Package boundary

```text
@vectorai/drawing-core
        ↑
@vectorai/drawing-workspace        headless Store + public port
        ↑
@vectorai/drawing-viewer-react     canvas + panels + interaction
        ↑                         ↑
website adapter             DSH client adapter
                                  ↕ strict Remote
                              DSH Host repository
```

- `drawing-core` defines the canonical `DrawingDocument`.
- `drawing-workspace` owns one scoped Store per mounted workspace. It has no React, DSH, Express, browser-global, or Node dependency.
- `drawing-viewer-react` renders axes, adaptive grid, source underlay, all current geometry and annotations, relations, object groups, property editing, selection, pan/zoom, and status.
- Adapters translate host storage and resource lifetimes into `DrawingWorkspacePort`.

The dependency direction is inward only. Shared packages never import website state, DSH APIs, or the optional Engineering Annotation layer.

## Authority and local UI state

The authoritative value is a complete `DrawingWorkspaceSnapshot`:

```ts
interface DrawingWorkspaceSnapshot {
  version: 1;
  ref: { drawingId: string; revision: number };
  document: DrawingDocument;
  source?: DrawingSourceRef;
  capabilities: DrawingWorkspaceCapabilities;
  provisional?: boolean;
  lastCommit?: { commitId: string; mode: string; undoable: boolean };
}
```

Only revision-aware document commands cross a host boundary. Viewport, pointer position, selection, panel state, display toggles, transient drag state, and local errors stay in the scoped client Store.

The Store does not mutate the document optimistically. A commit includes `expectedRevision`; success replaces the whole authoritative snapshot. A stale revision returns `conflict` with the newest snapshot, which the Store displays instead of overwriting newer work.

## Host adapters

### Standalone website

`src/adapters/website-drawing-workspace-port.ts` is a migration adapter over the existing local website Store. It uses the canonical command action and emits replacements when imports, undo, reset, or Agent tools change the Drawing. The existing website chat remains a sibling host panel; it is not part of the Viewer.

The current website compatibility path still contains legacy Express/Agent code. New shared packages and the DSH runtime do not depend on it, and the target static Web/PWA adapter can replace this port without changing the Viewer.

### DeepSeek Harness

The DSH Host keeps one authoritative local repository per authorized Agent/session and persists formal revisions in a versioned durable envelope. The strict Typert surface exposes:

- `getSnapshot` for the complete current Drawing;
- `query` and `getPreview` for bounded reads;
- `stageInteractiveEdit` for an exact expected-revision browser gesture;
- `stageUndo` for the exact current undo target;
- `getOperation` for durable outcome reconciliation.

It deliberately does not expose raw `commit`, `createPreview`, `commitPreview`, or `discardPreview` routes. A staged edit is applied by a Host command carrying opaque intent/operation tokens. A lost command response is reconciled against the durable operation ledger. Undo is a new compensating revision, not an in-place rollback.

Session identity is resolved through DSH's Agent lookup/scope rather than trusted as arbitrary business data. Imports and model tools use the same repository as manual Viewer edits. The rc.8 compatibility path refreshes the view when the conversation's running tool-call count changes; commit responses replace the snapshot immediately.

The source image is not embedded as base64. A snapshot contains only a durable DSH attachment reference. The client calls `conversation.resolveImage` to obtain a session-authorized browser URL and releases all session image URLs when the drawing view unmounts.

## Resource and plugin lifecycle

Each mounted drawing view creates exactly one workspace Store. Provider cleanup aborts in-flight work, unsubscribes, and disposes loaded resources. The DSH lazy client artifact embeds the Viewer CSS, installs one tagged `<style>` element when the plugin applies, and removes it when the plugin unloads.

## Public extension point

`PreviewOverlayContribution` receives deeply readonly snapshot and viewport inputs. It may render temporary visual evidence, but cannot mutate the Drawing Store. Durable changes must use the public semantic or staged-interactive path. This keeps optional higher-layer plugins removable without affecting rendering, staged editing, or Undo of annotations already committed to the canonical document.
