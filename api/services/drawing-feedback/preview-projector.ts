import type {
  DrawingDocument,
  EvidenceId,
  GeometryId,
  PerceptionPreviewNode,
} from '../../../src/drawing/index.js';

export function feedbackPreviewNodeId(slotId: string): GeometryId {
  return `feedback_preview_${slotId}` as GeometryId;
}

export function projectFeedbackTransactionPreview(input: {
  document: DrawingDocument;
  affectedNodeIds: string[];
  slotId: string;
  confidence: number;
  evidenceRefs: string[];
}): {
  nodes: PerceptionPreviewNode[];
  labelsByNodeId: Record<string, string>;
} {
  const affected = new Set(input.affectedNodeIds);
  const node = [...input.document.geometry, ...input.document.annotations]
    .find((candidate) => affected.has(candidate.id));
  if (!node) return { nodes: [], labelsByNodeId: {} };

  const id = feedbackPreviewNodeId(input.slotId);
  const projected = {
    ...structuredClone(node),
    id,
    quality: {
      ...structuredClone(node.quality),
      status: 'candidate' as const,
      confidence: input.confidence,
      evidenceRefs: input.evidenceRefs.map((ref) => ref as EvidenceId),
    },
  } as PerceptionPreviewNode;
  return {
    nodes: [projected],
    labelsByNodeId: { [id]: '模型提案 1' },
  };
}
