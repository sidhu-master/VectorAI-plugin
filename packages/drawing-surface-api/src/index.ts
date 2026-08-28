// SPDX-License-Identifier: Apache-2.0

import type {
  DeepReadonly,
  DrawingSurfaceObservable,
  DrawingSurfaceRuntime,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';

export type {
  DeepReadonly,
  DrawingSurfaceActions,
  DrawingSurfaceObservable,
  DrawingSurfacePresentationSnapshot,
  DrawingSurfaceRuntime,
} from '@vectorai/drawing-workspace';

export const DRAWING_SURFACE_API_VERSION = 1 as const;
export const DRAWING_SURFACE_REFRESH_EVENT = 'vectorai:drawing-surface-refresh' as const;

export interface DrawingSurfaceRefreshDetail { sessionId: string }

export interface Disposable {
  dispose(): void;
}

export type DrawingLayerCategory = 'engineering' | 'cad' | 'assistant' | 'interaction';
export type DrawingLayerIcon = 'partition' | 'angle' | 'dimension' | 'tolerance' | 'cad' | 'assistant';

export interface DrawingLayerDefinition {
  id: string;
  label: string;
  category: DrawingLayerCategory;
  icon?: DrawingLayerIcon;
  order: number;
  defaultVisible: boolean;
}

export interface DrawingLayerRegistry {
  registerLayer(definition: DrawingLayerDefinition): Disposable;
  getLayers(): readonly DrawingLayerDefinition[];
  subscribeLayers(listener: () => void): () => void;
}

export interface DrawingWorkspaceClaim {
  active: boolean;
  activationEpoch: number;
}

export interface DrawingWorkspaceClaimSource {
  observe(sessionId: string): DrawingSurfaceObservable<DrawingWorkspaceClaim>;
}

export interface DrawingSurfaceComponentProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
  layerRegistry?: DrawingLayerRegistry;
}

export type DrawingSurfaceComponent<Props = DrawingSurfaceComponentProps> = (
  props: Props,
) => unknown;

export interface DrawingWorkspaceContribution<Props = DrawingSurfaceComponentProps> {
  id: string;
  apiVersion: 1;
  priority: number;
  claimSource: DrawingWorkspaceClaimSource;
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

export interface DrawingSurfaceRegistry extends DrawingLayerRegistry {
  registerWorkspace(contribution: DrawingWorkspaceContribution): Disposable;
  getWorkspaceSnapshot(sessionId: string): DrawingWorkspaceRegistrySnapshot;
  getWorkspaceContribution(id: string): DrawingWorkspaceContribution | null;
  subscribe(sessionId: string, listener: () => void): () => void;
  disposeSession(sessionId: string): void;
}

export interface DrawingCanvasLayerContext {
  snapshot: DeepReadonly<DrawingWorkspaceSnapshot>;
  viewport: DeepReadonly<DrawingWorkspaceViewport>;
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
  sessionId: string,
  candidates: readonly DrawingWorkspaceContributionCandidate[],
): DrawingWorkspaceContribution | null {
  const eligible = candidates
    .filter(({ available, contribution }) => (
      available && contribution.apiVersion === DRAWING_SURFACE_API_VERSION
    ))
    .map(({ contribution }) => ({
      contribution,
      claim: contribution.claimSource.observe(sessionId).getSnapshot(),
    }))
    .filter(({ claim }) => claim.active);

  eligible.sort((left, right) => (
    right.claim.activationEpoch - left.claim.activationEpoch
    || right.contribution.priority - left.contribution.priority
    || left.contribution.id.localeCompare(right.contribution.id)
  ));
  return eligible[0]?.contribution ?? null;
}
