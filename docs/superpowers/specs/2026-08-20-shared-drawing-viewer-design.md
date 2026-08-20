# Shared Drawing Viewer Design

**Date:** 2026-08-20  
**Status:** Proposed for implementation review  
**Branch:** `codex/dsh-plugin-migration`

## 1. Goal

Replace the temporary DSH-only SVG preview with the same interactive drawing
workspace used by the VectorAI website, while keeping DSH and the standalone
website as independent local hosts.

The shared workspace must provide:

- an infinite grid, X/Y axes, coordinate labels, pan, pointer-centered zoom,
  and fit-to-drawing;
- click selection, Command/Ctrl multi-selection, and box selection;
- an object list with visibility and delete actions;
- an inspector that reads and edits supported entity properties;
- display, selection, and manual editing of committed annotation primitives;
- annotation text dragging, relation and annotation visibility controls;
- cursor world coordinates, zoom, drawing identity, and revision status;
- an optional source-raster underlay for image imports.

The DSH chat remains the conversation surface. The website's AI chat panel is
not part of the shared workspace.

## 2. Confirmed Product Boundaries

This design implements host parity, not live synchronization between two open
applications. A DSH session and a standalone website project may display the
same schema and use the same components, but they keep independent local
repositories and UI state.

The first-layer 2D Space plugin owns:

- Drawing documents, revisions, commands, transactions, and validation;
- geometry and committed annotation primitives;
- rendering, selection, inspection, and manual edits;
- source-raster presentation;
- authoritative repository and transaction APIs.

The second-layer Engineering Annotation plugin owns:

- recognition and engineering semantics;
- measurement, partitioning, annotation planning, collision avoidance, and
  coverage checks;
- automatic annotation tools and preview generation.

The second layer may submit transactions and contribute preview overlays only
through first-layer public contracts. It may not import the first layer's
private Store or mutate Drawing state directly. Uninstalling the second layer
must leave existing annotations viewable and manually editable.

## 3. Current-State Diagnosis

The website's `Canvas`, object list, inspector, toolbar, and status bar bind
directly to the singleton `src/hooks/useStore.ts`. That Store mixes four
different responsibilities:

1. authoritative Drawing state and revision management;
2. viewport, selection, and display preferences;
3. the legacy HTTP `DrawingClient`;
4. the legacy VectorAI Agent runtime and its preview overlays.

The DSH plugin cannot reuse these components without also pulling in the old
HTTP and Agent assumptions. Its Slice 1 client therefore renders a separate
`DrawingCanvas` projection, while its Host keeps a separate in-memory
repository. The resulting feature mismatch is architectural, not an import
failure.

## 4. Package Architecture

```text
@vectorai/drawing-core
  DrawingDocument, nodes, commands, transactions, validation
                    ↑
@vectorai/drawing-workspace
  WorkspacePort, workspace Store, selection and viewport behavior
                    ↑
@vectorai/drawing-viewer-react
  React workspace, Canvas, object list, inspector, toolbar, status
             ↑                             ↑
standalone Web adapter               DSH Client adapter
                                             ↕ strict TypeRT
                                      DSH Host repository
```

### 4.1 `@vectorai/drawing-core`

Continue to own host-neutral document and transaction semantics. It must not
import React, Zustand, DSH, Express, browser APIs, or Node built-ins.

Any geometry helpers currently located under `src/components/canvas` that
operate only on Drawing values move here or to the headless workspace package.

### 4.2 `@vectorai/drawing-workspace`

New headless package. It depends on `drawing-core` and `zustand/vanilla`, but
not React or any host SDK.

It owns:

- `DrawingWorkspacePort`;
- workspace snapshot and capability types;
- selection and viewport state;
- grid, relation, annotation, and source-underlay visibility;
- transaction construction for property edits, visibility, delete, and
  annotation-text movement;
- optimistic-operation state without optimistic Drawing mutation;
- revision-conflict recovery.

The package creates Store instances. It exports no process-wide singleton.

### 4.3 `@vectorai/drawing-viewer-react`

New React package. It depends only on `drawing-core`, `drawing-workspace`,
React, and presentation-only dependencies.

It owns:

- `DrawingWorkspaceProvider` and scoped Store hooks;
- the controlled Canvas and entity renderer;
- object list, property inspector, toolbar, and status bar;
- the source-raster layer;
- accessible loading, empty, busy, and error states;
- a public preview-overlay contribution interface for the second layer.

It must not import the website singleton Store, website service clients, DSH,
Express, or application routes.

The shared components use package-owned, root-scoped CSS variables and CSS
classes. The website imports the stylesheet normally. The DSH build embeds the
same emitted CSS into the lazy client bundle and removes its style element when
the plugin unloads. The Viewer must not rely on the website Tailwind build.

### 4.4 Host adapters

The standalone website supplies a browser/local `DrawingWorkspacePort`. During
the strangler transition, an adapter may wrap the existing `DrawingClient`, but
the Viewer remains unaware of that implementation. The later browser-only
repository replaces the adapter without changing Viewer components.

The DSH Client supplies a Remote-backed `DrawingWorkspacePort`. The DSH Host
owns the canonical session repository and transaction validation.

## 5. Workspace Contract

The conceptual contract is:

```ts
interface DrawingWorkspaceSnapshot {
  version: 1;
  ref: { drawingId: string; revision: number };
  document: DrawingDocument;
  source?: DrawingSourceRef;
  capabilities: {
    edit: boolean;
    delete: boolean;
    annotations: boolean;
    sourceUnderlay: boolean;
  };
}

interface DrawingWorkspacePort {
  load(signal?: AbortSignal): Promise<DrawingWorkspaceSnapshot | null>;
  commit(
    request: DrawingWorkspaceCommitRequest,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  loadSource?(
    source: DrawingSourceRef,
    signal?: AbortSignal,
  ): Promise<DrawingSourceResource>;
  subscribe?(listener: DrawingWorkspaceListener): () => void;
}
```

`DrawingWorkspaceCommitRequest` carries the expected revision and commands. It
does not carry a trusted actor. Each Host adapter assigns the actor from its
authenticated/local execution context.

`DrawingSourceRef` contains durable identity and metadata, not base64 bytes.
`loadSource()` returns a local object URL or equivalent resource plus a cleanup
function. This removes the current need to send a potentially 20 MiB data URL
inside every DSH Remote snapshot.

## 6. DSH Remote Boundary

Replace the current direct, caller-selected session-id method with session-
scoped TypeRT methods. The concrete generated shape will follow DSH rc.8, but
the public behavior is:

- `drawingSpace/snapshot`: return the current Agent session's complete snapshot;
- `drawingSpace/commit`: validate and apply commands against an expected
  revision, then return the authoritative updated snapshot;
- `drawingSpace/changed`: notify the Client that a tool or another local action
  changed the session Drawing.

The Host resolves the session from DSH scope. A browser caller cannot select an
arbitrary session, Host path, or attachment id.

All TypeRT parameters and results use shared strict Zod v4 schemas owned by the
public contracts package. Client and Host never maintain duplicate wire
schemas.

## 7. State and Data Flow

### 7.1 Import

```text
paste image
  → DSH attachment admission
  → pre-step binds latest image to Agent session
  → visible drawing_import tool
  → Host vectorizer creates DrawingDocument
  → Host commits revision
  → drawingSpace/changed
  → Client port loads snapshot and source resource
  → shared Viewer renders source plus entities
```

### 7.2 Manual edit

```text
Viewer property/delete/visibility/text-drag action
  → workspace builds Drawing commands with expected revision
  → port.commit()
  → Host constructs actor-bound transaction and validates it
  → authoritative updated snapshot
  → Store replaces document and retains valid selection
```

Viewport, mouse coordinates, selection, and display toggles never cross the
Remote boundary.

### 7.3 Tool edit

```text
DSH tool commits through the same Host repository
  → revision increases
  → changed event
  → Client reloads snapshot
  → invalid selected ids are removed
```

Tool code and UI code therefore cannot create independent Drawing authorities.

## 8. Viewer Component Boundaries

The existing website components are decomposed rather than copied:

- `DrawingWorkspace`: responsive workspace shell without chat;
- `DrawingCanvas`: controlled renderer and pointer interaction owner;
- `DrawingObjectList`: controlled list for geometry and annotations;
- `DrawingInspector`: schema-directed property display and supported editors;
- `DrawingToolbar`: fit, zoom, and layer controls;
- `DrawingStatusBar`: coordinates, zoom, identity, revision, and busy state;
- `DrawingSourceLayer`: optional raster underlay in Drawing coordinates;
- `DrawingPreviewLayerHost`: public, read-only overlay contribution point.

Geometry rendering, hit testing, selection, pan, grid, and annotation-label
utilities move with their natural owner. Agent-specific perception overlays
remain outside the base Viewer and later adapt to `DrawingPreviewLayerHost`.

The DSH client registers `DrawingWorkspace` in the session-scoped
`conversation.workspace` slot. The conversation shell composes the workspace
beside the native DSH chat, with a draggable desktop separator and a stacked
narrow layout. The existing DSH navigation/sidebar remains owned by DSH. On
narrow widths the object list and inspector collapse into drawers; the Canvas
always retains the primary area.

## 9. Editing Semantics

- Property fields commit on blur or Enter, not on every keystroke.
- Invalid numeric input remains local and displays validation; it never reaches
  the repository.
- Visibility is a Drawing property and therefore a transaction.
- Delete is a transaction and preserves repository preconditions.
- Selection supports geometry and committed annotations according to the same
  policy in both hosts.
- Unsupported entity editors remain read-only while still exposing complete
  JSON-safe properties.
- Annotation text dragging commits once at pointer-up.
- Busy state prevents a second mutation from racing the active commit.

## 10. Failure and Conflict Behavior

- Load failure shows a retryable Viewer error without destroying the last good
  snapshot.
- A rejected transaction keeps the authoritative document and current valid
  selection, and displays the first validation error.
- A revision conflict reloads the newest snapshot and reports that the edit was
  not applied. It does not automatically replay a mutation against changed
  geometry.
- Source-image failure leaves vector entities usable and offers a source-layer
  retry.
- Plugin unload aborts outstanding loads, revokes object URLs, disposes Store
  subscriptions, removes embedded CSS, and leaves no timers or listeners.
- A missing second-layer plugin produces an empty preview contribution, never a
  first-layer failure.

## 11. Vectorization Boundary

Image import must produce actual local geometry before the Host publishes a
ready snapshot. A four-edge source footprint is not vectorization and is not
an acceptable completion state.

The DSH Host reuses the existing deterministic clean-line Python/OpenCV worker
without Express or a VectorAI cloud call. It promotes fitted strokes to line,
circle, arc and ellipse nodes, retains polyline fallbacks, maps source pixels
into the 500 mm document frame, and records the matching source-image frame so
the underlay and selectable geometry remain coincident.

The worker script ships inside the Host build. `ImageVectorizer` remains the
port for future WASM, DXF and PDF adapters; replacing the compute backend must
not require another Viewer rewrite.

## 12. Testing Strategy

### 12.1 Headless workspace tests

- load and snapshot replacement;
- click, multi-select, box-select result state;
- viewport and display state remain local;
- property, visibility, delete, and annotation-drag command construction;
- rejected transaction and revision-conflict recovery;
- subscription disposal and source-resource cleanup.

### 12.2 Shared React tests

- axes, grid, labels, raster, and all supported entity types render;
- pan, zoom, fit, click selection, multi-selection, and box selection;
- object-list and Canvas selection remain identical;
- inspector shows complete properties and commits supported edits;
- responsive DSH layout retains an operable Canvas;
- error states retain the last good drawing.

### 12.3 Adapter contract tests

Run one shared contract suite against:

- the website transition adapter;
- the DSH Remote-backed Client adapter and Host repository pair.

The same fixture must yield the same entity count, bounds, selectable ids,
property values, and post-commit revision behavior.

### 12.4 Integration tests

- existing website Viewer behavior remains green after switching components;
- DSH import opens the shared workspace with the source and locally extracted
  analytic/polyline entities;
- DSH property edit increments the Host revision and survives tab remount;
- a tool-side commit refreshes the open Viewer;
- unloading the Engineering Annotation plugin leaves committed annotations
  visible and editable.

## 13. Migration Sequence

1. Add the headless workspace contract and Store with tests.
2. Extract pure Canvas utilities and renderers.
3. Build shared React components and package-owned styling.
4. Move the website to the shared Viewer through a transition adapter.
5. Extend strict DSH contracts and Host repository for full snapshots and
   transaction commits.
6. Replace the temporary DSH Canvas with the shared Viewer.
7. Add source-resource loading and changed-event refresh.
8. Run website and real DSH parity smoke tests.
9. Delete the temporary projection-only Canvas after both adapters are green.

Each step is independently committed and keeps the website runnable. No
long-lived duplicate Viewer implementation is retained.

## 14. Acceptance Criteria

- Website and DSH import the same `DrawingWorkspace` React component.
- Neither shared package imports DSH, Express, website services, or application
  routes.
- DSH shows axes, grid, pan, zoom, fit, selection, object list, inspector, and
  status information.
- Supported property edits, visibility, delete, and annotation-text movement
  increment the authoritative Host revision.
- Remounting the DSH session workspace reloads the edited state.
- Selection and viewport do not alter the Drawing revision.
- The same fixture produces equal entity ids, bounds, and property values in
  website and DSH adapter tests.
- Existing committed annotations remain usable without the second layer.
- No VectorAI Express or cloud service is required by the DSH path.
- Full repository tests, type checks, DSH build, generated-artifact syntax
  checks, and a real DSH mount smoke pass.

## 15. Non-Goals

- live synchronization between a standalone website window and a DSH session;
- automatic engineering annotation generation in the first layer;
- adding WASM, DXF and PDF compute backends beyond the shipped local image
  vectorizer;
- replacing or duplicating DSH's native chat inside the shared Viewer;
- optimistic mutation of authoritative Drawing state;
- introducing a VectorAI HTTP server or background cloud service.
