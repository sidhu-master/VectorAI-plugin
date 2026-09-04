// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import type { PartitionDraft, PartitionRevision } from '../partition/types';
import { buildShaftContourTopology } from '../shaft/contour-topology';
import type { AxialElementarySpan, AxialStation, AxialStationKind, AxialTopology } from './types';

export interface BuildAxialTopologyInput {
  partition: PartitionDraft | PartitionRevision;
  /** Source geometry is needed to distinguish dimension shoulders from chamfer/fillet transitions. */
  document?: DrawingDocument;
  unit?: 'mm' | 'cm' | 'm' | 'in';
  coordinateTolerance?: number;
}

interface BoundaryEvidence {
  z: number;
  kinds: AxialStationKind[];
  geometryNodeIds: string[];
  evidenceIds: string[];
}

export function buildAxialTopology(input: BuildAxialTopologyInput): AxialTopology {
  const { partition } = input;
  const length = partition.axis.zMax - partition.axis.zMin;
  const tolerance = input.coordinateTolerance ?? Math.max(Math.abs(length) * 1e-5, 1e-6);
  const contour = input.document ? buildShaftContourTopology(input.document, partition.axis) : undefined;
  const boundaries = collectBoundaryEvidence(partition, contour, tolerance);
  if (boundaries.some(({ z }) => !Number.isFinite(z))) throw new Error('DIMENSION_STATION_UNRESOLVED');
  const stations = mergeBoundaries(boundaries, partition.axis.zMin, input.unit ?? 'mm', tolerance);
  const elementarySpans = consecutiveSpans(stations, partition, tolerance);
  return {
    drawingRef: partition.drawingRef,
    axis: structuredClone(partition.axis),
    unit: input.unit ?? 'mm',
    stations,
    elementarySpans,
  };
}

function collectBoundaryEvidence(
  partition: PartitionDraft | PartitionRevision,
  contour: ReturnType<typeof buildShaftContourTopology> | undefined,
  tolerance: number,
): BoundaryEvidence[] {
  const output: BoundaryEvidence[] = [
    { z: partition.axis.zMin, kinds: ['drawing-end'], geometryNodeIds: [], evidenceIds: ['axis:start'] },
    { z: partition.axis.zMax, kinds: ['drawing-end'], geometryNodeIds: [], evidenceIds: ['axis:end'] },
  ];
  const dimensionShoulders = contour?.transitions.filter(({ kind, confidence }) => (
    kind === 'shoulder' && confidence >= 0.55
  )) ?? [];
  // The partition can contain chamfer/fillet decomposition boundaries. When
  // source geometry is available, only contour transitions classified as true
  // shoulders become dimension stations; semantic group ranges still add
  // explicit functional boundaries such as a bearing seat start.
  const useContourBoundaries = dimensionShoulders.length > 0;
  const isDimensionBoundary = (z: number): boolean => !useContourBoundaries || dimensionShoulders.some(({ z: shoulder }) => (
    Math.abs(shoulder - z) <= tolerance * 12
  ));
  for (const segment of partition.segments) {
    if (!isDimensionBoundary(segment.zStart) && !isDimensionBoundary(segment.zEnd)) continue;
    if (isDimensionBoundary(segment.zStart)) output.push({
      z: segment.zStart,
      kinds: ['partition-boundary'],
      geometryNodeIds: segment.geometryNodeIds,
      evidenceIds: segment.boundaryEvidenceIds,
    });
    if (isDimensionBoundary(segment.zEnd)) output.push({
      z: segment.zEnd,
      kinds: ['partition-boundary'],
      geometryNodeIds: segment.geometryNodeIds,
      evidenceIds: segment.boundaryEvidenceIds,
    });
  }
  for (const transition of dimensionShoulders) {
    output.push({
      z: transition.z,
      kinds: ['shoulder'],
      geometryNodeIds: transition.geometryNodeIds,
      evidenceIds: transition.geometryNodeIds.map((id) => `geometry:${id}`),
    });
  }
  for (const group of partition.semanticGroups) {
    if (!group.range) continue;
    for (const z of [group.range.zStart, group.range.zEnd]) {
      output.push({
        z,
        kinds: ['partition-boundary'],
        geometryNodeIds: partition.segments
          .filter(({ id }) => group.segmentIds.includes(id))
          .flatMap(({ geometryNodeIds }) => geometryNodeIds),
        evidenceIds: [group.id, ...group.evidenceIds],
      });
    }
  }
  if (!useContourBoundaries && 'stepCandidates' in partition) {
    for (const step of partition.stepCandidates.filter(({ accepted }) => accepted)) {
      output.push({ z: step.z, kinds: ['shoulder'], geometryNodeIds: [], evidenceIds: [step.id, ...step.evidenceIds] });
    }
  }
  return output;
}

function mergeBoundaries(
  values: BoundaryEvidence[],
  zMin: number,
  unit: AxialStation['unit'],
  tolerance: number,
): AxialStation[] {
  const groups: BoundaryEvidence[][] = [];
  for (const value of [...values].sort((left, right) => left.z - right.z)) {
    const group = groups.at(-1);
    if (group && Math.abs(value.z - average(group.map(({ z }) => z))) <= tolerance) group.push(value);
    else groups.push([value]);
  }
  return groups.map((group) => {
    const authoritative = group.filter(({ evidenceIds }) => evidenceIds.some((id) => id.startsWith('group:')));
    const sourceCoordinate = average((authoritative.length > 0 ? authoritative : group).map(({ z }) => z));
    const coordinate = canonicalEngineeringCoordinate(sourceCoordinate - zMin);
    return {
      id: `station:${formatCoordinate(coordinate)}`,
      coordinate,
      sourceCoordinate: canonicalSourceCoordinate(sourceCoordinate),
      unit,
      kinds: unique(group.flatMap(({ kinds }) => kinds)).sort(kindOrder),
      geometryNodeIds: unique(group.flatMap(({ geometryNodeIds }) => geometryNodeIds)).sort(),
      evidenceIds: unique(group.flatMap(({ evidenceIds }) => evidenceIds)).sort(),
    };
  });
}

function consecutiveSpans(
  stations: AxialStation[],
  partition: PartitionDraft | PartitionRevision,
  tolerance: number,
): AxialElementarySpan[] {
  return stations.slice(0, -1).map((start, index) => {
    const end = stations[index + 1]!;
    const nominalValue = canonicalEngineeringCoordinate(end.coordinate - start.coordinate);
    if (nominalValue <= tolerance) throw new Error('DIMENSION_STATION_CONFLICT');
    const midpoint = (start.sourceCoordinate + end.sourceCoordinate) / 2;
    const segments = partition.segments.filter(({ zStart, zEnd }) => (
      midpoint >= Math.min(zStart, zEnd) - tolerance && midpoint <= Math.max(zStart, zEnd) + tolerance
    ));
    return {
      id: `span:${start.id}:${end.id}`,
      startStationId: start.id,
      endStationId: end.id,
      nominalValue,
      segmentIds: segments.map(({ id }) => id).sort(),
      evidenceIds: unique([
        ...start.evidenceIds,
        ...end.evidenceIds,
        ...segments.flatMap(({ boundaryEvidenceIds }) => boundaryEvidenceIds),
      ]).sort(),
    };
  });
}

function kindOrder(left: AxialStationKind, right: AxialStationKind): number {
  const order: AxialStationKind[] = ['drawing-end', 'shoulder', 'partition-boundary', 'datum'];
  return order.indexOf(left) - order.indexOf(right);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function canonicalSourceCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function canonicalEngineeringCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

function formatCoordinate(value: number): string {
  return canonicalEngineeringCoordinate(value).toString();
}
