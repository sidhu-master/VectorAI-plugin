// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, ShaftPartitionSegment, StepCandidate } from './types';

interface SnapInput { snapCandidates: StepCandidate[]; snapTolerance: number }

export function moveBoundary(draft: PartitionDraft, input: SnapInput & { boundaryIndex: number; requestedZ: number }): PartitionDraft {
  if (input.boundaryIndex <= 0 || input.boundaryIndex >= draft.segments.length) throw new Error('PARTITION_BOUNDARY_INDEX');
  const z = snap(input.requestedZ, input.snapCandidates, input.snapTolerance);
  const before = draft.segments[input.boundaryIndex - 1]!;
  const after = draft.segments[input.boundaryIndex]!;
  if (!(z > before.zStart && z < after.zEnd)) throw new Error('PARTITION_BOUNDARY_ORDER');
  const evidenceId = `manual:boundary:${input.boundaryIndex}:${canonical(z)}`;
  const profileSamples = uniqueSamples(draft.segments.flatMap((segment) => segment.profileSamples ?? []));
  const segments = draft.segments.map((segment, index) => index === input.boundaryIndex - 1
    ? summarize({ ...segment, zEnd: z, profileSamples, boundaryEvidenceIds: unique([...segment.boundaryEvidenceIds, evidenceId]) })
    : index === input.boundaryIndex
      ? summarize({ ...segment, zStart: z, profileSamples, boundaryEvidenceIds: unique([...segment.boundaryEvidenceIds, evidenceId]) })
      : segment);
  return appendManual(draft, segments, evidenceId, `Boundary moved to ${z}`);
}

export function splitSegment(draft: PartitionDraft, input: SnapInput & { segmentId: string; z: number }): PartitionDraft {
  const index = draft.segments.findIndex(({ id }) => id === input.segmentId);
  if (index < 0) throw new Error('PARTITION_SEGMENT_UNKNOWN');
  const source = draft.segments[index]!;
  const z = snap(input.z, input.snapCandidates, input.snapTolerance);
  if (!(z > source.zStart && z < source.zEnd)) throw new Error('PARTITION_BOUNDARY_ORDER');
  const evidenceId = `manual:split:${source.id}:${canonical(z)}`;
  const make = (side: 'left' | 'right', zStart: number, zEnd: number): ShaftPartitionSegment => ({
    ...source, id: `${source.id}:${side}:${canonical(z)}`, zStart, zEnd,
    boundaryEvidenceIds: unique([...source.boundaryEvidenceIds, evidenceId]),
  });
  const left = summarize(make('left', source.zStart, z));
  const right = summarize(make('right', z, source.zEnd));
  const segments = [...draft.segments.slice(0, index), left, right, ...draft.segments.slice(index + 1)];
  const semanticGroups = draft.semanticGroups.map((group) => ({
    ...group,
    segmentIds: group.segmentIds.flatMap((id) => id === source.id ? [left.id, right.id] : [id]),
  }));
  return appendManual({ ...draft, semanticGroups }, segments, evidenceId, `Segment split at ${z}`);
}

export function mergeBoundary(draft: PartitionDraft, input: { boundaryIndex: number }): PartitionDraft {
  if (input.boundaryIndex <= 0 || input.boundaryIndex >= draft.segments.length) throw new Error('PARTITION_BOUNDARY_INDEX');
  const left = draft.segments[input.boundaryIndex - 1]!;
  const right = draft.segments[input.boundaryIndex]!;
  const evidenceId = `manual:merge:${left.id}:${right.id}`;
  const merged: ShaftPartitionSegment = {
    ...left,
    id: `segment:${canonical(left.zStart)}-${canonical(right.zEnd)}`,
    zEnd: right.zEnd,
    profile: {
      minRadius: Math.min(left.profile.minRadius, right.profile.minRadius),
      maxRadius: Math.max(left.profile.maxRadius, right.profile.maxRadius),
      sampleCount: left.profile.sampleCount + right.profile.sampleCount,
    },
    geometryNodeIds: unique([...left.geometryNodeIds, ...right.geometryNodeIds]),
    boundaryEvidenceIds: unique([...left.boundaryEvidenceIds, ...right.boundaryEvidenceIds, evidenceId]),
    semanticEvidenceIds: unique([...left.semanticEvidenceIds, ...right.semanticEvidenceIds]),
    diagnosticIds: unique([...left.diagnosticIds, ...right.diagnosticIds]),
    profileSamples: [...(left.profileSamples ?? []), ...(right.profileSamples ?? [])],
  };
  const segments = [...draft.segments.slice(0, input.boundaryIndex - 1), merged, ...draft.segments.slice(input.boundaryIndex + 1)];
  const removed = new Set([left.id, right.id]);
  const semanticGroups = draft.semanticGroups.map((group) => ({
    ...group,
    segmentIds: unique(group.segmentIds.flatMap((id) => removed.has(id) ? [merged.id] : [id])),
  }));
  return appendManual({ ...draft, semanticGroups }, segments, evidenceId, 'Boundary merged');
}

export function updateSegmentMetadata(draft: PartitionDraft, input: { segmentId: string; name?: string; semanticType?: string }): PartitionDraft {
  if (!draft.segments.some(({ id }) => id === input.segmentId)) throw new Error('PARTITION_SEGMENT_UNKNOWN');
  const evidenceId = `manual:metadata:${input.segmentId}:${draft.evidence.length}`;
  const segments = draft.segments.map((segment) => segment.id === input.segmentId ? {
    ...segment,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.semanticType === undefined ? {} : { semanticType: input.semanticType }),
    semanticEvidenceIds: unique([...segment.semanticEvidenceIds, evidenceId]),
  } : segment);
  return appendManual(draft, segments, evidenceId, `Metadata updated for ${input.segmentId}`);
}

function snap(value: number, candidates: StepCandidate[], tolerance: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(tolerance) || tolerance < 0) throw new Error('PARTITION_BOUNDARY_INVALID');
  const eligible = candidates.filter(({ z }) => Math.abs(z - value) <= tolerance).sort((a, b) => b.score - a.score || Math.abs(a.z - value) - Math.abs(b.z - value));
  return eligible[0]?.z ?? value;
}

function appendManual(draft: PartitionDraft, segments: ShaftPartitionSegment[], id: string, label: string): PartitionDraft {
  return { ...structuredClone(draft), segments: structuredClone(segments), evidence: [...structuredClone(draft.evidence), { id, origin: 'manual', label }] };
}

function summarize(segment: ShaftPartitionSegment): ShaftPartitionSegment {
  if (segment.profileSamples === undefined) return segment;
  const tolerance = Math.max((segment.zEnd - segment.zStart) * 1e-9, 1e-9);
  const samples = segment.profileSamples.filter(({ z }) => z >= segment.zStart - tolerance && z <= segment.zEnd + tolerance);
  const radii = samples.map(({ radius }) => radius);
  return {
    ...segment,
    profile: {
      minRadius: radii.length === 0 ? 0 : Math.min(...radii),
      maxRadius: radii.length === 0 ? 0 : Math.max(...radii),
      sampleCount: radii.length,
    },
    geometryNodeIds: unique(samples.map(({ geometryNodeId }) => geometryNodeId)),
  };
}

function uniqueSamples(samples: NonNullable<ShaftPartitionSegment['profileSamples']>): NonNullable<ShaftPartitionSegment['profileSamples']> {
  return [...new Map(samples.map((sample) => [`${sample.geometryNodeId}:${canonical(sample.z)}:${canonical(sample.radius)}`, sample])).values()];
}

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function canonical(value: number): string { return Number(value.toFixed(9)).toString(); }
