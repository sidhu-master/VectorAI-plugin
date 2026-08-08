# Reliable Canvas Clear Design

## Goal

The top-right trash button empties the current canonical drawing reliably for MVP testing.

## Behavior

- Clear geometry, annotations, relations, features, selection, and transient perception preview.
- Use one auditable Drawing transaction containing deterministic delete commands.
- Read the latest workspace before clearing so background Agent commits cannot leave the UI on a stale revision.
- If the drawing is already empty, still project the latest empty workspace locally without creating a no-op commit.
- Keep refresh persistence unchanged. A cleared drawing remains empty after refresh.
- Surface failures through the existing drawing error state; no confirmation dialog or new workflow is added.

## Scope

Only the frontend drawing store and its tests change. Drawing Core, repository storage, toolbar layout, and Agent runtime remain unchanged.

## Verification

Store tests cover clearing from a stale visible revision and clearing an already-empty latest workspace. The focused suite, full test suite, type-check, and production build must pass.
