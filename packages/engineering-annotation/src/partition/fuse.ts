// SPDX-License-Identifier: Apache-2.0

import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { PartitionDraft, PartitionEvidence, ShaftPartitionSegment, ShaftSemanticGroup } from './types';

interface Match { segments: ShaftPartitionSegment[]; cost: number }

export function fuseDocumentRegions(draft: PartitionDraft, regions: EngineeringRegionEvidence[]): PartitionDraft {
  const output = structuredClone(draft);
  for (const region of regions) {
    if (!region.interval) continue;
    const evidenceId = `document:region:${region.id}`;
    const evidence: PartitionEvidence = {
      id: evidenceId, origin: 'document', label: region.name ?? region.id,
      sourceLines: [...region.sourceLines],
    };
    output.evidence.push(evidence);
    const matches = contiguousMatches(output.segments, region);
    const best = matches[0];
    if (!best || best.cost > 0.4) {
      output.diagnostics.push({
        id: `diagnostic:document-unmatched:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_UNMATCHED', message: `Document region ${region.id} could not be reconciled with geometric steps`,
        evidenceIds: [evidenceId],
      });
      continue;
    }
    if (matches[1] && Math.abs(matches[1].cost - best.cost) < 0.025) {
      output.diagnostics.push({
        id: `diagnostic:document-ambiguous:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_AMBIGUOUS', message: `Document region ${region.id} has multiple similarly plausible geometric ranges`,
        evidenceIds: [evidenceId],
      });
    }
    const confidence = Math.max(0.5, Math.min(0.99, 1 - best.cost));
    const group: ShaftSemanticGroup = {
      id: `group:${region.id}`,
      segmentIds: best.segments.map(({ id }) => id),
      semanticType: region.type,
      ...(region.name === undefined ? {} : { name: region.name }),
      evidenceIds: [evidenceId],
    };
    output.semanticGroups.push(group);
    for (const segment of best.segments) {
      if (segment.semanticType !== undefined && segment.semanticType !== region.type) {
        output.diagnostics.push({
          id: `diagnostic:document-semantic-conflict:${region.id}:${segment.id}`, severity: 'warning',
          code: 'DOCUMENT_SEMANTIC_CONFLICT', message: `Document region ${region.id} conflicts with an existing segment classification`,
          segmentIds: [segment.id], evidenceIds: [evidenceId],
        });
        continue;
      }
      segment.semanticType = region.type;
      if (region.name !== undefined) segment.name = region.name;
      segment.semanticConfidence = confidence;
      segment.semanticEvidenceIds = [...new Set([...segment.semanticEvidenceIds, evidenceId])];
      if (region.outerDiameter !== undefined && segment.profile.sampleCount > 0) {
        const actual = segment.profile.maxRadius * 2;
        if (Math.abs(actual - region.outerDiameter) > Math.max(1, region.outerDiameter * 0.05)) {
          const diagnosticId = `diagnostic:diameter:${region.id}:${segment.id}`;
          output.diagnostics.push({
            id: diagnosticId, severity: 'warning', code: 'DOCUMENT_DIAMETER_CONFLICT',
            message: `Document diameter ${region.outerDiameter} differs from geometric envelope ${actual}`,
            segmentIds: [segment.id], evidenceIds: [evidenceId],
          });
          segment.diagnosticIds.push(diagnosticId);
        }
      }
    }
  }
  return output;
}

function contiguousMatches(segments: ShaftPartitionSegment[], region: EngineeringRegionEvidence): Match[] {
  const interval = region.interval!;
  const axisSpan = Math.max(segments.at(-1)!.zEnd - segments[0]!.zStart, 1e-9);
  const targetWidth = Math.max(interval.end - interval.start, axisSpan * 1e-6);
  const targetCenter = (interval.start + interval.end) / 2;
  const output: Match[] = [];
  for (let start = 0; start < segments.length; start += 1) {
    for (let end = start; end < segments.length; end += 1) {
      const selected = segments.slice(start, end + 1);
      const actualStart = selected[0]!.zStart;
      const actualEnd = selected.at(-1)!.zEnd;
      const actualWidth = actualEnd - actualStart;
      const endpointCost = (Math.abs(actualStart - interval.start) + Math.abs(actualEnd - interval.end)) / axisSpan;
      const centerCost = Math.abs((actualStart + actualEnd) / 2 - targetCenter) / axisSpan;
      const widthCost = Math.abs(actualWidth - targetWidth) / Math.max(targetWidth, axisSpan * 0.05);
      let diameterCost = 0;
      if (region.outerDiameter !== undefined) {
        const radii = selected.filter(({ profile }) => profile.sampleCount > 0).map(({ profile }) => profile.maxRadius * 2);
        if (radii.length > 0) diameterCost = Math.min(1, Math.abs(Math.max(...radii) - region.outerDiameter) / Math.max(region.outerDiameter, 1));
      }
      output.push({ segments: selected, cost: endpointCost * 0.5 + centerCost * 0.15 + Math.min(widthCost, 2) * 0.2 + diameterCost * 0.15 });
    }
  }
  return output.sort((a, b) => a.cost - b.cost || a.segments.length - b.segments.length);
}
