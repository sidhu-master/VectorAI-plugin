# Annotated DXF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the active engineering drawing and its visible formal annotations to a standards-compatible DXF while showing an in-plugin completion notice.

**Architecture:** The first-layer export service remains the shared UI port. When the second-layer workspace is active it targets a second-layer Host endpoint that composes the canonical drawing with the current engineering annotation plan. DXF output uses standard CAD entities and dedicated layers; partition rectangles and interaction-only overlays are excluded.

**Tech Stack:** TypeScript, Cordis Host routes, React, AutoCAD 2000 ASCII DXF (AC1015)

**Spec:** User-confirmed design in the current task.

## Global Constraints

- Do not modify the DSH application source.
- Export exactly the current visible formal annotations: deterministic dimensions, axial dimension chains, datum identifiers, and feature-control frames.
- Exclude partition boxes, selections, drag handles, preview controls, and other UI-only state.
- Use AutoCAD DXF entity group codes and explicit annotation layers.
- Per the user's rapid-fix preference, do not add or run tests and do not create a PR.

---

### Task 1: CAD export composition

**Files:**
- Modify: `packages/drawing-core/src/io/dxf.ts`
- Create: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.ts`

**Interfaces:**
- Consumes: canonical `DrawingDocument` and `DimensionPlanSessionSnapshot`.
- Produces: a complete AC1015 DXF string with geometry and engineering annotation layers.

- [x] Extend the DXF writer with public standard primitive/entity contributions and explicit layer declarations.
- [x] Translate the axial scheme into dimension lines, extension lines, dimension text, and a distinguishable closure representation.
- [x] Translate datum identifiers and feature-control frames into portable LINE/LWPOLYLINE/TEXT entities with stable world-space positions.
- [x] Preserve deterministic dimension annotations already present in the canonical drawing.

### Task 2: Second-layer Host export endpoint

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/drawing-export.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-dsh-annotation-host/package.json`

**Interfaces:**
- Consumes: session id, expected drawing id/revision, drawing snapshot, and current dimension plan.
- Produces: `{ status, filename, path }` JSON after writing a non-overwriting file under `~/Downloads`.

- [x] Register the annotated export route in the second-layer Host.
- [x] Reject stale drawing references and missing drawings.
- [x] Export the draft when it is the visible state, otherwise export the confirmed revision.

### Task 3: Plugin-owned export notification

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/drawing-export.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes: export route override and export result.
- Produces: visible non-blocking success/error Toast inside the active workspace.

- [x] Return structured export results instead of calling `window.alert`.
- [x] Point the second-layer workspace at the annotated export endpoint.
- [x] Render an auto-dismissing success/error Toast above the canvas.
