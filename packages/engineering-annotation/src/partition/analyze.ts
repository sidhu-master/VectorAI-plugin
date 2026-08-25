// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingRef } from '@vectorai/drawing-edit-protocol';
import { parseEngineeringDocument } from '../engineering-document/parser';
import { resolveShaftAxis } from '../shaft/axis';
import { extractShaftProfile, radiusSummary } from '../shaft/profile';
import { detectShaftSteps } from '../shaft/steps';
import { fuseDocumentRegions } from './fuse';
import { validatePartition } from './invariants';
import type { PartitionDiagnostic, PartitionDraft, PartitionEvidence } from './types';

export interface AnalyzeShaftPartitionRequest {
  document: DrawingDocument;
  drawingRef: DrawingRef;
  engineeringText?: string;
  drawingSourceName?: string;
}

export type AnalyzeShaftPartitionResult =
  | { status: 'drafted'; draft: PartitionDraft; unclassifiedSegmentIds: string[] }
  | { status: 'rejected'; diagnostics: PartitionDiagnostic[] };

export function analyzeShaftPartition(request: AnalyzeShaftPartitionRequest): AnalyzeShaftPartitionResult {
  const parsed = request.engineeringText === undefined ? undefined : parseEngineeringDocument(request.engineeringText);
  const documentScale = parsed?.drawing.unit === undefined ? 1 : unitScale(parsed.drawing.unit) / unitScale(request.document.unitSystem.length);
  const documentRegions = (parsed?.regions ?? []).map((region) => ({
    ...region,
    ...(region.interval === undefined ? {} : { interval: { start: region.interval.start * documentScale, end: region.interval.end * documentScale } }),
    ...(region.outerDiameter === undefined ? {} : { outerDiameter: region.outerDiameter * documentScale }),
  }));
  const axis = resolveShaftAxis(request.document, {
    axisOrigin: parsed?.drawing.axisOrigin,
    orientation: parsed?.drawing.orientation,
    regions: documentRegions,
  });
  if (!axis) return { status: 'rejected', diagnostics: [{ id: 'diagnostic:axis', severity: 'error', code: 'SHAFT_AXIS_UNRESOLVED', message: 'No viable shaft axis was found' }] };
  const profile = extractShaftProfile(request.document, axis);
  const stepCandidates = detectShaftSteps(profile);
  const geometryEvidence = new Map<string, PartitionEvidence>();
  for (const step of stepCandidates) {
    for (const evidenceId of step.evidenceIds) {
      geometryEvidence.set(evidenceId, { id: evidenceId, origin: 'geometry', label: `Geometric step at ${step.z}` });
    }
  }
  const boundaries = stepCandidates.filter(({ accepted }) => accepted).map(({ z }) => z);
  const tolerance = Math.max(axis.zMax * 1e-8, 1e-8);
  const sorted = [...boundaries].sort((a, b) => a - b).filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]!) > tolerance);
  let draft: PartitionDraft = {
    version: 1,
    drawingRef: structuredClone(request.drawingRef),
    axis,
    segments: sorted.slice(0, -1).map((zStart, index) => {
      const zEnd = sorted[index + 1]!;
      const overlappingPieces = profile.pieces.filter(({ z1, z2 }) => Math.max(z1, z2) >= zStart && Math.min(z1, z2) <= zEnd);
      const left = stepCandidates.find(({ z }) => Math.abs(z - zStart) <= tolerance);
      const right = stepCandidates.find(({ z }) => Math.abs(z - zEnd) <= tolerance);
      return {
        id: `segment:${canonical(zStart)}-${canonical(zEnd)}`,
        zStart, zEnd,
        profile: radiusSummary(profile, zStart, zEnd),
        boundaryConfidence: Math.min(left?.score ?? 0.75, right?.score ?? 0.75),
        geometryNodeIds: [...new Set(overlappingPieces.map(({ geometryNodeId }) => geometryNodeId))],
        profileSamples: overlappingPieces.flatMap(({ z1, r1, z2, r2, geometryNodeId }) => [
          { z: z1, radius: Math.abs(r1), geometryNodeId },
          { z: z2, radius: Math.abs(r2), geometryNodeId },
        ]),
        boundaryEvidenceIds: [...new Set([...(left?.evidenceIds ?? []), ...(right?.evidenceIds ?? [])])],
        semanticEvidenceIds: [], diagnosticIds: [],
      };
    }),
    semanticGroups: [], stepCandidates,
    evidence: [...geometryEvidence.values()],
    diagnostics: [...(parsed?.diagnostics ?? [])],
  };
  if (parsed?.drawing.drawingName && request.drawingSourceName && parsed.drawing.drawingName !== request.drawingSourceName) {
    draft.diagnostics.push({
      id: 'diagnostic:drawing-name-mismatch', severity: 'warning', code: 'DOCUMENT_DRAWING_NAME_MISMATCH',
      message: `Selected ${request.drawingSourceName}; document describes ${parsed.drawing.drawingName}`,
    });
  }
  if (parsed) draft = fuseDocumentRegions(draft, documentRegions);
  const invalid = validatePartition(draft);
  if (invalid.length > 0) return { status: 'rejected', diagnostics: [...draft.diagnostics, ...invalid] };
  return {
    status: 'drafted', draft,
    unclassifiedSegmentIds: draft.segments.filter(({ semanticType }) => semanticType === undefined).map(({ id }) => id),
  };
}

function canonical(value: number): string { return Number(value.toFixed(6)).toString(); }
function unitScale(unit: 'mm' | 'cm' | 'm'): number { return unit === 'mm' ? 0.001 : unit === 'cm' ? 0.01 : 1; }
