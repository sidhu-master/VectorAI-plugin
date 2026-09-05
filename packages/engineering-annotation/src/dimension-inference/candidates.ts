// SPDX-License-Identifier: Apache-2.0

import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { EngineeringDiagnostic } from '../dimension/types';
import type { PartitionDraft, PartitionRevision, ShaftSemanticGroup } from '../partition/types';
import { resolveShaftDimensionRole } from '../partition/dimension-role';
import type {
  AxialCandidateSet,
  AxialDimensionCandidate,
  AxialDimensionRole,
  AxialElementarySpan,
  AxialTopology,
  DimensionEvidence,
  GenerateCandidateInput,
} from './types';

interface ResolvedInterval { startStationId: string; endStationId: string }
interface ProcessEnvelope extends ResolvedInterval { groupId: string; evidence: DimensionEvidence }

export function generateAxialDimensionCandidates(input: GenerateCandidateInput): AxialCandidateSet {
  const accumulator = new CandidateAccumulator(input.topology);
  for (const span of input.topology.elementarySpans) {
    accumulator.add(
      span.startStationId,
      span.endStationId,
      'local',
      elementaryEvidence(span, input.topology, input.partition),
    );
  }
  for (const group of input.partition.semanticGroups) addFunctionalInterval(accumulator, group, input.partition);
  for (const region of input.document?.regions ?? []) addDocumentInterval(accumulator, region, input.partition);
  const envelopes = deriveProcessEnvelopes(input.partition, input.topology);
  for (const envelope of envelopes) {
    accumulator.add(envelope.startStationId, envelope.endStationId, 'process', envelope.evidence);
  }
  for (let index = 1; index < envelopes.length; index += 1) {
    const previous = envelopes[index - 1]!;
    const current = envelopes[index]!;
    if (previous.endStationId === current.endStationId) continue;
    accumulator.add(previous.endStationId, current.endStationId, 'composite', {
      id: `partition:process-datum-chain:${previous.groupId}:${current.groupId}`,
      origin: 'partition', kind: 'process-envelope', label: '相邻功能工艺基准链', required: false,
      sourceIds: [previous.groupId, current.groupId],
    });
  }
  const first = input.topology.stations[0];
  const last = input.topology.stations.at(-1);
  if (first && last) {
    accumulator.add(first.id, last.id, 'overall', {
      id: 'geometry:drawing-overall', origin: 'geometry', kind: 'drawing-end',
      label: '零件轴向总长', required: true, sourceIds: [first.id, last.id],
    });
  }
  for (const [index, interval] of (input.manualIntervals ?? []).entries()) {
    const resolved = resolveCoordinates(input.topology, interval.start, interval.end);
    const evidenceId = `manual:interval:${index}`;
    if (!resolved) {
      accumulator.problem('DIMENSION_STATION_UNRESOLVED', evidenceId);
      continue;
    }
    accumulator.add(resolved.startStationId, resolved.endStationId, 'reference', {
      id: evidenceId, origin: 'manual', kind: 'manual-requirement', label: interval.label,
      required: true, sourceIds: [],
    });
  }
  return accumulator.result();
}

class CandidateAccumulator {
  readonly #candidates = new Map<string, AxialDimensionCandidate>();
  readonly #evidence = new Map<string, DimensionEvidence>();
  readonly #diagnostics: EngineeringDiagnostic[] = [];
  readonly #stations: Map<string, number>;

  constructor(readonly topology: AxialTopology) {
    this.#stations = new Map(topology.stations.map(({ id, coordinate }) => [id, coordinate]));
  }

  add(startStationId: string, endStationId: string, role: AxialDimensionRole, evidence: DimensionEvidence): void {
    const ordered = this.#ordered(startStationId, endStationId);
    if (!ordered) {
      this.problem('DIMENSION_STATION_UNRESOLVED', evidence.id);
      return;
    }
    this.#evidence.set(evidence.id, structuredClone(evidence));
    const key = `${ordered.startStationId}:${ordered.endStationId}`;
    const existing = this.#candidates.get(key);
    if (existing) {
      existing.roles = unique([...existing.roles, role]).sort();
      existing.evidenceIds = unique([...existing.evidenceIds, evidence.id]).sort();
      existing.required ||= evidence.required;
      existing.constraint = mergeConstraint(existing.constraint, evidence.constraint ?? (evidence.required ? 'required' : 'preferred'));
      return;
    }
    this.#candidates.set(key, {
      id: `candidate:${key}`,
      ...ordered,
      nominalValue: canonical(this.#stations.get(ordered.endStationId)! - this.#stations.get(ordered.startStationId)!),
      roles: [role], evidenceIds: [evidence.id], required: evidence.required,
      constraint: evidence.constraint ?? (evidence.required ? 'required' : 'preferred'),
    });
  }

  problem(code: string, evidenceId: string): void {
    this.#diagnostics.push({
      id: `dimension-candidate:${code}:${evidenceId}`,
      severity: 'warning', code, message: `Unable to resolve dimension evidence ${evidenceId}`,
      evidenceIds: [evidenceId],
    });
  }

  result(): AxialCandidateSet {
    return {
      candidates: [...this.#candidates.values()].sort(candidateOrder),
      evidence: [...this.#evidence.values()].sort((left, right) => left.id.localeCompare(right.id)),
      diagnostics: [...this.#diagnostics].sort((left, right) => left.id.localeCompare(right.id)),
    };
  }

  #ordered(startStationId: string, endStationId: string): ResolvedInterval | undefined {
    const start = this.#stations.get(startStationId);
    const end = this.#stations.get(endStationId);
    if (start === undefined || end === undefined || start === end) return undefined;
    return start < end ? { startStationId, endStationId } : { startStationId: endStationId, endStationId: startStationId };
  }
}

function addFunctionalInterval(
  accumulator: CandidateAccumulator,
  group: ShaftSemanticGroup,
  partition: PartitionDraft | PartitionRevision,
): void {
  if (!group.range) return;
  const documentEvidence = group.evidenceIds
    .map((id) => partition.evidence.find((item) => item.id === id))
    .find((item) => item?.origin === 'document');
  if (resolveShaftDimensionRole(group, partition) !== 'functional-feature' && !documentEvidence) return;
  const resolved = resolveCoordinates(accumulator.topology, group.range.zStart, group.range.zEnd);
  const evidence: DimensionEvidence = documentEvidence
    ? {
      id: documentEvidence.id,
      origin: 'document',
      kind: 'document-interval',
      label: documentEvidence.label,
      required: true,
      sourceIds: [
        group.id,
        ...group.evidenceIds,
        ...(documentEvidence.sourceLines ?? []).map((line) => `document:line:${line}`),
      ],
    }
    : {
      id: `partition:group:${group.id}`, origin: 'partition', kind: 'functional-region',
      label: group.name ?? group.semanticType, required: false, sourceIds: [group.id, ...group.evidenceIds],
    };
  if (!resolved) {
    accumulator.problem('DIMENSION_STATION_UNRESOLVED', evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, 'functional', evidence);
}

function addDocumentInterval(
  accumulator: CandidateAccumulator,
  region: EngineeringRegionEvidence,
  partition: PartitionDraft | PartitionRevision,
): void {
  if (!region.interval) return;
  const evidence: DimensionEvidence = {
    id: `document:region:${region.id}`, origin: 'document', kind: 'document-interval',
    label: region.name ?? region.type, required: true, sourceIds: region.sourceLines.map((line) => `document:line:${line}`),
  };
  const resolved = resolveCoordinates(accumulator.topology, region.interval.start, region.interval.end)
    ?? resolveFusedSemanticInterval(accumulator.topology, partition, region);
  if (!resolved) {
    accumulator.problem('DIMENSION_STATION_UNRESOLVED', evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, 'functional', evidence);
}

function resolveFusedSemanticInterval(
  topology: AxialTopology,
  partition: PartitionDraft | PartitionRevision,
  region: EngineeringRegionEvidence,
): ResolvedInterval | undefined {
  if (!region.interval) return undefined;
  const documentWidth = Math.abs(region.interval.end - region.interval.start);
  const match = partition.semanticGroups.find((group) => {
    if (!group.range || group.name !== region.name && group.semanticType !== region.type) return false;
    const groupWidth = Math.abs(group.range.zEnd - group.range.zStart);
    return Math.abs(groupWidth - documentWidth) <= Math.max(documentWidth * 1e-5, 1e-6);
  });
  return match?.range
    ? resolveCoordinates(topology, match.range.zStart, match.range.zEnd)
    : undefined;
}

function deriveProcessEnvelopes(
  partition: PartitionDraft | PartitionRevision,
  topology: AxialTopology,
): ProcessEnvelope[] {
  const tolerance = coordinateTolerance(topology);
  const segments = [...partition.segments].sort((left, right) => left.zStart - right.zStart);
  const processGroups = partition.semanticGroups.filter((group) => (
    group.range !== undefined && isProcessFeature(group, partition) && !hasOnlyAiEvidence(group, partition)
  ));
  const structuralStations = topology.stations.filter(({ kinds }) => (
    kinds.includes('drawing-end') || kinds.includes('shoulder')
  ));
  return processGroups.flatMap((group): ProcessEnvelope[] => {
    const sharedBoundary = processGroups.some((candidate) => (
      candidate.id !== group.id
      && candidate.range !== undefined
      && Math.abs(candidate.range.zStart - group.range!.zEnd) <= tolerance
    ));
    if (sharedBoundary) return [];
    const startStation = topology.stations.find(({ coordinate }) => (
      Math.abs(coordinate - group.range!.zStart) <= tolerance
    ));
    const envelopeStart = startStation?.kinds.some((kind) => kind === 'drawing-end' || kind === 'shoulder')
      ? group.range.zStart
      : structuralStations
        .map(({ coordinate }) => coordinate)
        .filter((coordinate) => coordinate < group.range!.zStart - tolerance)
        .sort((left, right) => right - left)[0] ?? group.range.zStart;
    const transitionEnd = structuralStations
      .map(({ coordinate }) => coordinate)
      .filter((coordinate) => coordinate > group.range!.zEnd + tolerance)
      .sort((left, right) => left - right)[0];
    if (transitionEnd === undefined) return [];
    const resolved = resolveCoordinates(topology, envelopeStart, transitionEnd);
    if (!resolved) return [];
    const transitionSegments = segments.filter(({ zStart, zEnd }) => (
      zEnd > envelopeStart + tolerance
      && zStart < transitionEnd - tolerance
      && (zStart < group.range!.zStart - tolerance || zEnd > group.range!.zEnd + tolerance)
    ));
    return [{
      ...resolved,
      groupId: group.id,
      evidence: {
        id: `partition:process-envelope:${group.id}`,
        origin: 'partition', kind: 'process-envelope', label: `${group.name ?? group.semanticType}工艺包络`,
        required: false,
        sourceIds: [
          group.id,
          ...transitionSegments.flatMap(({ id, boundaryEvidenceIds }) => [id, ...boundaryEvidenceIds]),
        ],
      },
    }];
  }).sort((left, right) => stationCoordinate(topology, left.startStationId) - stationCoordinate(topology, right.startStationId));
}

function isProcessFeature(
  group: ShaftSemanticGroup,
  partition: PartitionDraft | PartitionRevision,
): boolean {
  const role = resolveShaftDimensionRole(group, partition);
  return role === 'functional-feature' || role === 'transition';
}

function hasOnlyAiEvidence(
  group: ShaftSemanticGroup,
  partition: PartitionDraft | PartitionRevision,
): boolean {
  const evidence = group.evidenceIds
    .map((id) => partition.evidence.find((item) => item.id === id))
    .filter((item) => item !== undefined);
  return evidence.length > 0 && evidence.every(({ origin }) => origin === 'ai');
}

function elementaryEvidence(
  span: AxialElementarySpan,
  topology: AxialTopology,
  partition: PartitionDraft | PartitionRevision,
): DimensionEvidence {
  return {
    id: `geometry:${span.id}`, origin: 'geometry', kind: 'elementary-span',
    label: '相邻轴向台阶', required: false, sourceIds: [span.id, ...span.evidenceIds],
    ...(isTransitionDetailSpan(span, topology, partition) ? { constraint: 'prohibited' as const } : {}),
  };
}

function isTransitionDetailSpan(
  span: AxialElementarySpan,
  topology: AxialTopology,
  partition: PartitionDraft | PartitionRevision,
): boolean {
  const stations = [span.startStationId, span.endStationId]
    .map((id) => topology.stations.find((station) => station.id === id))
    .filter((station) => station !== undefined);
  return stations.length !== 2 || liesInTransitionCorridor(stations[0]!.coordinate, stations[1]!.coordinate, partition, topology)
    || stations.some((station) => (
    !station.kinds.some((kind) => kind === 'drawing-end' || kind === 'shoulder')
    || partition.semanticGroups.some((group) => (
      (station.evidenceIds.includes(group.id)
        || group.evidenceIds.some((id) => station.evidenceIds.includes(id)))
      && hasOnlyAiEvidence(group, partition)
    ))
    ));
}

function liesInTransitionCorridor(
  left: number,
  right: number,
  partition: PartitionDraft | PartitionRevision,
  topology: AxialTopology,
): boolean {
  const tolerance = coordinateTolerance(topology);
  const groups = partition.semanticGroups
    .filter((group) => group.range !== undefined && !hasOnlyAiEvidence(group, partition))
    .sort((a, b) => a.range!.zStart - b.range!.zStart || a.range!.zEnd - b.range!.zEnd);
  const spanStart = Math.min(left, right);
  const spanEnd = Math.max(left, right);
  return groups.some((group, index) => {
    if (resolveShaftDimensionRole(group, partition) !== 'transition') return false;
    const nextFunctionalStart = groups.slice(index + 1)
      .find((candidate) => resolveShaftDimensionRole(candidate, partition) === 'functional-feature')
      ?.range?.zStart;
    const corridorStart = group.range!.zStart;
    const corridorEnd = Math.max(group.range!.zEnd, nextFunctionalStart ?? group.range!.zEnd);
    return spanStart >= corridorStart - tolerance && spanEnd <= corridorEnd + tolerance;
  });
}

function resolveCoordinates(topology: AxialTopology, start: number, end: number): ResolvedInterval | undefined {
  const tolerance = coordinateTolerance(topology);
  const first = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.min(start, end)) <= tolerance);
  const second = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.max(start, end)) <= tolerance);
  return first && second && first.id !== second.id ? { startStationId: first.id, endStationId: second.id } : undefined;
}

function coordinateTolerance(topology: AxialTopology): number {
  const length = (topology.stations.at(-1)?.coordinate ?? 1) - (topology.stations[0]?.coordinate ?? 0);
  return Math.max(Math.abs(length) * 1e-5, 1e-6);
}

function stationCoordinate(topology: AxialTopology, id: string): number {
  return topology.stations.find((station) => station.id === id)?.coordinate ?? Number.POSITIVE_INFINITY;
}

function candidateOrder(left: AxialDimensionCandidate, right: AxialDimensionCandidate): number {
  return left.startStationId.localeCompare(right.startStationId) || left.endStationId.localeCompare(right.endStationId);
}

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function canonical(value: number): number { return Number(value.toFixed(6)); }
function mergeConstraint(
  left: AxialDimensionCandidate['constraint'], right: AxialDimensionCandidate['constraint'],
): AxialDimensionCandidate['constraint'] {
  if (left === 'required' || right === 'required') return 'required';
  if (left === 'prohibited' || right === 'prohibited') return 'prohibited';
  return 'preferred';
}
