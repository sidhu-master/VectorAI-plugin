import type { AnnotationNode, GeometryNode } from '../document/types';

export type PerceptionPreviewAction =
  | 'observe'
  | 'refine'
  | 'retype'
  | 'merge'
  | 'split'
  | 'reject'
  | 'promote'
  | 'preview'
  | 'revise';

export type PerceptionPreviewNode = GeometryNode | AnnotationNode;

export type PerceptionPreviewStage =
  | 'outline'
  | 'detail'
  | 'annotation'
  | 'reconciliation'
  | 'edit-preview';

export interface PerceptionPreviewDelta {
  runId: string;
  sequence: number;
  action: PerceptionPreviewAction;
  slotIds: string[];
  upserts: PerceptionPreviewNode[];
  removeIds: string[];
  hideCommittedIds?: string[];
  showCommittedIds?: string[];
  labelsByNodeId?: Record<string, string>;
  source: {
    page: number;
    viewId: string;
    regionId?: string;
    stage: PerceptionPreviewStage;
  };
}

export interface PerceptionPreviewState {
  runId: string | null;
  lastSequence: number;
  nodes: Record<string, PerceptionPreviewNode>;
  labelsByNodeId: Record<string, string>;
  /**
   * 每个预览节点对应的感知阶段（outline 轮廓 / detail 细节 / annotation 标注）。
   * 用于前端按“轮廓 → 细节”分层呈现多轮绘制过程。
   */
  stageByNodeId?: Record<string, PerceptionPreviewStage>;
  hiddenCommittedIds?: string[];
}
