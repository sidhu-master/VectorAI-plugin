// SPDX-License-Identifier: Apache-2.0

import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { PartitionDraft, PartitionEvidence, ShaftPartitionSegment, ShaftSemanticGroup } from './types';

interface Match {
  segments: ShaftPartitionSegment[];
  cost: number;
  widthError: number;
  diameterError?: number;
}

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
    if (!best) continue;
    const matched = best.cost <= 0.4;
    const ambiguous = matches[1] !== undefined && Math.abs(matches[1].cost - best.cost) < 0.01;
    if (!matched) {
      output.diagnostics.push({
        id: `diagnostic:document-unmatched:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_UNMATCHED', message: `Document region ${region.id} could not be reconciled with geometric steps`,
        evidenceIds: [evidenceId],
      });
    }
    if (ambiguous) {
      output.diagnostics.push({
        id: `diagnostic:document-ambiguous:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_AMBIGUOUS', message: `Document region ${region.id} has multiple similarly plausible geometric ranges`,
        evidenceIds: [evidenceId],
      });
    }
    const confidence = Math.max(0.5, Math.min(0.99, 1 - best.cost));
    const reliableMatch = matched && !ambiguous;
    const relatedSegments = reliableMatch
      ? best.segments
      : overlappingSegments(output.segments, region.interval, output.axis.zMax - output.axis.zMin);
    const matchedRange = {
      zStart: best.segments[0]!.zStart,
      zEnd: best.segments.at(-1)!.zEnd,
    };
    const rangeTolerance = Math.max((output.axis.zMax - output.axis.zMin) * 1e-3, 1e-6);
    const sourceAligned = Math.abs(matchedRange.zStart - region.interval.start) <= rangeTolerance
      && Math.abs(matchedRange.zEnd - region.interval.end) <= rangeTolerance;
    const geometryReconciled = reliableMatch && !sourceAligned
      && best.widthError <= 0.03
      && best.diameterError !== undefined
      && best.diameterError <= 0.03;
    const range = geometryReconciled ? matchedRange : {
      zStart: region.interval.start,
      zEnd: region.interval.end,
    };
    if (geometryReconciled) {
      output.diagnostics.push({
        id: `diagnostic:document-reconciled:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_RECONCILED',
        message: `Document region ${region.id} was reconciled from ${formatRange(region.interval)} to geometric range ${formatRange(matchedRange)}`,
        segmentIds: relatedSegments.map(({ id }) => id), evidenceIds: [evidenceId],
      });
    }
    const group: ShaftSemanticGroup = {
      id: `group:${region.id}`,
      segmentIds: relatedSegments.map(({ id }) => id),
      range,
      semanticType: region.type,
      ...(region.name === undefined ? {} : { name: region.name }),
      evidenceIds: [evidenceId],
    };
    output.semanticGroups.push(group);
    if (!reliableMatch) continue;
    for (const segment of relatedSegments) {
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
      const endpointError = (Math.abs(actualStart - interval.start) + Math.abs(actualEnd - interval.end)) / axisSpan;
      const centerError = Math.abs((actualStart + actualEnd) / 2 - targetCenter) / axisSpan;
      const widthError = Math.abs(actualWidth - targetWidth) / Math.max(targetWidth, axisSpan * 0.05);
      let diameterError: number | undefined;
      if (region.outerDiameter !== undefined) {
        const profiled = selected.filter(({ profile }) => profile.sampleCount > 0);
        const profiledWidth = profiled.reduce((sum, segment) => sum + segment.zEnd - segment.zStart, 0);
        if (profiledWidth > 0) {
          const measuredError = profiled.reduce((sum, segment) => (
            sum + (segment.zEnd - segment.zStart) * Math.abs(segment.profile.maxRadius * 2 - region.outerDiameter!)
          ), 0) / Math.max(region.outerDiameter, 1);
          const unprofiledWidth = Math.max(0, actualWidth - profiledWidth);
          diameterError = Math.min(1, (measuredError + unprofiledWidth * 0.25) / Math.max(actualWidth, 1e-9));
        }
      }
      const diameterCost = diameterError ?? 0.25;
      output.push({
        segments: selected,
        widthError,
        ...(diameterError === undefined ? {} : { diameterError }),
        cost: Math.min(widthError, 2) * 0.3 + diameterCost * 0.6 + centerError * 0.04 + endpointError * 0.06,
      });
    }
  }
  return output.sort((a, b) => a.cost - b.cost || a.segments.length - b.segments.length);
}

function overlappingSegments(
  segments: ShaftPartitionSegment[],
  interval: { start: number; end: number },
  axisSpan: number,
): ShaftPartitionSegment[] {
  const tolerance = Math.max(axisSpan * 1e-9, 1e-9);
  const overlapping = segments.filter(({ zStart, zEnd }) => (
    zEnd > interval.start + tolerance && zStart < interval.end - tolerance
  ));
  return overlapping.length > 0 ? overlapping : [nearestSegment(segments, (interval.start + interval.end) / 2)];
}

function nearestSegment(segments: ShaftPartitionSegment[], z: number): ShaftPartitionSegment {
  return [...segments].sort((left, right) => (
    distanceToSegment(left, z) - distanceToSegment(right, z)
  ))[0]!;
}

function distanceToSegment(segment: ShaftPartitionSegment, z: number): number {
  return z < segment.zStart ? segment.zStart - z : z > segment.zEnd ? z - segment.zEnd : 0;
}

function formatRange(range: { start?: number; end?: number; zStart?: number; zEnd?: number }): string {
  const start = range.start ?? range.zStart;
  const end = range.end ?? range.zEnd;
  return `${Number(start?.toFixed(6))}–${Number(end?.toFixed(6))}`;
}
