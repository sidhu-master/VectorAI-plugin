// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, PartitionEvidence, ShaftSemanticGroup } from './types';

export interface SegmentSemanticProposal {
  segmentIds: string[];
  semanticType: string;
  name?: string;
  confidence: number;
  reason: string;
  visualEvidenceIds: string[];
}

export function applySemanticProposals(
  draft: PartitionDraft,
  proposals: SegmentSemanticProposal[],
  options: { allowedSegmentIds?: string[]; allowedVisualEvidenceIds?: string[] } = {},
): { draft: PartitionDraft; applied: number } {
  if (proposals.length > 64) throw new Error('AI_SEMANTIC_PROPOSAL_LIMIT');
  const output = structuredClone(draft);
  const known = new Map(output.segments.map((segment) => [segment.id, segment]));
  const allowed = options.allowedSegmentIds === undefined ? undefined : new Set(options.allowedSegmentIds);
  const allowedVisual = options.allowedVisualEvidenceIds === undefined ? undefined : new Set(options.allowedVisualEvidenceIds);
  const assigned = new Set<string>();
  for (const [index, proposal] of proposals.entries()) {
    if (proposal.segmentIds.length === 0 || !proposal.semanticType.trim() || proposal.semanticType.length > 80
      || proposal.name !== undefined && proposal.name.length > 120
      || !Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1
      || !proposal.reason.trim() || proposal.reason.length > 500) throw new Error('AI_SEMANTIC_PROPOSAL_INVALID');
    if (/\b(?:x|y|z|radius|diameter|boundary)\s*[=:]\s*-?\d/i.test(proposal.reason)) throw new Error('AI_SEMANTIC_REASON_COORDINATES');
    const indices = proposal.segmentIds.map((id) => output.segments.findIndex((segment) => segment.id === id)).sort((a, b) => a - b);
    if (indices.some((value, index) => index > 0 && value !== indices[index - 1]! + 1)) throw new Error('AI_SEGMENT_RANGE_NONCONTIGUOUS');
    if (proposal.visualEvidenceIds.some((id) => allowedVisual !== undefined && !allowedVisual.has(id))) throw new Error('AI_VISUAL_EVIDENCE_UNKNOWN');
    for (const id of proposal.segmentIds) {
      const segment = known.get(id);
      if (!segment) throw new Error('AI_SEGMENT_ID_UNKNOWN');
      if (allowed !== undefined && !allowed.has(id)) throw new Error('AI_SEGMENT_NOT_ALLOWED');
      if (segment.semanticType !== undefined) throw new Error('AI_SEGMENT_ALREADY_CLASSIFIED');
      if (assigned.has(id)) throw new Error('AI_SEGMENT_DUPLICATE_ASSIGNMENT');
      assigned.add(id);
    }
    const evidenceId = `ai:semantic:${index}:${proposal.segmentIds.join('+')}`;
    const evidence: PartitionEvidence = { id: evidenceId, origin: 'ai', label: proposal.reason };
    output.evidence.push(evidence);
    const group: ShaftSemanticGroup = {
      id: `group:${evidenceId}`,
      segmentIds: [...proposal.segmentIds], semanticType: proposal.semanticType,
      ...(proposal.name === undefined ? {} : { name: proposal.name }),
      evidenceIds: [evidenceId, ...proposal.visualEvidenceIds],
    };
    // Visual references describe the bounded observation rather than a domain
    // evidence row, so only the AI decision itself is used for invariant refs.
    group.evidenceIds = [evidenceId];
    output.semanticGroups.push(group);
    for (const id of proposal.segmentIds) {
      const segment = known.get(id)!;
      segment.semanticType = proposal.semanticType;
      if (proposal.name !== undefined) segment.name = proposal.name;
      segment.semanticConfidence = proposal.confidence;
      segment.semanticEvidenceIds.push(evidenceId);
    }
  }
  return { draft: output, applied: proposals.length };
}
