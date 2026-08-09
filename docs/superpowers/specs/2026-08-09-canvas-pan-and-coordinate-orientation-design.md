# Canvas Pan and Coordinate Orientation Design

## Goal

Parsed drawings render upright in the CAD coordinate system, and panning remains visually stable with a realistic number of entities.

## Root causes

Vision observations use normalized image coordinates: X grows right and Y grows down from the top-left. Region stitching currently preserves the downward Y value, while the SVG world group correctly converts CAD Y-up coordinates to screen Y-down. This applies the wrong orientation at the perception boundary and mirrors parsed drawings vertically.

During panning, every mouse move writes `canvasTransform` into the global Zustand store. Even with requestAnimationFrame throttling, each frame re-renders the canvas, every entity, the toolbar, and the status bar. Entity hit targets also stop the initial mouse-down event, so dense drawings cannot reliably start a pan.

## Design

### Coordinate boundary

- Keep `DrawingDocument` in CAD coordinates with +Y upward.
- Convert page/image Y to CAD Y while stitching geometry: `cadY = (1 - imageY) * pageHeightToWidthRatio`.
- Negate Y components of stitched direction and major-axis vectors.
- Convert annotations with the same image-to-CAD transform: `scaleY = -ratio`, `offsetY = ratio`.
- Reflect arc angles and winding when the coordinate transform changes handedness.
- Do not add renderer-specific exceptions for perceived geometry.

### Stable pan interaction

- A pan session derives its transform from the pointer-down transform plus pointer delta.
- Mouse moves update the SVG world group and screen-label overlay directly, without writing global state.
- Mouse-up or mouse-leave commits the final transform once to Zustand.
- Mouse-down on an entity bubbles to the canvas so a dense drawing can still be panned; click selection remains guarded by the existing drag threshold.
- Wheel zoom continues to use frame-coalesced state updates.

## Scope

The change is limited to perception coordinate conversion, the canvas pan controller, Canvas integration, and regression tests. It preserves the existing progressive-stage visualization changes in the dirty worktree and does not alter the Drawing schema, Agent workflow, or model prompts.

## Verification

- Unit tests prove asymmetric image Y values become the expected CAD Y values and reflected vectors/arc winding are correct.
- Unit tests prove pan previews do not commit global state and pan completion commits exactly once.
- Existing perception, canvas, type, and build suites pass.
- A local browser drag keeps entity count stable and changes the world transform without console errors.
