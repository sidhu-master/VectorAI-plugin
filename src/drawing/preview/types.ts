import type {
  AnnotationNode,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../document/types';

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

export interface SpatialRegionPreviewOverlay {
  id: string;
  revision: RevisionId;
  previewVersionId: string;
  attempt: number;
  status: 'proposed' | 'tracing' | 'accepted' | 'rejected';
  label: string;
  contours: Vec2[][];
  holes: Vec2[][];
  anchors: Array<{
    id: string;
    role: string;
    point: Vec2;
    confidence: number;
    snapStatus: 'pending' | 'snapped' | 'missed';
    snappedPoint?: Vec2;
  }>;
  paths: Array<{
    id: string;
    nodeId: string;
    role: 'selected' | 'protected';
    order: number;
    points: Vec2[];
  }>;
  issues: Array<{ code: string; message: string }>;
  confidence: number;
}

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
  /** `null` explicitly clears the current region overlay. Raster masks remain server-side. */
  regionOverlay?: SpatialRegionPreviewOverlay | null;
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
  activeOverlay: SpatialRegionPreviewOverlay | null;
  previewVersionId: string | null;
  /**
   * 每个预览节点对应的感知阶段（outline 轮廓 / detail 细节 / annotation 标注）。
   * 用于前端按“轮廓 → 细节”分层呈现多轮绘制过程。
   */
  stageByNodeId?: Record<string, PerceptionPreviewStage>;
  hiddenCommittedIds?: string[];
}
