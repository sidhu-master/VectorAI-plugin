import type { AnnotationNode, GeometryNode } from '../document/types';

export type PerceptionPreviewAction =
  | 'observe'
  | 'refine'
  | 'retype'
  | 'merge'
  | 'split'
  | 'reject'
  | 'promote';

export type PerceptionPreviewNode = GeometryNode | AnnotationNode;

export interface PerceptionPreviewDelta {
  runId: string;
  sequence: number;
  action: PerceptionPreviewAction;
  slotIds: string[];
  upserts: PerceptionPreviewNode[];
  removeIds: string[];
  source: {
    page: number;
    viewId: string;
    regionId?: string;
    stage: 'outline' | 'detail' | 'annotation' | 'reconciliation';
  };
}

export interface PerceptionPreviewState {
  runId: string | null;
  lastSequence: number;
  nodes: Record<string, PerceptionPreviewNode>;
}
