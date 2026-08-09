# Default CAD Scale and Atomic Promotion Design

## Goal

When an uploaded raster or PDF page has no trustworthy drawing scale, persist it as a useful millimetre-scale CAD document instead of treating normalized image coordinates as millimetres. During progressive perception, replace preview entities with committed entities without a visible gap.

## Confirmed failure

Run `run_bdfe4d90-f01d-486f-82f0-848db1202aeb` produced 83 entities in a document declared as millimetres, but its finite model bounds were only `0.93408 × 1.335263409`. The run emitted 18 incremental commits. For each commit the client received a preview removal and fetched the authoritative drawing asynchronously, so a preview entity could disappear before its committed counterpart arrived.

## Coordinate and unit boundary

- Vision output remains normalized image space: top-left origin, X right, Y down.
- Drawing IR remains canonical CAD space: millimetres, X right, Y up.
- If no reliable source scale is available, the full source page width is exactly `500 mm`.
- Page height is `500 × heightToWidthRatio` millimetres, preserving source aspect ratio.
- Region stitching applies the page-width scale to points, vectors, radii, ellipse axes, polyline vertices, spline control points, and arc angle/winding conversion.
- Annotation conversion uses the same physical transform, including annotation positions, dimension points, and text height.
- The default scale is applied at the perception boundary. The renderer must not reinterpret or multiply Drawing IR coordinates.
- Future dimension-derived scale inference can replace the default through the same scale-resolution interface; it is outside this fix.

## Atomic preview promotion

- A `promote` delta may request removal of preview IDs after their transaction commits.
- The client removes a preview ID only when the current authoritative `DrawingDocument` already contains the same ID.
- If the drawing refresh has not arrived, the preview remains visible.
- When a refreshed drawing snapshot arrives, the store removes all preview IDs now present in the authoritative geometry or annotation collections in the same state update.
- Terminal events still clear all remaining preview state.
- This rule is ID-based and does not use timers, network-speed assumptions, or duplicate geometry comparisons.

## Completion semantics

This change does not expand the perception budget. A run whose coverage ledger contains unread regions continues to expose partial coverage in its audit data; changing the public terminal state is a separate workflow-policy change.

## Verification

- An asymmetric region coordinate test proves a full-page width maps to `500 mm` and Y maps to `500 × ratio` millimetres.
- An annotation pipeline test proves positions and text height use the identical physical transform.
- Store tests prove a promotion received before drawing refresh keeps the preview, then removes it atomically when the committed document arrives.
- Existing perception, Drawing, Canvas, TypeScript, and production-build suites remain green.
- A local real-flow check confirms visible 10/50 mm grid spacing and stable entity count during progressive replacement and pan.
