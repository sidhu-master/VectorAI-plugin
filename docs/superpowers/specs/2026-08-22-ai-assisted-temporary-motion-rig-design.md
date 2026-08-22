# AI-Assisted Temporary Motion Rig Design

**Date:** 2026-08-22  
**Status:** Approved  
**Scope:** VectorAI first-layer 2D space plugin, shared Drawing workspace, and DSH adapter

## 1. Decision

VectorAI will add a temporary motion-rig workflow for interactive part repositioning. The model identifies semantic roles and asks the first-layer Drawing plugin to prepare a rig; the Host resolves exact Drawing geometry and topology; the shared canvas performs all pointer-time geometry solving locally. The model does not choose final coordinates and is not called during dragging.

The first supported motion is a fixed-anchor, single-handle translation:

- the user asks for a movable hinge on a semantic part such as an arm;
- the model identifies the control body, connector group, and fixed attachment conceptually;
- the Host constructs and validates an ephemeral rig from the current Drawing revision;
- the user drags the control body without rotating it;
- a deterministic local solver keeps the anchor fixed and reshapes connector geometry;
- pointer-up creates a Preview;
- confirmation commits one undoable interactive edit, while cancellation restores the original Drawing;
- confirmation or cancellation destroys the rig.

This is a general articulation primitive. No character-specific, body-part-specific, or gesture-specific solver rule is permitted.

## 2. Goals

- Replace unreliable model-generated final transforms with user-controlled interactive placement.
- Keep semantic recognition in the model while keeping exact node identity, topology, and coordinates in trusted code.
- Support a rigid control body made from multiple Drawing nodes.
- Support a connector group made from multiple or geometrically discontinuous Drawing nodes.
- Allow users to correct AI recognition with the existing click, box-select, and additive-selection interactions.
- Rebuild and validate the whole rig after a selection correction instead of mutating raw node arrays.
- Run pointer-time solving entirely on the local computer with no model or network round trip.
- Produce a standard Preview and one durable, undoable interactive commit.
- Share the feature between the DSH client and VectorAI website through the existing workspace adapter boundary.

## 3. Non-Goals for the First Version

- Automatic control-body rotation.
- A separate rotation handle.
- Multi-joint inverse kinematics.
- Collision avoidance or global pose optimization.
- Persisting rig metadata in the Drawing document or DXF export.
- Automatically vectorizing an uploaded image.
- Adding character-specific rules for waving, crossed arms, or any regression fixture.
- Modifying DSH source code or installing a global routing prompt.

## 4. Responsibility Boundaries

### 4.1 Model

The model may:

- interpret an explicit user request to create a movement constraint;
- name the semantic target, control role, and fixed role;
- use the current verified user selection as evidence;
- call the explicit motion-rig preparation tool.

The model must not:

- provide Drawing node IDs;
- calculate or provide world coordinates;
- provide a final translation vector;
- carry rig, Preview, or revision handles between tool calls;
- receive pointer-move events;
- finalize a drag on the user's behalf.

### 4.2 Plugin Host

The Host owns:

- the session- and revision-bound motion-rig record;
- semantic grounding to exact Drawing nodes;
- role partitioning into control body, connectors, fixed environment, anchor, and handle;
- topology analysis and connector ordering;
- validation and atomic replacement after user correction;
- invalidation after import, commit, undo, redo, or any revision change;
- compact tool results and canvas projections;
- staging the final interactive edit through the existing durable command path.

### 4.3 Shared canvas and local solver

The shared Drawing canvas owns:

- rendering the temporary selection, anchor, and handle;
- ordinary click, box, and additive selection correction;
- pointer capture and drag state;
- local candidate geometry at interactive frame rate;
- primitive-specific connector deformation;
- transient validity feedback;
- creation, acceptance, and cancellation of the final Preview.

### 4.4 Adapters

DSH and the website expose the same workspace capability through different adapters. The domain contracts and solver behavior remain adapter-independent. The feature must not require a DSH source patch.

## 5. Activation and Tool Routing

The plugin contributes one explicitly described semantic tool, provisionally named `drawing_create_motion_rig`:

```ts
interface DrawingCreateMotionRigRequest {
  target: string;
  controlRole?: string;
  fixedRole?: string;
  motion: 'translate';
}
```

The request contains semantic intent only. Session identity, root user turn, Drawing revision, current selection, and all internal handles come from trusted runtime context.

The tool is eligible only when the direct user request explicitly asks to articulate, hinge, drag, reposition, or interactively pose Drawing content. Ordinary image upload, image description, general chat, and unrelated plugin requests must not activate the tool or open the Drawing workspace. If no editable vector Drawing exists, the result is `drawing_required`; the tool must not start vectorization automatically.

The tool result is bounded and presentation-oriented:

```ts
type DrawingCreateMotionRigResult =
  | {
      state: 'ready';
      summary: string;
      controlNodeCount: number;
      connectorNodeCount: number;
    }
  | {
      state: 'needs_correction';
      summary: string;
      reason: string;
    }
  | {
      state: 'blocked';
      code: 'drawing_required' | 'unsupported_geometry' | 'ambiguous_topology';
      message: string;
    };
```

Internal node IDs and opaque lineage identifiers are not returned to the model.

## 6. Host-Owned Motion Rig

The Host stores an ephemeral `MotionRigSession`:

```ts
interface MotionRigSession {
  rigId: string;
  sessionId: string;
  rootUserMessageId: string;
  drawingRef: DrawingWorkspaceRef;
  stateEpoch: number;
  state: 'analyzing' | 'needs_correction' | 'ready' | 'dragging' | 'preview';
  roles: {
    controlBodyNodeIds: string[];
    connectorNodeIds: string[];
    fixedEnvironmentNodeIds: string[];
  };
  joints: {
    anchor: Vec2;
    handle: Vec2;
  };
  constraints: {
    keepAnchorFixed: true;
    keepControlBodyRigid: true;
    preserveConnectivity: true;
    allowControlRotation: false;
  };
}
```

The public workspace projection contains only the data required to render and interact with the active rig. It remains revision-bound and may contain exact node IDs because it travels over the trusted Host-to-client workspace channel, not through the model.

Only one active rig is allowed per Drawing session in version one. Creating a new rig discards any uncommitted rig and Preview after applying the same safe cancellation behavior as an explicit cancel.

## 7. Role Resolution and User Correction

The AI's result is an initial semantic hypothesis, not an authoritative node list. The Host resolves it using current selection, bounded visual grounding, source grouping, proximity, endpoint incidence, and topology.

The canvas exposes no role-specific toolbar. Correction uses the existing selection grammar:

- click selects a candidate node or connected candidate group;
- box selection selects nodes in a region;
- Shift-click and Shift-box add or remove candidates;
- clicking blank space clears only ordinary selection and does not silently destroy the rig.

The corrected selection is a hint describing the intended movable assembly. After every correction, the Host recomputes the complete role partition:

- the terminal rigid carrier is the control body;
- connector candidates form paths between the control body and fixed environment;
- the fixed-side attachment becomes the anchor;
- the control-side attachment becomes the handle binding.

The Host builds a new candidate rig and validates it before atomically replacing the current valid rig. A failed correction never damages the previous valid rig. The UI reports a bounded reason such as a missing fixed attachment, multiple equally likely anchors, or unsupported connector geometry.

The anchor marker itself may be dragged to another nearby valid endpoint. On release, it snaps to the nearest eligible endpoint and triggers the same full candidate rebuild and validation.

## 8. Local Solve

The version-one solver applies the handle displacement to every control-body node as one rigid translation. It does not rotate the control body.

For each connector, the Host projection supplies a fixed endpoint binding and a control-side endpoint binding. During pointer movement:

1. the fixed endpoint remains at the anchor-side position;
2. the control body translates by the handle delta;
3. the control-side attachment follows the translated control body;
4. the connector is deformed with its primitive-specific strategy;
5. the candidate is accepted only if it remains finite, non-degenerate, and connected within tolerance.

Required first-version strategies:

- line: preserve the fixed endpoint and replace the control-side endpoint;
- polyline or path: preserve the fixed endpoint and distribute displacement over intermediate points by normalized path distance;
- cubic or quadratic Bezier representation: move the control-side endpoint and its adjacent control handle while preserving the fixed-side endpoint and handle;
- arc: refit only when the existing primitive representation and endpoint constraints admit a stable solution; otherwise return `unsupported_geometry`.

Disconnected Drawing nodes may belong to one connector role. They are ordered and bound by spatial adjacency and semantic grouping before dragging. Discontinuity does not by itself invalidate a part.

The solver must never fall back to translating the entire connector group rigidly. An unsupported or invalid candidate stops at the last valid pointer position and presents a visible warning.

Pointer movement updates an in-memory display candidate only. It does not create Host revisions, remote calls, conversation messages, or durable operations.

## 9. Preview, Commit, Cancel, and Invalidation

Pointer-up converts the last valid local candidate into ordinary `DrawingWorkspaceCommand[]` updates and creates a workspace Preview against the rig's base revision.

- Confirm stages and applies the Preview through the existing interactive durable path, producing exactly one undoable commit.
- Cancel discards the Preview, restores the base Drawing, clears the rig projection, and removes all temporary markers.
- Confirmation also clears the rig projection after commit.
- Undo and redo operate on the one committed geometry transaction; rig metadata is not restored.
- A revision mismatch invalidates the rig and any local candidate before it can be staged.
- Session disposal or a new direct-user rig request safely discards the uncommitted rig.

Rig state and metadata are never written to the Drawing document, persistence repository, or DXF export.

## 10. Canvas Presentation and Input

During AI analysis, the existing transient AI-selection animation shows candidate nodes. Once ready, the rig uses one temporary edit highlight rather than permanent orange/purple semantic coloring.

The ready projection renders:

- one consistent temporary highlight for the movable assembly;
- a fixed anchor marker;
- a draggable handle on the control body;
- a validity status that does not rely on color alone.

Input rules:

- dragging the rig handle edits geometry;
- dragging blank canvas continues to pan according to existing web behavior;
- wheel zoom and existing selection gestures remain unchanged;
- Escape cancels the current drag; a second Escape cancels the rig;
- blank-click clears ordinary selection but leaves the rig active;
- pointer-up enters Preview;
- the bottom floating toolbar exposes only contextual confirm and cancel icons, with accessible labels and hover tooltips.

There is no separate hand, arm, or shoulder toolbar.

## 11. Error Handling

Stable failure dispositions include:

- `DRAWING_REQUIRED`: no editable vector Drawing is loaded;
- `MOTION_RIG_AMBIGUOUS`: role or anchor resolution has multiple equally valid results;
- `MOTION_RIG_INVALID`: the selected assembly cannot produce a fixed-anchor connector relationship;
- `MOTION_RIG_GEOMETRY_UNSUPPORTED`: a required connector cannot be solved safely;
- `MOTION_RIG_STALE`: the Drawing revision changed;
- `MOTION_RIG_PREVIEW_CONFLICT`: the final candidate no longer matches the base revision.

Failures do not mutate the canonical Drawing. Model-facing errors remain compact and actionable; detailed diagnostics remain in Host logs.

## 12. Testing and Acceptance

### 12.1 Unit tests

- role partitioning finds a control carrier, connector group, and fixed anchor without gesture-specific labels;
- disconnected connector nodes can form one valid role;
- selection correction atomically replaces a valid rig only after validation;
- line and polyline deformation keep the fixed endpoint unchanged;
- the control body translates without rotating;
- unsupported arc geometry fails closed and never rigidly translates the connector group;
- stale revisions invalidate a rig;
- confirm emits one interactive commit and cancel emits none.

### 12.2 Contract and adapter tests

- strict schemas accept valid rig requests and projections and reject raw coordinate/model-node fields;
- DSH remote methods and website workspace adapters expose equivalent rig operations;
- model-facing tool results contain no node IDs or rig handles;
- missing Drawings do not trigger import, vectorization, or workspace reveal.

### 12.3 Viewer interaction tests

- handle drag updates a local candidate while the anchor remains fixed;
- click, box, and Shift selection trigger candidate rebuild rather than raw role mutation;
- blank drag pans and blank click clears ordinary selection;
- pointer-up enters Preview;
- confirm, cancel, and Escape clear all temporary markers correctly;
- wheel zoom and ordinary selection retain web parity.

### 12.4 End-to-end acceptance

With a real vectorized test Drawing:

1. ask the model to create a movement hinge for an arm;
2. verify that the model calls the semantic rig tool without coordinates or node IDs;
3. verify that the actual resolved movable assembly is highlighted;
4. drag the hand and observe the hand translating while the shoulder remains fixed and arm connectors reshape locally;
5. release and inspect Preview;
6. cancel once and verify an exact restoration with no commit;
7. repeat, confirm, then Undo and Redo the change as one operation;
8. verify that no rig metadata appears in exported DXF;
9. upload an unrelated ordinary image in a new session and verify that no Drawing workspace or vectorization starts.

## 13. Open Extension Points

The solver strategy is extensible by connector primitive and motion type. Later versions may add a rotation handle, length-preserving articulated chains, multi-joint inverse kinematics, collision constraints, or persistent engineering mechanism constraints. Those additions require separate design approval and must not change the semantic/tool boundary established here.
