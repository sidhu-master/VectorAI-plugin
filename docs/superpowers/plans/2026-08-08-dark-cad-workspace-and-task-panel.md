# Dark CAD Workspace and Agent Task Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cohesive dark CAD workspace whose Agent task panel hides model metadata and whose canvas safely renders every current explicit 2D CAD entity.

**Architecture:** Extract finite geometry bounds and SVG entity rendering from `Canvas` into focused, exhaustively typed modules. Map raw Agent events to a small user-facing stage model before rendering, while preserving raw events in the store and local audit files. Add a component error boundary around only the canvas, then apply one neutral dark visual system across the existing three-column workspace.

**Tech Stack:** React 18, TypeScript 5.8, Zustand, SVG, Tailwind CSS 3, Vitest, React server rendering tests.

## Global Constraints

- Work directly on the existing main branch; do not create a branch, worktree, or subagent.
- Keep `test1.jpg` untracked and do not modify or commit it.
- Do not add layers, blocks, fills, or 3D behavior.
- Do not expose model names, model roles, attempts, raw run IDs, call arguments, or stack traces in the normal task UI.
- Preserve the existing local audit data and low-confidence model routing behavior.
- Use one low-saturation blue-cyan accent; reserve green, amber, and red for compact semantic states.

---

### Task 1: Exhaustive finite CAD geometry bounds

**Files:**
- Create: `src/components/canvas/geometry.ts`
- Create: `src/components/canvas/geometry.test.ts`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Produces: `BBox`, `entityBounds(entity: GeometryEntity): BBox | null`, `modelBounds(entities: GeometryEntity[]): BBox | null`, `entityCenter(entity: GeometryEntity): Vec2 | null`, and `aabbIntersects(a: BBox, b: BBox): boolean`.
- Infinite `ray` and `xline` entities return `null` bounds so they cannot poison auto-fit.

- [ ] Write table-driven failing tests with literal bounds for point, line, circle, arc including a quadrant extreme, rotated ellipse, polyline, spline, text, and dimension; assert ray/xline and malformed numeric data return `null`.
- [ ] Run `npm test -- src/components/canvas/geometry.test.ts` and confirm failure because the module does not exist.
- [ ] Implement normalized angles, arc extremum inclusion, rotated ellipse extents, finite-point guards, bounds union, centers, and AABB intersection.
- [ ] Run the focused test and confirm it passes.
- [ ] Replace the unsafe local helpers in `Canvas.tsx`; filter `null` bounds during box selection.
- [ ] Run the focused test plus `npm run check`.
- [ ] Commit with `fix(canvas): bound all CAD entities safely`.

### Task 2: Exhaustive SVG rendering for explicit CAD entities

**Files:**
- Create: `src/components/canvas/EntityRenderer.tsx`
- Create: `src/components/canvas/EntityRenderer.test.tsx`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Consumes: all variants of `GeometryEntity`, current viewport bounds, scale, selected state, and selection callbacks.
- Produces: `EntityRenderer` that returns stable SVG for point, line, ray, xline, circle, arc, ellipse, polyline, spline, text, and dimension.

- [ ] Write failing static-render tests using one literal entity of every type; assert each output contains its entity ID marker, construction lines are dashed, and low-confidence geometry uses the danger stroke.
- [ ] Run `npm test -- src/components/canvas/EntityRenderer.test.tsx` and confirm the missing renderer failure.
- [ ] Implement common hit areas and strokes; clip ray/xline to viewport; build arc and polyline paths; use a smooth control-point path for the first spline renderer; counter-flip text and dimensions so labels remain readable under the CAD Y-axis transform.
- [ ] Run the focused renderer tests and confirm they pass.
- [ ] Replace `Canvas`'s three-type switch with `EntityRenderer`, keeping selection and interaction behavior.
- [ ] Run both canvas-focused test files and `npm run check`.
- [ ] Commit with `feat(canvas): render explicit 2D CAD primitives`.

### Task 3: Isolate canvas failures from the application shell

**Files:**
- Create: `src/components/CanvasErrorBoundary.tsx`
- Create: `src/components/CanvasErrorBoundary.test.tsx`
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Produces: a class error boundary with a `resetKey` tied to the model revision/entity set and a neutral fallback containing `重新加载画布`.
- The fallback resets only the boundary state and never clears the model, history, chat, or Agent run.

- [ ] Write a failing test for the boundary state transition and rendered recovery fallback without mocking the canvas.
- [ ] Run `npm test -- src/components/CanvasErrorBoundary.test.tsx` and confirm failure because the component is absent.
- [ ] Implement the boundary and wrap only `<Canvas />` in `Home`.
- [ ] Run the focused test and `npm run check`.
- [ ] Commit with `fix(ui): isolate canvas rendering failures`.

### Task 4: User-facing Agent stage projection and redesigned task card

**Files:**
- Create: `src/components/agent/task-presentation.ts`
- Create: `src/components/agent/task-presentation.test.ts`
- Modify: `src/components/ConstructionTimeline.tsx`
- Modify: `src/components/AIDialog.test.tsx`

**Interfaces:**
- Produces: `presentAgentTask({ plan, status, currentStepIndex, events, commitCount })` returning a natural-language heading, elapsed summary, five normalized stages, and sanitized detail rows.
- Raw event data remains untouched in Zustand; only the presentation projection removes restricted metadata.

- [ ] Write failing tests that feed model events containing `doubao-seed-2.0-lite`, planner role, attempt, and run ID; assert none enter the presentation result while durations and safe titles remain visible.
- [ ] Add failing stage-mapping tests for planning, perception/tool activity, commit activity, completed, paused, and failed states.
- [ ] Run the focused test and confirm missing projection failures.
- [ ] Implement event sanitization and phase mapping with stable user-facing labels: 理解需求, 解析图纸, 构建模型, 应用修改, 验证完成.
- [ ] Run focused tests and confirm they pass.
- [ ] Redesign `ConstructionTimeline` as a restrained task card with one current-stage emphasis, compact semantic states, collapsible execution details, pause/resume/stop controls, and no duplicate instruction input.
- [ ] Extend the static AIDialog test to assert the restricted model name is absent and the main composer remains present.
- [ ] Run component tests and `npm run check`.
- [ ] Commit with `feat(agent-ui): present auditable tasks without model metadata`.

### Task 5: Apply the neutral dark CAD visual system

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Modify: `src/pages/Home.tsx`
- Modify: `src/components/TopToolbar.tsx`
- Modify: `src/components/AIDialog.tsx`
- Modify: `src/components/ObjectList.tsx`
- Modify: `src/components/ParameterEditor.tsx`
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Existing component contracts remain unchanged; this task changes layout classes, typography, surfaces, states, and copy only.

- [ ] Add a failing static shell test in `src/pages/Home.test.tsx` that asserts the workspace landmarks, single AI composer, and canvas recovery boundary render together.
- [ ] Run `npm test -- src/pages/Home.test.tsx` and confirm the new landmark expectations fail.
- [ ] Replace blue-toned surfaces with neutral zinc-like layers; set a single low-saturation accent; unify borders, scrollbars, focus rings, buttons, empty states, and panel headers.
- [ ] Increase the AI panel to a readable desktop width, keep the canvas dominant, and make the left/right panels collapsible at narrow desktop widths through CSS utility behavior.
- [ ] Update CAD strokes: neutral primary geometry, accent selection, red low confidence, muted dashed construction geometry, and subtle grid/axes.
- [ ] Run the shell/component tests and `npm run check`.
- [ ] Commit with `feat(ui): refine dark CAD workspace`.

### Task 6: Regression, build, and real-browser acceptance

**Files:**
- Modify only files required by defects found during verification.

**Interfaces:**
- No new interface; this task validates the integrated result.

- [ ] Run `npm test` and require zero failed tests.
- [ ] Run `npm run check`, `npm run lint`, and `npm run build`; fix any in-scope errors and rerun the failing command.
- [ ] Verify `git diff --check` and confirm `test1.jpg` remains untracked.
- [ ] Open `http://localhost:5173/` in the in-app browser and replay the most recent model containing arc, ellipse, xline, and dimension entities.
- [ ] Confirm the page remains mounted, all entity categories display, the task card contains no model name, controls remain usable, low-confidence entities are red, and the layout is coherent at normal and narrow desktop widths.
- [ ] Inspect browser console errors and fix any regression, then rerun all automated verification affected by the change.
- [ ] Commit any final verification fixes with a scoped message.
