// SPDX-License-Identifier: Apache-2.0

import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { PartitionDraft, PartitionEvidence, ShaftPartitionSegment, ShaftSemanticGroup } from './types';

interface Match {
  segments: ShaftPartitionSegment[];
  stationError: number;
  widthError: number;
  diameterError?: number;
  topologyError: number;
  documentIdentityError: number;
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
    const ambiguous = matches[1] !== undefined && equivalentMatch(matches[0]!, matches[1]!);
    const axialSegments = overlappingSegments(output.segments, region.interval, output.axis.zMax - output.axis.zMin);
    const rangeTolerance = Math.max((output.axis.zMax - output.axis.zMin) * 1e-6, 1e-6);
    const documentBoundariesAlignWithSteps = Math.abs(axialSegments[0]!.zStart - region.interval.start) <= rangeTolerance
      && Math.abs(axialSegments.at(-1)!.zEnd - region.interval.end) <= rangeTolerance;
    const documentRangeWithinGeometryResolution = boundariesDifferOnlyBySampling(
      region.interval,
      {
        start: best.segments[0]!.zStart,
        end: best.segments.at(-1)!.zEnd,
      },
      output.axis.zMax - output.axis.zMin,
    );
    const geometryReconciled = !documentBoundariesAlignWithSteps
      && !documentRangeWithinGeometryResolution
      && best.topologyError === 0
      && best.documentIdentityError === 0
      && best.widthError <= 0.03
      && best.diameterError !== undefined
      && best.diameterError <= 0.03
      && !ambiguous;
    const conflict = hasCriticalConflict(best) && !geometryReconciled;
    const matched = (!hasCriticalConflict(best) || geometryReconciled) && !ambiguous;
    if (conflict) {
      output.diagnostics.push({
        id: `diagnostic:document-conflict:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_CONFLICT', message: `Document region ${region.id} conflicts with geometric station, width, or diameter evidence`,
        segmentIds: best.segments.map(({ id }) => id), evidenceIds: [evidenceId, ...best.segments.flatMap(({ boundaryEvidenceIds }) => boundaryEvidenceIds)],
      });
    }
    if (ambiguous) {
      output.diagnostics.push({
        id: `diagnostic:document-ambiguous:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_AMBIGUOUS', message: `Document region ${region.id} has multiple similarly plausible geometric ranges`,
        evidenceIds: [evidenceId],
      });
    }
    const confidence = matched ? Math.max(0.5, 1 - Math.max(best.stationError, best.widthError, best.diameterError ?? 0)) : 0.5;
    const reliableMatch = matched;
    // A document interval is an axial anchor. When no reliable geometric match
    // exists, keep it attached to overlapping geometry instead of borrowing a
    // remote segment that merely has a similar diameter.
    const relatedSegments = matched ? best.segments : axialSegments;
    const matchedRange = {
      zStart: best.segments[0]!.zStart,
      zEnd: best.segments.at(-1)!.zEnd,
    };
    const documentRange = {
      zStart: region.interval.start,
      zEnd: region.interval.end,
    };
    const range = geometryReconciled ? matchedRange : documentRange;
    if (geometryReconciled) {
      output.diagnostics.push({
        id: `diagnostic:document-reconciled:${region.id}`, severity: 'warning',
        code: 'DOCUMENT_REGION_RECONCILED',
        message: `Document region ${region.id} was reconciled from ${formatRange(documentRange)} to geometric range ${formatRange(matchedRange)}`,
        segmentIds: relatedSegments.map(({ id }) => id), evidenceIds: [evidenceId],
      });
    }
    const group: ShaftSemanticGroup = {
      id: `group:${region.id}`,
      segmentIds: relatedSegments.map(({ id }) => id),
      range,
      semanticType: region.type,
      ...(region.name === undefined ? {} : { name: region.name }),
      evidenceIds: [evidenceId, ...new Set([
        ...relatedSegments.flatMap(({ boundaryEvidenceIds }) => boundaryEvidenceIds),
        ...(conflict ? best.segments.flatMap(({ boundaryEvidenceIds }) => boundaryEvidenceIds) : []),
      ])],
      reconciliation: {
        status: ambiguous ? 'ambiguous' : conflict ? 'conflict' : matched ? 'matched' : 'unmatched',
        stationError: best.stationError,
        widthError: best.widthError,
        ...(best.diameterError === undefined ? {} : { diameterError: best.diameterError }),
        topologyError: best.topologyError,
        documentIdentityError: best.documentIdentityError,
        documentRange,
        geometryRange: matchedRange,
      },
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
      output.push({
        segments: selected,
        stationError: Math.max(endpointError, centerError),
        widthError,
        ...(diameterError === undefined ? {} : { diameterError }),
        topologyError: selected.some((segment, index) => index > 0 && Math.abs(segment.zStart - selected[index - 1]!.zEnd) > axisSpan * 1e-8) ? 1 : 0,
        documentIdentityError: region.name === undefined && region.type === undefined ? 1 : 0,
      });
    }
  }
  return output.sort(compareMatches);
}

function hasCriticalConflict(match: Match): boolean {
  return match.topologyError > 0
    || match.documentIdentityError > 0
    || match.widthError > 0.08
    || match.stationError > 0.08
    || (match.diameterError !== undefined && match.diameterError > 0.05);
}

function compareMatches(left: Match, right: Match): number {
  const leftDiameter = left.diameterError ?? Number.POSITIVE_INFINITY;
  const rightDiameter = right.diameterError ?? Number.POSITIVE_INFINITY;
  return Number(left.topologyError > 0) - Number(right.topologyError > 0)
    || Number(left.documentIdentityError > 0) - Number(right.documentIdentityError > 0)
    || Number(leftDiameter > 0.05) - Number(rightDiameter > 0.05)
    || Number(left.widthError > 0.08) - Number(right.widthError > 0.08)
    || leftDiameter - rightDiameter
    || left.widthError - right.widthError
    || left.stationError - right.stationError
    || left.segments.length - right.segments.length;
}

function equivalentMatch(left: Match, right: Match): boolean {
  const epsilon = 1e-9;
  return hasCriticalConflict(left) === hasCriticalConflict(right)
    && Math.abs(left.stationError - right.stationError) <= epsilon
    && Math.abs(left.widthError - right.widthError) <= epsilon
    && Math.abs((left.diameterError ?? 0) - (right.diameterError ?? 0)) <= epsilon;
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

function formatRange(range: { zStart: number; zEnd: number }): string {
  return `${Number(range.zStart.toFixed(6))}–${Number(range.zEnd.toFixed(6))}`;
}

function boundariesDifferOnlyBySampling(
  documentRange: { start: number; end: number },
  geometryRange: { start: number; end: number },
  axisSpan: number,
): boolean {
  const width = Math.abs(documentRange.end - documentRange.start);
  // DXF arcs and splines are sampled for profile analysis. Their chord bounds
  // can sit just inside the authored tangent/end coordinates, so a close
  // geometric match must not overwrite the document's exact engineering range.
  const tolerance = Math.max(Math.abs(axisSpan) * 1e-3, width * 0.05, 1e-6);
  return Math.abs(documentRange.start - geometryRange.start) <= tolerance
    && Math.abs(documentRange.end - geometryRange.end) <= tolerance;
}
