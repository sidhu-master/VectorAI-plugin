// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, PartitionEvidence, ShaftDimensionRole, ShaftSemanticGroup } from './types';

export interface SegmentSemanticProposal {
  segmentIds: string[];
  semanticType: string;
  dimensionRole?: ShaftDimensionRole;
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
  let applied = 0;
  for (const [index, proposal] of proposals.entries()) {
    if (proposal.segmentIds.length === 0 || !proposal.semanticType.trim() || proposal.semanticType.length > 80
      || proposal.dimensionRole !== undefined && !DIMENSION_ROLES.has(proposal.dimensionRole)
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
    }
    const expectedVisual = new Set(proposal.segmentIds.map((id) => `observation:${id}`));
    const hasCompleteVisualEvidence = [...expectedVisual].every((id) => proposal.visualEvidenceIds.includes(id));
    if (proposal.confidence < 0.8 || !hasCompleteVisualEvidence || isGenericProposal(proposal)) continue;
    const proposedRange = {
      zStart: Math.min(...proposal.segmentIds.map((id) => known.get(id)!.zStart)),
      zEnd: Math.max(...proposal.segmentIds.map((id) => known.get(id)!.zEnd)),
    };
    const range = singleUncoveredRange(output, proposedRange);
    if (range === undefined) continue;
    for (const id of proposal.segmentIds) {
      const segment = known.get(id)!;
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
      ...(proposal.dimensionRole === undefined ? {} : { dimensionRole: proposal.dimensionRole }),
      range,
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
    applied += 1;
  }
  return { draft: output, applied };
}

function isGenericProposal(proposal: SegmentSemanticProposal): boolean {
  const value = `${proposal.semanticType} ${proposal.name ?? ''}`.toLowerCase();
  return !SUPPORTED_SEMANTIC_TYPES.has(proposal.semanticType.toLowerCase())
    || /(?:work[-_ ]?area|working[-_ ]?area|工作区域|工作区|普通轴段|常规区域|shaft[-_ ]?region)/u.test(value);
}

const SUPPORTED_SEMANTIC_TYPES = new Set([
  'gear', 'spline', 'bearing-seat', 'shaft-seat', 'seal-seat', 'oil-seal-seat',
  'coupling-seat', 'thread', 'keyway', 'shoulder',
]);
const DIMENSION_ROLES = new Set<ShaftDimensionRole>([
  'functional-feature', 'process-datum', 'transition', 'ordinary',
]);

function singleUncoveredRange(
  draft: PartitionDraft,
  proposed: { zStart: number; zEnd: number },
): { zStart: number; zEnd: number } | undefined {
  const segmentById = new Map(draft.segments.map((segment) => [segment.id, segment]));
  const occupied = draft.semanticGroups.flatMap((group) => {
    if (group.range !== undefined) return [group.range];
    const related = group.segmentIds.map((id) => segmentById.get(id)).filter((segment) => segment !== undefined);
    return related.length === 0 ? [] : [{
      zStart: Math.min(...related.map(({ zStart }) => zStart)),
      zEnd: Math.max(...related.map(({ zEnd }) => zEnd)),
    }];
  });
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-9, 1e-9);
  let available = [proposed];
  for (const range of occupied) {
    available = available.flatMap((candidate) => {
      if (range.zEnd <= candidate.zStart + tolerance || range.zStart >= candidate.zEnd - tolerance) return [candidate];
      const pieces = [
        { zStart: candidate.zStart, zEnd: Math.min(candidate.zEnd, range.zStart) },
        { zStart: Math.max(candidate.zStart, range.zEnd), zEnd: candidate.zEnd },
      ];
      return pieces.filter(({ zStart, zEnd }) => zEnd - zStart > tolerance);
    });
  }
  return available.length === 1 ? available[0] : undefined;
}
