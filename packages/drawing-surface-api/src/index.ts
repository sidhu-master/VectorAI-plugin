// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingSpatialQuery,
  DrawingSpatialQueryResult,
} from '@vectorai/drawing-spatial';
import type {
  DrawingGroundingOverlay,
  DrawingMotionRigWorkspaceState,
  DrawingSourceResource,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceDisplay,
  DrawingWorkspacePreview,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';

export const DRAWING_SURFACE_API_VERSION = 1 as const;

export interface Disposable {
  dispose(): void;
}

export interface DrawingSurfaceObservable<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export interface DrawingWorkspaceClaim {
  active: boolean;
  activationEpoch: number;
}

export interface DrawingSurfacePresentationSnapshot {
  displaySnapshot: DrawingWorkspaceSnapshot | null;
  preview: DrawingWorkspacePreview | null;
  groundingOverlay: DrawingGroundingOverlay | null;
  motionRig: DrawingMotionRigWorkspaceState | null;
  sourceResource: DrawingSourceResource | null;
  display: DrawingWorkspaceDisplay;
  busy: boolean;
  error: { code: string; message: string } | null;
}

export interface DrawingSurfaceActions {
  setViewport(viewport: DrawingWorkspaceViewport): void;
  setSelection(ids: readonly string[]): void;
  query(request: DrawingSpatialQuery, signal?: AbortSignal): Promise<DrawingSpatialQueryResult>;
  stage(request: DrawingWorkspaceCommitRequest, signal?: AbortSignal): Promise<boolean>;
  undo(signal?: AbortSignal): Promise<boolean>;
  redo(signal?: AbortSignal): Promise<boolean>;
}

export interface DrawingSurfaceRuntime {
  snapshot: DrawingSurfaceObservable<DrawingWorkspaceSnapshot | null>;
  viewport: DrawingSurfaceObservable<DrawingWorkspaceViewport>;
  selection: DrawingSurfaceObservable<readonly string[]>;
  presentation: DrawingSurfaceObservable<DrawingSurfacePresentationSnapshot>;
  actions: DrawingSurfaceActions;
}

export interface DrawingSurfaceComponentProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
}

export type DrawingSurfaceComponent<Props = DrawingSurfaceComponentProps> = (
  props: Props,
) => unknown;

export interface DrawingWorkspaceContribution<Props = DrawingSurfaceComponentProps> {
  id: string;
  apiVersion: 1;
  priority: number;
  claim: DrawingSurfaceObservable<DrawingWorkspaceClaim>;
  Component: DrawingSurfaceComponent<Props>;
}

export interface DrawingWorkspaceContributionCandidate {
  contribution: DrawingWorkspaceContribution;
  available: boolean;
}

export interface DrawingWorkspaceRegistrySnapshot {
  electedId: string | null;
  contributionIds: readonly string[];
}

export interface DrawingSurfaceRegistry {
  registerWorkspace(contribution: DrawingWorkspaceContribution): Disposable;
  getWorkspaceSnapshot(): DrawingWorkspaceRegistrySnapshot;
  subscribe(listener: () => void): () => void;
}

export interface DrawingCanvasLayerContext {
  snapshot: DrawingWorkspaceSnapshot;
  viewport: DrawingWorkspaceViewport;
  selectedIds: readonly string[];
}

export interface DrawingCanvasLayerContribution {
  id: string;
  apiVersion: 1;
  priority: number;
  active: DrawingSurfaceObservable<boolean>;
  render(context: DrawingCanvasLayerContext): unknown;
}

export type DrawingSurfacePointerEvent =
  | { type: 'pointer-down'; pointerId: number; button: number; clientX: number; clientY: number }
  | { type: 'pointer-move'; pointerId: number; clientX: number; clientY: number }
  | { type: 'pointer-up'; pointerId: number; button: number; clientX: number; clientY: number }
  | { type: 'pointer-cancel'; pointerId: number }
  | { type: 'wheel'; clientX: number; clientY: number; deltaX: number; deltaY: number };

export interface DrawingInteractionResult {
  handled: boolean;
  capture?: boolean;
}

export interface DrawingInteractionToolContribution {
  id: string;
  apiVersion: 1;
  priority: number;
  active: DrawingSurfaceObservable<boolean>;
  handle(event: DrawingSurfacePointerEvent): DrawingInteractionResult;
  dispose?(): void;
}

export function electDrawingWorkspaceContribution(
  candidates: readonly DrawingWorkspaceContributionCandidate[],
): DrawingWorkspaceContribution | null {
  const eligible = candidates
    .filter(({ available, contribution }) => (
      available
      && contribution.apiVersion === DRAWING_SURFACE_API_VERSION
      && contribution.claim.getSnapshot().active
    ))
    .map(({ contribution }) => ({
      contribution,
      claim: contribution.claim.getSnapshot(),
    }));

  eligible.sort((left, right) => (
    right.claim.activationEpoch - left.claim.activationEpoch
    || right.contribution.priority - left.contribution.priority
    || left.contribution.id.localeCompare(right.contribution.id)
  ));
  return eligible[0]?.contribution ?? null;
}
