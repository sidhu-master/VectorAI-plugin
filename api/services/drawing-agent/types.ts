import type {
  Actor,
  DrawingCommit,
  DrawingDocument,
  DrawingId,
  DrawingInspectResult,
  DrawingQueryResult,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingDocumentSummary } from '../../../src/contracts/drawing-application.js';
import type {
  AgentDecision,
  DrawingAgentPlan,
} from '../../../src/contracts/drawing-agent.js';
import type { SourceArtifactReference } from '../source-artifacts/types.js';
import type { GroundingSnapshot } from '../drawing-vision/grounding-renderer.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import type { SpatialEditMode } from '../../../src/contracts/drawing-spatial-region.js';

export type DrawingToolCapability =
  | 'query_entities'
  | 'inspect_entity'
  | 'preview_transaction'
  | 'commit_transaction'
  | 'verify_goal';

export interface DrawingToolDefinition {
  capability: DrawingToolCapability;
  version: '1.0.0';
  access: 'read' | 'write';
  caller: 'model' | 'runtime';
  timeoutMs: number;
}

export interface DrawingToolContext {
  runId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  actor: Actor;
  goalId?: string;
}

export type DrawingToolStatus =
  | 'succeeded'
  | 'already_satisfied'
  | 'not_found'
  | 'stale'
  | 'rejected';

export type DrawingToolOutcome =
  | { kind: 'query'; count: number; truncated: boolean }
  | { kind: 'inspect'; found: boolean; relationCount: number; featureCount: number }
  | {
      kind: 'preview';
      candidate: boolean;
      validationValid: boolean;
      goalSatisfied: boolean;
    }
  | { kind: 'commit'; committed: boolean; commitId?: string }
  | { kind: 'verification'; satisfied: boolean; assertionCount: number }
  | { kind: 'error'; codes: string[] };

export interface DrawingToolReceipt {
  toolCallId: string;
  capability: DrawingToolCapability;
  version: '1.0.0';
  access: 'read' | 'write';
  inputDigest: string;
  revisionBefore: RevisionId;
  revisionAfter: RevisionId;
  affectedNodeIds: string[];
  outcome: DrawingToolOutcome;
  durationMs: number;
  status: DrawingToolStatus;
  retry: { allowed: boolean; action?: 'requery' | 'repair' | 'replan' | 'pause' };
}

/** Runtime-only reference. This object is never part of a public progress receipt. */
export interface PreparedDrawingTransaction {
  handle: string;
  runId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  episodeId?: string;
  previewVersionId?: string;
  regionId?: string;
  selectionVersionId?: string;
  strategy?: SpatialEditMode;
  lineage?: SpatialPreviewLineage[];
}

export interface SpatialPreviewLineage {
  sourceNodeId: string;
  fragmentId: string;
  sourceRange: readonly [number, number];
  role: 'target' | 'protected';
}

export interface SpatialPreviewContext {
  episodeId: string;
  previewVersionId: string;
  regionId: string;
  selectionVersionId: string;
  strategy: SpatialEditMode;
  lineage: SpatialPreviewLineage[];
}

export interface DrawingToolExecution {
  receipt: DrawingToolReceipt;
  output?: DrawingQueryResult | DrawingInspectResult | null;
  prepared?: PreparedDrawingTransaction;
  /** Runtime-only candidate document used for source-space feedback before commit. */
  previewDocument?: DrawingDocument;
  commit?: DrawingCommit;
}

export interface DrawingToolInvocation {
  capability: DrawingToolCapability;
  caller: 'model' | 'runtime';
  toolCallId: string;
  context: DrawingToolContext;
  input: unknown;
}

export interface DrawingPlannerInput {
  objective: string;
  instruction?: string;
  drawingId: DrawingId;
  revision: RevisionId;
  summary: DrawingDocumentSummary;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
}

export interface DrawingToolEvidence {
  receipt: DrawingToolReceipt;
  output?: DrawingQueryResult | DrawingInspectResult | null;
}

export interface DrawingVisionContext {
  /** 当前图纸的渲染快照 + 确定性 nodeId↔图像区域接地映射 */
  snapshot: GroundingSnapshot;
  /** 用户当前选中的节点 id(用于 selection-scoped 指令) */
  selection: string[];
  /** Revision-bound server overview/detail observation for semantic editing. */
  observation?: VisualObservation;
}

export interface DrawingDecisionInput {
  plan: DrawingAgentPlan;
  currentWorkflowNodeId: string;
  revision: RevisionId;
  pendingInstructions: string[];
  recentReceipts: DrawingToolReceipt[];
  toolEvidence: DrawingToolEvidence[];
  attempt: number;
  /** 上一次返回违反协议时的精确错误；仅在有界纠错重试中提供。 */
  protocolFeedback?: string;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
  /** 视觉接地上下文:提供当前图纸渲染图 + nodeId 映射 + 选区 */
  vision?: DrawingVisionContext;
}

export type DrawingModelRole =
  | 'planner'
  | 'decision'
  | 'acceptance'
  | 'grounding'
  | 'design'
  | 'verification';

export interface DrawingPlannerModelAdapter {
  plan(input: DrawingPlannerInput): Promise<DrawingAgentPlan>;
}

export interface DrawingDecisionModelAdapter {
  decide(input: DrawingDecisionInput): Promise<AgentDecision>;
}

/** 视觉验收:对渲染出的当前图纸做"目标是否已满足"的判定 */
export interface DrawingAcceptanceInput {
  goal: string;
  modelName: string;
  /** 当前图纸渲染图(data URL) */
  image: string;
  width: number;
  height: number;
  signal?: AbortSignal;
  deadlineAt?: number;
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
}

export interface DrawingAcceptanceResult {
  satisfied: boolean;
  reason: string;
}

export interface DrawingAcceptanceModelAdapter {
  accept(input: DrawingAcceptanceInput): Promise<DrawingAcceptanceResult>;
}

export interface DrawingPreviewDefect {
  code: string;
  message: string;
  nodeIds: string[];
  repairHint?: string;
}

export interface PreviewReviewEvidence {
  revision: RevisionId;
  previewHandle: string;
  transactionDigest: string;
  status: 'satisfied' | 'needs_revision' | 'unavailable';
  reason: string;
  defects: DrawingPreviewDefect[];
  reviewedAt: number;
}

export interface DrawingPreviewVerificationInput {
  goal: string;
  previewDocument: DrawingDocument;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
  beforeObservation?: VisualObservation;
  previewObservation?: VisualObservation;
  deterministicDiagnostics?: import('../drawing-diagnostics/types.js').DrawingDiagnostic[];
  /** Exact candidate identity plus the primary model's declared edit contract; context, not proof. */
  candidateContext?: {
    previewHandle: string;
    transactionDigest: string;
    tool: string;
    summary: string;
    intent?: string;
    targetNodeIds: string[];
    operationKinds: string[];
    preserveNodeIds: string[];
  };
  /** Feedback from a rejected verifier response when the runtime performs one bounded retry. */
  protocolFeedback?: string;
  readImage?: (handle: string) => string | null;
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
}

export interface DrawingPreviewVerificationResult {
  satisfied: boolean;
  reason: string;
  defects: DrawingPreviewDefect[];
}

export interface DrawingPreviewVerificationModelAdapter {
  verify(input: DrawingPreviewVerificationInput): Promise<DrawingPreviewVerificationResult>;
}

export interface DrawingAgentModelProfile {
  planner: string;
  decision: string;
  repair: string;
  reviewer: string;
}

export interface StartDrawingAgentRunInput {
  runId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  goal: string;
  modelProfile: DrawingAgentModelProfile;
  selectedIds?: string[];
  stableRules?: string[];
  source?: SourceArtifactReference;
  /** Images are ordinary context unless the caller explicitly marks one as an editable drawing source. */
  attachmentPurpose?: DrawingAttachmentPurpose;
  /** 当前画布视口(世界->屏幕),用于后端渲染"用户所见"的图纸快照 */
  viewport?: { scale: number; offsetX: number; offsetY: number; width: number; height: number };
  /**
   * 显式工作流（分区标注流程）：
   * - 'partition'：结合补充信息对当前图纸做 AI 分区（产出 feature 分区，等待用户预览编辑）；
   * - 'partitioned-annotation'：按用户确认后的分区生成自动标注。
   * 缺省走模型主导的编辑/重建循环。
   */
  workflow?: DrawingAgentWorkflow;
}

export type DrawingAgentWorkflow = 'partition' | 'partitioned-annotation';
export type DrawingAttachmentPurpose = 'reference' | 'drawing-source';
