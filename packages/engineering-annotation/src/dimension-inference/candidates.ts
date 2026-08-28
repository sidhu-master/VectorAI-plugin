// SPDX-License-Identifier: Apache-2.0

import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { EngineeringDiagnostic } from '../dimension/types';
import type { PartitionDraft, PartitionRevision, ShaftSemanticGroup } from '../partition/types';
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
    accumulator.add(span.startStationId, span.endStationId, 'local', elementaryEvidence(span));
  }
  for (const group of input.partition.semanticGroups) addFunctionalInterval(accumulator, group);
  for (const region of input.document?.regions ?? []) addDocumentInterval(accumulator, region);
  const envelopes = deriveProcessEnvelopes(input.partition, input.topology);
  for (const envelope of envelopes) {
    accumulator.add(envelope.startStationId, envelope.endStationId, 'process', envelope.evidence);
  }
  for (let index = 1; index < envelopes.length; index += 1) {
    const previous = envelopes[index - 1]!;
    const current = envelopes[index]!;
    if (previous.endStationId === current.endStationId) continue;
    accumulator.add(previous.endStationId, current.endStationId, 'composite', {
      id: `partition:hierarchy:${previous.groupId}:${current.groupId}`,
      origin: 'partition', kind: 'process-envelope', label: '相邻关键功能包络', required: false,
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
      return;
    }
    this.#candidates.set(key, {
      id: `candidate:${key}`,
      ...ordered,
      nominalValue: canonical(this.#stations.get(ordered.endStationId)! - this.#stations.get(ordered.startStationId)!),
      roles: [role], evidenceIds: [evidence.id], required: evidence.required,
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

function addFunctionalInterval(accumulator: CandidateAccumulator, group: ShaftSemanticGroup): void {
  if (!group.range) return;
  const resolved = resolveCoordinates(accumulator.topology, group.range.zStart, group.range.zEnd);
  const evidence: DimensionEvidence = {
    id: `partition:group:${group.id}`, origin: 'partition', kind: 'functional-region',
    label: group.name ?? group.semanticType, required: false, sourceIds: [group.id, ...group.evidenceIds],
  };
  if (!resolved) {
    accumulator.problem('DIMENSION_STATION_UNRESOLVED', evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, 'functional', evidence);
}

function addDocumentInterval(accumulator: CandidateAccumulator, region: EngineeringRegionEvidence): void {
  if (!region.interval) return;
  const evidence: DimensionEvidence = {
    id: `document:region:${region.id}`, origin: 'document', kind: 'document-interval',
    label: region.name ?? region.type, required: true, sourceIds: region.sourceLines.map((line) => `document:line:${line}`),
  };
  const resolved = resolveCoordinates(accumulator.topology, region.interval.start, region.interval.end);
  if (!resolved) {
    accumulator.problem('DIMENSION_STATION_UNRESOLVED', evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, 'functional', evidence);
}

function deriveProcessEnvelopes(
  partition: PartitionDraft | PartitionRevision,
  topology: AxialTopology,
): ProcessEnvelope[] {
  const functionalSegmentIds = new Set(partition.semanticGroups
    .filter(({ semanticType }) => semanticType !== 'regular-shaft')
    .flatMap(({ segmentIds }) => segmentIds));
  const output: ProcessEnvelope[] = [];
  for (const group of partition.semanticGroups) {
    if (!group.range || group.semanticType === 'bearing' || group.semanticType === 'regular-shaft') continue;
    const width = Math.abs(group.range.zEnd - group.range.zStart);
    const next = partition.segments.find(({ zStart, id }) => (
      Math.abs(zStart - group.range!.zEnd) <= coordinateTolerance(topology) && !functionalSegmentIds.has(id)
    ));
    if (!next || Math.abs(next.zEnd - next.zStart) > width * 0.25) continue;
    const resolved = resolveCoordinates(topology, group.range.zStart, next.zEnd);
    if (!resolved) continue;
    output.push({
      ...resolved,
      groupId: group.id,
      evidence: {
        id: `partition:process-envelope:${group.id}`, origin: 'partition', kind: 'process-envelope',
        label: `${group.name ?? group.semanticType}工艺包络`, required: false,
        sourceIds: [group.id, next.id, ...next.boundaryEvidenceIds],
      },
    });
  }
  return output.sort((left, right) => stationCoordinate(topology, left.startStationId) - stationCoordinate(topology, right.startStationId));
}

function elementaryEvidence(span: AxialElementarySpan): DimensionEvidence {
  return {
    id: `geometry:${span.id}`, origin: 'geometry', kind: 'elementary-span',
    label: '相邻轴向台阶', required: false, sourceIds: [span.id, ...span.evidenceIds],
  };
}

function resolveCoordinates(topology: AxialTopology, start: number, end: number): ResolvedInterval | undefined {
  const tolerance = coordinateTolerance(topology);
  const first = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.min(start, end)) <= tolerance);
  const second = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.max(start, end)) <= tolerance);
  return first && second && first.id !== second.id ? { startStationId: first.id, endStationId: second.id } : undefined;
}

function coordinateTolerance(topology: AxialTopology): number {
  const length = topology.stations.at(-1)?.coordinate ?? 1;
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
