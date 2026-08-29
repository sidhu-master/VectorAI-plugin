# Extensible 2D Space Surface Design

## Status

Approved in conversation on 2026-08-24. This specification covers the first-layer platform expansion required before the second-layer Engineering Annotation plugin receives its production workflow and UI.

## Context

VectorAI currently has a host-neutral Drawing document, a headless workspace Store, a React Viewer, a DSH Host repository, and a DSH Client view. The first Engineering Annotation implementation can generate a small deterministic annotation program, but it has no independent Client workspace and depends on the concrete first-layer Host service.

The current React boundary is also too coarse for a professional second layer:

- `DrawingWorkspace` owns the complete layout;
- `Canvas` reads the first-layer React Context directly;
- grid, geometry, annotations, selection, Grounding, Preview, and Motion Rig rendering are assembled inside one component;
- pointer behavior is hard-coded in the same component;
- the only public visual extension is a readonly Preview overlay;
- DSH `0.1.2-alpha.1` exposes a public `shell.overlay` list slot, while VectorAI still needs one internal session-scoped outlet so independently installed drawing plugins do not compete for the shell itself.

Engineering Annotation needs its own long-lived workflow and its own drawing UI while reusing the same Drawing document, coordinate system, renderer, selection semantics, transactions, and history. The first layer must therefore become a small 2D application platform rather than one fixed application screen.

## Goals

1. Keep one authoritative Drawing repository and revision history per DSH session.
2. Let a higher-layer plugin replace the complete drawing workspace for a session without replacing the first-layer repository or DSH slot registration.
3. Keep the chosen professional workspace sticky across task completion, cancellation, failure, and later basic first-layer commands; only another explicit professional capability route or session disposal may replace it.
4. Expose controlled React drawing primitives so a plugin can build its own layout without sharing a React Context or Zustand singleton across bundles.
5. Expose versioned Workspace, Canvas Layer, and Interaction Tool contribution contracts.
6. Split the public Host extension operation into pausable Preview, assessment, replacement, finalization, and discard stages.
7. Preserve the existing first-layer UI and interaction behavior as the default composition.
8. Support independently built and installed second-layer packages without DSH source changes, a VectorAI server, or cloud state.

## Non-goals

This change does not implement the production Engineering Annotation UI, zoning algorithm, feature recognition, collision optimizer, or coverage policy. It supplies a minimal packaged test contribution only to prove the platform boundary and routing lifecycle.

It does not implement a general replacement for every DSH slot kind. VectorAI adopts only the contribution and lifecycle principles needed by the 2D workspace.

It does not make rendered SVG authoritative, introduce a second Drawing repository, send complete Drawing documents through model context, or allow a UI plugin to commit directly.

## Architectural decision

The first-layer DSH Client contributes one entry to the public alpha `shell.overlay` list slot and declares one session-scoped VectorAI drawing child. The entry measures the official Conversation column, reserves its left side only while the current session has a Drawing, and renders `DrawingSurfaceHost` there. `DrawingSurfaceHost` owns a VectorAI-specific Workspace Chain. The first-layer UI is the permanent fallback. A higher-layer Client registers a workspace contribution with a session-scoped claim source.

```text
DSH root: sidebar | conversation | details
                        ^
                        +-- shell.overlay: VectorAI drawing inset
          |
          v
DrawingSurfaceHost                         first layer
          |
          +-- claimed professional surface ------> AnnotationWorkspace
          |
          +-- no available claim ----------------> DefaultDrawingWorkspace
```

This avoids professional plugins competing for DSH's shell slots and keeps layout adaptation inside the first-layer adapter without replacing the official root.

The design follows four useful DSH principles:

- the owner declares the outlet and its accepted contract;
- contributors register through one typed API and receive only an injected capability face;
- state is scoped to a session rather than held in module singletons;
- disposing a plugin registration removes its UI, subscriptions, interaction ownership, and temporary resources on one lifecycle axis.

## Package structure

```text
@vectorai/drawing-core
        |
@vectorai/drawing-workspace
        |
@vectorai/drawing-surface-api        public contribution contracts
        |
@vectorai/drawing-viewer-react       controlled primitives + default composition
        |
@vectorai/plugin-dsh-space-client    registry and DSH surface host
        |
@vectorai/plugin-dsh-annotation-client
```

Host-side dependencies remain inward:

```text
@vectorai/plugin-space-contracts     public Host extension contract
        ^
@vectorai/plugin-dsh-space-host      implementation and authority
        ^
@vectorai/plugin-dsh-annotation-host second-layer workflow/orchestration
```

`plugin-dsh-annotation-host` must stop importing the concrete `DrawingSpaceHostService` class. It consumes a public `DrawingSpaceExtensionHost` interface declared in the contract layer and receives the implementation through Cordis injection.

## Headless drawing runtime

`@vectorai/drawing-workspace` remains the host-neutral session runtime. It owns or projects:

- the formal `DrawingWorkspaceSnapshot`;
- the current first-layer Preview candidate;
- viewport and primary user selection;
- coordinate conversion and bounded spatial query access;
- revision-aware transactions and conflict presentation;
- Undo and Redo actions;
- source-resource acquisition and disposal;
- optional first-layer capability state such as Grounding and Motion Rig.

The package remains React-free and DSH-free. It does not contain Engineering Annotation workflow state.

The runtime exposes readonly observable sources and an explicit action face. A contribution never receives the raw Store API or a `setState` function.

```ts
interface DrawingSurfaceRuntime {
  snapshot: DrawingSurfaceObservable<DrawingWorkspaceSnapshot | null>;
  viewport: DrawingSurfaceObservable<DrawingWorkspaceViewport>;
  selection: DrawingSurfaceObservable<readonly string[]>;
  presentation: DrawingSurfaceObservable<DrawingPresentationSnapshot>;
  actions: DrawingSurfaceActions;
}

interface DrawingSurfaceActions {
  setViewport(viewport: DrawingWorkspaceViewport): void;
  setSelection(ids: readonly string[]): void;
  query(request: DrawingQueryRequest, signal?: AbortSignal): Promise<DrawingQueryResult>;
  stage(request: DrawingWorkspaceCommitRequest, signal?: AbortSignal): Promise<boolean>;
  undo(signal?: AbortSignal): Promise<boolean>;
  redo(signal?: AbortSignal): Promise<boolean>;
}
```

The concrete types may retain existing names where that avoids churn, but their authority and dependency rules are normative.

## Controlled React surface

`@vectorai/drawing-viewer-react` gains controlled primitives. The primitives receive state and callbacks through props and do not require a Provider created by a different plugin bundle.

The public set includes:

- `DrawingSurface`, the viewport and coordinate container;
- `GridLayer` and `AxesLayer`;
- `SourceLayer`, `GeometryLayer`, `AnnotationLayer`, and `RelationLayer`;
- `SelectionLayer` and `PreviewLayer`;
- a Canvas Layer outlet for contributed visual layers;
- `PanZoomController` and `SelectionController`;
- public coordinate, bounds, hit-test, box-selection, and fit-to-drawing utilities.

The current `Canvas` becomes a compatibility wrapper around the controlled surface. The current `DrawingWorkspace` becomes `DefaultDrawingWorkspace` internally and remains exported under its old name for compatibility.

Grounding and Motion Rig must no longer be unavoidable branches inside the base controlled Canvas. Their visual and pointer behavior become optional first-layer Layer/Controller compositions. The default workspace includes them; a custom workspace may omit them.

The second layer can therefore compose a workspace such as:

```tsx
<AnnotationWorkspace>
  <AnnotationLeftRail />
  <DrawingSurface {...drawingProps}>
    <GridLayer />
    <GeometryLayer />
    <AnnotationCandidateLayer />
    <AnnotationConflictLayer />
    <SelectionLayer />
  </DrawingSurface>
  <AnnotationInspector />
  <AnnotationWorkflowToolbar />
</AnnotationWorkspace>
```

## Public surface API

`@vectorai/drawing-surface-api` is a small versioned package. React types may appear as type-only declarations, but the package contains no React runtime, DSH dependency, global registry, or Store singleton.

### Workspace contribution

A Workspace contribution replaces the complete default drawing layout when its claim is elected.

```ts
interface DrawingWorkspaceContribution {
  id: string;
  apiVersion: 1;
  priority: number;
  claimSource: DrawingWorkspaceClaimSource;
  Component: DrawingWorkspaceComponent;
}

interface DrawingSurfaceRegistry {
  registerWorkspace(contribution: DrawingWorkspaceContribution): Disposable;
}
```

The fallback workspace is owned by the first layer and cannot be removed or shadowed by registration alone. A contribution is eligible only while its claim source explicitly reports an active claim for the current session.

### Canvas Layer contribution

A Canvas Layer contribution renders namespaced, temporary presentation inside a controlled Drawing surface. Typical uses include annotation candidates, zoning boundaries, conflict markers, coverage heatmaps, model attention, placement guides, and snapping hints.

Layer state is plugin-scoped. Destroying a workflow removes only that workflow's layer state.

### Interaction Tool contribution

An Interaction Tool contribution participates in pointer arbitration for the active surface. Only one primary tool owns left-button behavior at a time. Wheel zoom and middle-button or Space-drag pan remain shared navigation behaviors unless the active surface explicitly disables a declared navigation capability.

Plugins must not install unmanaged document-level mouse or keyboard listeners. Controller disposal releases pointer capture and all listeners.

### Presentation channels

The surface keeps these concepts separate:

```text
primary user selection       selectedIds
plugin or model attention    namespaced transient layer channel
formal annotations           DrawingDocument.annotations
```

A plugin must not change primary selection merely to show analysis attention or candidate membership. This prevents model grounding, fixed reference bodies, or coverage analysis from appearing as user selection.

## Workspace routing and sticky ownership

The Annotation Host persists a session projection independent of individual annotation tasks:

```ts
interface AnnotationSessionState {
  workspaceClaimed: boolean;
  activationEpoch: number;
  workflow: AnnotationWorkflowState;
}
```

The first successful route into an Engineering Annotation capability sets `workspaceClaimed` to `true`. The value remains true across `idle`, `running`, `reviewing`, `completed`, `canceled`, `failed`, and `needs-rebase` workflow states.

Completion, cancellation, and ordinary task failure never release the second-layer UI. The claim ends only when the DSH session is destroyed. If the plugin is unavailable, its contribution cannot be elected, so the first-layer fallback is shown temporarily without deleting the persisted claim. Reinstalling or reloading the second layer restores its UI from the claim projection.

The router never activates a contribution by inspecting message text, uploaded media, or the presence of a Drawing. Activation follows a successful capability route or explicit plugin command.

For future professional surfaces, the latest explicit specialized capability activation may replace the current specialized owner. The default first-layer workspace never reclaims ownership merely because a task finishes or because a later turn uses a basic first-layer command. In the first implementation, Engineering Annotation is the only non-fallback surface.

Routing order is deterministic:

1. discard unavailable or API-incompatible contributions;
2. retain contributions with an active claim for the current session;
3. choose the greatest activation epoch;
4. use priority only to break equal-epoch claims;
5. use contribution ID as the final stable tie-breaker.

## Cross-bundle injection

Independently installed Client plugins must not assume that module resolution deduplicates React, Zustand, or `drawing-viewer-react`.

The Registry injects readonly observable sources and action callbacks into the elected contribution. The render host binds observable sources to local selector hooks. Controlled drawing components accept ordinary props. No Provider or Store object crosses the plugin boundary.

This mirrors DSH's separation between host observables and renderer-bound hooks and prevents the second layer from silently reading an incompatible Context instance.

## Host extension transaction protocol

The current `runExtensionProgram()` remains as a convenience method for simple one-shot plugins. It is implemented over a new staged `DrawingSpaceExtensionHost` contract:

```ts
interface DrawingSpaceExtensionHost {
  getSnapshot(agent: Agent): DrawingWorkspaceSnapshot | null;
  query(agent: Agent, request: DrawingQueryRequest): DrawingQueryResult;

  createExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewCreateRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionPreviewResult>;

  replaceExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewReplaceRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionPreviewResult>;

  assessExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewAssessRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionAssessmentResult>;

  finalizeExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewFinalizeRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionFinalizeResult>;

  discardExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewDiscardRequest,
  ): ExtensionDiscardResult;
}
```

Every extension Preview capability is opaque and bound to:

- extension ID;
- workflow ID;
- DSH session identity;
- Drawing ID and base revision;
- program and candidate digests;
- creation and expiration times.

Only the owning extension and workflow may replace, assess, finalize, or discard the Preview. The first layer validates ownership before reading the candidate. A stale Drawing revision produces `needs-rebase`; it never updates the formal document.

The first layer remains the only commit authority. It owns program compilation, diagnostics, policy assessment, operation binding, the durable ledger, formal revision creation, and Undo/Redo history.

## Engineering Annotation data flow

```text
User requests automatic annotation
  -> DSH routes to annotation_start
  -> Annotation Host creates or resumes AnnotationSession
  -> Annotation Host sets the session workspace claim
  -> Annotation Client contribution becomes elected
  -> Annotation workflow queries the formal Drawing
  -> recognizer and planner produce plugin-owned candidates
  -> SpatialEditProgram creates a first-layer Preview
  -> first layer validates and assesses the Preview
  -> Annotation UI displays candidates, coverage, and conflicts
  -> user adjustment or replanning replaces the Preview
  -> user confirmation or eligible auto-safe policy finalizes it
  -> formal Drawing revision and Undo record are created
```

During a drag, the second layer updates only local transient candidate presentation. It replaces the Host Preview at the end of the gesture, not on every pointer move.

Candidate annotations are owned by the second-layer workflow until formal finalization succeeds. Only committed annotations enter `DrawingDocument.annotations` and survive removal of the second-layer plugin.

## Model and chat boundary

DSH continues to own the chat surface and model loop. The second layer owns its annotation tools and injects only conditional, task-relevant guidance after its capability has been selected.

The model receives bounded workflow state, bounded spatial query results, candidate summaries, diagnostics, and recent receipts. It does not receive a complete Drawing document, the complete candidate array, UI state, media bytes, or repeated long opaque handles.

An image upload alone does not claim the annotation workspace and does not imply import or vectorization. A claim is created only after a real Engineering Annotation capability route succeeds.

## Revision changes and recovery

If another capability changes the formal Drawing while annotation candidates exist:

1. the first layer rejects replacement or finalization against the stale base revision;
2. the annotation workflow enters `needs-rebase`;
3. the Annotation UI remains the active workspace;
4. the user can re-run analysis on the new revision or discard the old candidates;
5. no stale candidate is written over the newer Drawing.

Cancellation discards the active extension Preview and workflow-scoped Layers but leaves the session workspace claim active. A recoverable workflow failure does the same only when the second layer declares the candidate invalid; otherwise it retains the candidate and offers retry.

## Error handling

- Duplicate contribution IDs are rejected at registration.
- Unsupported API versions and missing required capabilities prevent election and produce a visible diagnostic.
- A contribution render error is contained by a contribution-level Error Boundary. The workspace continues to belong to the second layer and displays retry or diagnostic UI; the claim is not silently cleared.
- A Remote outage leaves the last safe snapshot visible in readonly mode. Mutating actions are disabled until revision authority is restored.
- A missing or unloaded claimed contribution causes a temporary first-layer fallback without deleting the claim.
- Disposing a contribution removes its registry row, subscriptions, controllers, pointer capture, temporary Layers, and owned browser resources.
- Preview ownership violations, expired handles, and digest mismatches are hard rejections and create no revision.

## Styling

Every contribution renders under a namespaced Surface root. Plugin CSS may use shared design tokens through CSS custom properties but must not modify `body`, universal selectors, or generic element rules outside that root.

The default and annotation workspaces may have different layouts and visual systems. Controlled Canvas primitives preserve geometry styling and interaction semantics unless the custom workspace deliberately supplies alternate declared styles.

## Migration scope

The first implementation performs these changes:

1. add `@vectorai/drawing-surface-api` and its contract tests;
2. expose readonly runtime sources and a restricted action face from `drawing-workspace`;
3. extract controlled surface layers and controllers from the existing Canvas;
4. rebuild the current Canvas and DrawingWorkspace as compatibility compositions;
5. move Grounding and Motion Rig rendering/interaction into optional first-layer compositions;
6. implement `DrawingSurfaceRegistry` and `DrawingSurfaceHost` in the first-layer DSH Client;
7. register the default first-layer workspace as the permanent fallback;
8. add the staged Host extension contract and implement `runExtensionProgram()` over it;
9. change Engineering Annotation Host typing to the public extension interface;
10. add a separately built minimal annotation Client contribution and durable claim projection for integration testing;
11. preserve the existing DSH layout adapter without adding a new DSH source patch.

The production annotation workflow and UI start in a subsequent specification after this platform passes its acceptance tests.

## Testing strategy

### Contract and dependency tests

- API version and capability negotiation;
- duplicate registration and deterministic election;
- dependency-boundary checks rejecting deep imports of the first-layer Client, Store, repository, or Host implementation;
- independently bundled contribution without shared React Context or Zustand identity.

### Runtime and lifecycle tests

- scoped observable reads and action-only writes;
- registration, disposal, plugin unload, and resource cleanup;
- primary selection remains unchanged when plugin attention Layers update;
- only one primary interaction controller receives left-button events;
- navigation controller behavior remains consistent.

### Routing tests

- installation alone does not activate the second layer;
- an uploaded image or ordinary conversation does not activate it;
- the first successful annotation capability route claims the workspace;
- completed, canceled, failed, idle, and `needs-rebase` workflows retain the second-layer workspace;
- reload restores the second-layer workspace;
- unload temporarily displays the first-layer fallback;
- reinstall restores the claimed second-layer workspace.

### Canvas parity tests

- pan, wheel zoom, fit-to-drawing, box selection, ordinary selection, and blank-canvas deselection;
- annotation text drag, Preview presentation, Undo, and Redo;
- Grounding and Motion Rig behavior in the default composition;
- visual regression at fixed viewports for the default workspace.

### Host protocol tests

- create, replace, assess, finalize, and discard extension Preview;
- extension and workflow ownership isolation;
- stale revision, expiry, digest mismatch, and Remote interruption;
- finalization creates exactly one durable revision and Undo record;
- the one-shot convenience method produces the same outcome as the staged sequence.

### Packaged DSH integration test

The acceptance test uses built Client and Host artifacts rather than workspace source imports:

```text
default first-layer UI
  -> invoke the packaged test annotation capability
  -> second-layer test UI takes over
  -> complete or cancel a task
  -> second-layer test UI remains
  -> reload the application
  -> second-layer test UI remains
  -> unload the second-layer plugin
  -> first-layer fallback appears
```

## Acceptance criteria

The platform is complete when:

- the current first-layer workspace behaves and renders as before;
- a separately packaged second-layer contribution can build a different full workspace from controlled drawing primitives;
- no shared Store or React Context crosses the plugin boundary;
- capability routing, not upload or message heuristics, creates a sticky session claim;
- task completion, cancellation, and failure do not return to the first-layer UI;
- all formal edits still pass through first-layer Preview, assessment, revision, and history authority;
- unloading the second layer cannot corrupt the Drawing or leave listeners and resources behind;
- the documented unit, integration, dependency, and packaged DSH tests pass.

## Rejected alternatives

### Competing directly for the DSH root slot

DSH `0.1.2-alpha.1` permits priority shadowing of `root`, but the winning root exclusively owns its child-slot declarations. A replacement cannot safely reuse the official sidebar, conversation and details tree. Therefore VectorAI preserves the official root, contributes through `shell.overlay`, and lets professional plugins use the session claim registry behind the first-layer drawing outlet.

### Adding more fixed slots to the current DrawingWorkspace

Panel and toolbar slots alone cannot support a second layer with a different workflow and complete layout. This would keep the Canvas and first-layer application shell coupled.

### Embedding annotation mode in the first-layer application

This is easy initially but prevents independent installation and release, makes later professional plugins grow the first layer, and violates the intended two-layer boundary.

### Releasing the claim when a task finishes

The annotation UI is a session workspace, not a modal task surface. Finishing or canceling one workflow must return to the second layer's idle state, not to the first-layer application.
