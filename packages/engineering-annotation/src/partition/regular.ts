// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, ShaftPartitionSegment } from './types';

interface SegmentRun {
  segments: ShaftPartitionSegment[];
  startIndex: number;
  endIndex: number;
}

export function inferRegularShaftRegions(draft: PartitionDraft): PartitionDraft {
  const output = structuredClone(draft);
  for (const run of unclassifiedRuns(output)) {
    if (!isBoundedByTrustedDocumentRegions(output, run)
      || !hasAcceptedBoundarySteps(output, run)
      || !hasStableGeometry(run)) continue;
    const zStart = run.segments[0]!.zStart;
    const zEnd = run.segments.at(-1)!.zEnd;
    const evidenceId = `fused:regular:${canonical(zStart)}-${canonical(zEnd)}`;
    output.evidence.push({
      id: evidenceId,
      origin: 'fused',
      label: `Post-review regular shaft span bounded by trusted document regions at ${canonical(zStart)}–${canonical(zEnd)}`,
      geometryNodeIds: [...new Set(run.segments.flatMap(({ geometryNodeIds }) => geometryNodeIds))],
    });
    output.semanticGroups.push({
      id: `group:${evidenceId}`,
      segmentIds: run.segments.map(({ id }) => id),
      range: { zStart, zEnd },
      semanticType: 'regular-shaft',
      name: '常规区域',
      evidenceIds: [evidenceId],
    });
    for (const segment of run.segments) {
      segment.semanticType = 'regular-shaft';
      segment.name = '常规区域';
      segment.semanticConfidence = Math.min(0.99, segment.boundaryConfidence);
      segment.semanticEvidenceIds.push(evidenceId);
    }
  }
  return output;
}

function unclassifiedRuns(draft: PartitionDraft): SegmentRun[] {
  const runs: SegmentRun[] = [];
  for (const [index, segment] of draft.segments.entries()) {
    if (segment.semanticType !== undefined) continue;
    const previous = runs.at(-1);
    if (previous && previous.endIndex === index - 1) {
      previous.segments.push(segment);
      previous.endIndex = index;
    } else {
      runs.push({ segments: [segment], startIndex: index, endIndex: index });
    }
  }
  return runs;
}

function isBoundedByTrustedDocumentRegions(draft: PartitionDraft, run: SegmentRun): boolean {
  const left = draft.segments[run.startIndex - 1];
  const right = draft.segments[run.endIndex + 1];
  if (!left || !right) return false;
  const leftGroup = draft.semanticGroups.find(({ segmentIds }) => segmentIds.includes(left.id));
  const rightGroup = draft.semanticGroups.find(({ segmentIds }) => segmentIds.includes(right.id));
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-6, 1e-6);
  return leftGroup !== undefined && rightGroup !== undefined
    && leftGroup.range !== undefined && rightGroup.range !== undefined
    && leftGroup.range.zEnd <= run.segments[0]!.zStart + tolerance
    && rightGroup.range.zStart >= run.segments.at(-1)!.zEnd - tolerance
    && trustedDocumentGroup(draft, leftGroup.evidenceIds)
    && trustedDocumentGroup(draft, rightGroup.evidenceIds);
}

function trustedDocumentGroup(draft: PartitionDraft, evidenceIds: string[]): boolean {
  const hasDocumentEvidence = evidenceIds.some((id) => draft.evidence.find((item) => item.id === id)?.origin === 'document');
  if (!hasDocumentEvidence) return false;
  return !draft.diagnostics.some((diagnostic) => (
    (diagnostic.code === 'DOCUMENT_REGION_AMBIGUOUS' || diagnostic.code === 'DOCUMENT_REGION_UNMATCHED')
      && diagnostic.evidenceIds?.some((id) => evidenceIds.includes(id))
  ));
}

function hasAcceptedBoundarySteps(draft: PartitionDraft, run: SegmentRun): boolean {
  if (draft.stepCandidates.length === 0) return true;
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-6, 1e-6);
  const accepted = (z: number) => draft.stepCandidates.some((candidate) => candidate.accepted && Math.abs(candidate.z - z) <= tolerance);
  return accepted(run.segments[0]!.zStart) && accepted(run.segments.at(-1)!.zEnd);
}

function hasStableGeometry(run: SegmentRun): boolean {
  const samples = run.segments.filter(({ profile }) => profile.sampleCount > 0);
  if (samples.length !== run.segments.length || run.segments.length < 2) return false;
  return samples.every(({ boundaryConfidence, diagnosticIds }) => (
    boundaryConfidence >= 0.75 && diagnosticIds.length === 0
  ));
}

function canonical(value: number): string {
  return Number(value.toFixed(6)).toString();
}
