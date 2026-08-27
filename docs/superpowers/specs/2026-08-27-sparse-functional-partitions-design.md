# Sparse Functional Partitions Design

## Problem

The current functional-partition view derives each functional region from the
full extent of its referenced physical shaft segments. Document intervals are
therefore widened to geometric step boundaries. The AI reviewer can also assign
every remaining segment, causing functional regions to cover the whole shaft and
look identical to the continuous axial-segment view.

## Domain Model

- `segments` remain the complete, contiguous geometric decomposition of the shaft.
- Every semantic group may carry an independent axial `range` with `zStart` and
  `zEnd`. `segmentIds` describe related geometric evidence, not the visible bounds.
- New document groups always retain their exact document interval.
- New AI groups use the union of their referenced segments because AI is not
  allowed to emit coordinates.
- Legacy groups without a range remain readable and derive their range from their
  referenced segments.
- Functional groups may overlap or leave gaps. They are not required to cover the
  shaft.

## Fusion and AI Acceptance

- Document fusion still matches a region to physical segments for evidence and
  profile validation, but stores the source interval as the functional range.
- AI review is an abstaining classifier. A proposal is accepted only when it has
  sufficiently high confidence, cites visual evidence for every proposed segment,
  and uses a supported concrete functional type. Generic labels such as “工作区域”
  cannot turn an otherwise unclassified gap into a functional region.
- Rejected proposals leave the corresponding axial segments unclassified.

## Editing and Presentation

- Functional view renders semantic-group ranges and therefore exposes natural
  gaps. Axial-segment view continues to render the complete contiguous geometry.
- Dragging a handle in functional view edits that semantic group's start or end
  range only. It does not change geometric step boundaries.
- Dragging a handle in axial-segment view keeps the existing physical boundary
  editing behavior.
- Undo, redo, confirmation, cancellation, reopen, and persisted sessions cover
  both edit command types.

## Compatibility

The wire schema adds an optional range so existing saved version-1 sessions can
still be loaded. All newly created groups include a range. A future storage
migration can make the field mandatory after legacy sessions have aged out.

## Sample Acceptance Result

For the current sample, document coordinates are constraints and the functional
view must reconcile them with accepted DXF shoulders. The gear's raw
`63.5–118.5` interval conflicts with an exact 55 mm, diameter-matching tooth
profile at `92–147`, so geometry owns the final coordinates:

- 左轴承位: 0–17
- 外花键: 17–41.5
- 常规区域: 41.5–92 (post-review fused evidence: AI may classify first; a bounded
  deterministic fallback fills the substantial span only after abstention)
- 一级齿轮: 92–147
- 右轴承位: 150–173

The 147–150 transition remains visually empty. Axial-segment view remains
continuous from 0 through 173.
