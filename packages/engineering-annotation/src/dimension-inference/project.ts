// SPDX-License-Identifier: Apache-2.0

import type { GeometryId, Vec2 } from '@vectorai/drawing-core';
import type {
  AnnotationDependency,
  DimensionChain,
  DimensionFunctionalRole,
  DimensionIntent,
  EngineeringAnnotationDraft,
  EngineeringAnnotationRevision,
} from '../dimension/types';
import type { AxialDimensionCandidate, AxialDimensionScheme } from './types';

export interface ProjectAxialSchemeInput {
  scheme: AxialDimensionScheme;
  baseRevisionId?: string;
}

export function projectAxialDimensionScheme(input: ProjectAxialSchemeInput): EngineeringAnnotationDraft {
  const candidateIds = unique([
    ...input.scheme.displayedCandidateIds,
    ...input.scheme.closureCandidateIds,
    ...input.scheme.chains.flatMap(({ parentCandidateId, childCandidateIds, closureCandidateId }) => (
      [parentCandidateId, ...childCandidateIds, closureCandidateId]
    )),
  ]);
  const candidates = new Map(input.scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const intents = candidateIds.map((id) => projectIntent(requireCandidate(candidates, id), input.scheme));
  const intentByCandidate = new Map(candidateIds.map((id) => [id, intentId(id)]));
  const chains = input.scheme.chains.map((chain) => projectChain(chain, input.scheme, intentByCandidate));
  const dependencies = projectDependencies(input.scheme, intentByCandidate);
  return {
    version: 1,
    drawingRef: input.scheme.drawingRef,
    datums: [],
    intents,
    tolerances: [],
    fitAssignments: [],
    geometricTolerances: [],
    chains,
    dependencies,
    diagnostics: structuredClone(input.scheme.diagnostics),
    axialScheme: structuredClone(input.scheme),
    ...(input.baseRevisionId === undefined ? {} : { baseRevisionId: input.baseRevisionId }),
  };
}

/**
 * Replaces only the axial-dimension-owned part of a shared annotation plan.
 * Datums, GD&T, tolerances and unrelated dimension intents belong to other
 * workflows and must survive an axial scheme refresh or layout edit.
 */
export function mergeAxialDimensionProjection(
  base: EngineeringAnnotationDraft | EngineeringAnnotationRevision | undefined,
  projection: EngineeringAnnotationDraft,
): EngineeringAnnotationDraft {
  if (!base || base.drawingRef.drawingId !== projection.drawingRef.drawingId
    || base.drawingRef.revision !== projection.drawingRef.revision) return structuredClone(projection);

  const previousAxialIntentIds = new Set(
    base.axialScheme?.candidates.map(({ id }) => intentId(id)) ?? [],
  );
  const previousAxialChainIds = new Set(base.axialScheme?.chains.map(({ id }) => id) ?? []);
  const intents = mergeById(
    base.intents.filter(({ id }) => !previousAxialIntentIds.has(id)),
    projection.intents,
  );
  const intentIds = new Set(intents.map(({ id }) => id));
  const chains = mergeById(
    base.chains.filter(({ id }) => !previousAxialChainIds.has(id)),
    projection.chains,
  );
  const dependencies = mergeDependencies(
    base.dependencies.filter(({ beforeIntentId, afterIntentId }) => (
      !previousAxialIntentIds.has(beforeIntentId) || !previousAxialIntentIds.has(afterIntentId)
    )),
    projection.dependencies,
  ).filter(({ beforeIntentId, afterIntentId }) => intentIds.has(beforeIntentId) && intentIds.has(afterIntentId));

  return {
    ...structuredClone(projection),
    datums: structuredClone(base.datums),
    intents,
    tolerances: structuredClone(base.tolerances.filter(({ dimensionIntentId }) => intentIds.has(dimensionIntentId))),
    fitAssignments: structuredClone(base.fitAssignments),
    geometricTolerances: structuredClone(base.geometricTolerances),
    chains,
    dependencies,
    diagnostics: mergeById(base.diagnostics, projection.diagnostics),
    ...('id' in base ? { baseRevisionId: base.id }
      : base.baseRevisionId === undefined ? {} : { baseRevisionId: base.baseRevisionId }),
  };
}

function mergeById<T extends { id: string }>(base: readonly T[], replacement: readonly T[]): T[] {
  const values = new Map(base.map((item) => [item.id, structuredClone(item)]));
  for (const item of replacement) values.set(item.id, structuredClone(item));
  return [...values.values()];
}

function mergeDependencies(
  base: readonly AnnotationDependency[],
  replacement: readonly AnnotationDependency[],
): AnnotationDependency[] {
  const key = ({ beforeIntentId, afterIntentId, reason }: AnnotationDependency) => (
    `${beforeIntentId}\u0000${afterIntentId}\u0000${reason}`
  );
  const values = new Map(base.map((item) => [key(item), structuredClone(item)]));
  for (const item of replacement) values.set(key(item), structuredClone(item));
  return [...values.values()];
}

function projectIntent(candidate: AxialDimensionCandidate, scheme: AxialDimensionScheme): DimensionIntent {
  const start = scheme.topology.stations.find(({ id }) => id === candidate.startStationId);
  const end = scheme.topology.stations.find(({ id }) => id === candidate.endStationId);
  if (!start || !end) throw new Error('DIMENSION_STATION_UNRESOLVED');
  const fallback = scheme.topology.axis.geometryNodeIds?.[0];
  const startGeometryId = start.geometryNodeIds[0] ?? fallback;
  const endGeometryId = end.geometryNodeIds[0] ?? fallback;
  if (!startGeometryId || !endGeometryId) throw new Error('DIMENSION_TARGET_STALE');
  const closure = scheme.closureCandidateIds.includes(candidate.id);
  return {
    id: intentId(candidate.id),
    drawingRef: scheme.drawingRef,
    kind: 'linear',
    targets: [
      { geometryId: startGeometryId as GeometryId, anchor: { kind: 'nearest', point: worldPoint(scheme, start.sourceCoordinate) } },
      { geometryId: endGeometryId as GeometryId, anchor: { kind: 'nearest', point: worldPoint(scheme, end.sourceCoordinate) } },
    ],
    datumIds: [],
    nominalValue: candidate.nominalValue,
    unit: scheme.topology.unit,
    functionalRole: closure ? 'closure' : functionalRole(candidate),
    source: 'geometry',
    status: scheme.status === 'conflict' || scheme.status === 'stale' ? scheme.status : 'resolved',
    evidenceIds: [...candidate.evidenceIds],
  };
}

function projectChain(
  chain: AxialDimensionScheme['chains'][number],
  scheme: AxialDimensionScheme,
  intentByCandidate: ReadonlyMap<string, string>,
): DimensionChain {
  const parentIntentId = requireIntent(intentByCandidate, chain.parentCandidateId);
  const closureIntentId = requireIntent(intentByCandidate, chain.closureCandidateId);
  return {
    id: chain.id,
    drawingRef: scheme.drawingRef,
    name: axialChainName(chain, scheme),
    datumIds: [],
    members: [
      { dimensionIntentId: parentIntentId, coefficient: 1, role: 'functional', sequenceHint: 0 },
      ...chain.childCandidateIds.map((candidateId, index) => ({
        dimensionIntentId: requireIntent(intentByCandidate, candidateId), coefficient: -1 as const,
        role: 'component' as const, sequenceHint: index + 1,
      })),
      { dimensionIntentId: closureIntentId, coefficient: -1, role: 'closure', sequenceHint: chain.childCandidateIds.length + 1 },
    ],
    equation: { closureIntentId, targetValue: 0 },
    analysisMode: 'reference-only',
    status: chain.status === 'conflict' ? 'conflict' : chain.status === 'needs-review' ? 'candidate' : 'resolved',
    evidenceIds: unique([
      ...requireCandidate(new Map(scheme.candidates.map((candidate) => [candidate.id, candidate])), chain.parentCandidateId).evidenceIds,
      ...chain.childCandidateIds.flatMap((id) => requireCandidate(new Map(scheme.candidates.map((candidate) => [candidate.id, candidate])), id).evidenceIds),
    ]),
    diagnostics: scheme.diagnostics.filter(({ entityIds }) => entityIds?.includes(chain.id)),
  };
}

function projectDependencies(
  scheme: AxialDimensionScheme,
  intentByCandidate: ReadonlyMap<string, string>,
): AnnotationDependency[] {
  const dependencies: AnnotationDependency[] = [];
  for (const chain of scheme.chains) {
    const parentIntentId = requireIntent(intentByCandidate, chain.parentCandidateId);
    const closureIntentId = requireIntent(intentByCandidate, chain.closureCandidateId);
    for (const childCandidateId of chain.childCandidateIds) {
      const childIntentId = requireIntent(intentByCandidate, childCandidateId);
      dependencies.push({
        beforeIntentId: parentIntentId,
        afterIntentId: childIntentId,
        reason: 'functional-before-component',
        evidenceIds: [chain.id],
      }, {
        beforeIntentId: childIntentId,
        afterIntentId: closureIntentId,
        reason: 'component-before-closure',
        evidenceIds: [chain.id],
      });
    }
  }
  return [...new Map(dependencies.map((item) => [`${item.beforeIntentId}:${item.afterIntentId}`, item])).values()];
}

function functionalRole(candidate: AxialDimensionCandidate): DimensionFunctionalRole {
  if (candidate.roles.includes('overall')) return 'overall';
  if (candidate.roles.includes('functional')) return 'functional';
  if (candidate.roles.includes('composite')) return 'assembly';
  return 'process';
}

function worldPoint(scheme: AxialDimensionScheme, sourceCoordinate: number): Vec2 {
  const { origin, direction } = scheme.topology.axis;
  return [origin[0] + direction[0] * sourceCoordinate, origin[1] + direction[1] * sourceCoordinate];
}

function axialChainName(chain: AxialDimensionScheme['chains'][number], scheme: AxialDimensionScheme): string {
  const parent = scheme.candidates.find(({ id }) => id === chain.parentCandidateId)!;
  return `轴向尺寸链 ${format(parent.nominalValue)} ${scheme.topology.unit}`;
}

function intentId(candidateId: string): string { return `dimension-intent:${candidateId}`; }
function requireIntent(values: ReadonlyMap<string, string>, candidateId: string): string {
  const value = values.get(candidateId);
  if (!value) throw new Error('DIMENSION_CHAIN_MEMBER_UNKNOWN');
  return value;
}
function requireCandidate(values: ReadonlyMap<string, AxialDimensionCandidate>, id: string): AxialDimensionCandidate {
  const value = values.get(id);
  if (!value) throw new Error('DIMENSION_CHAIN_MEMBER_UNKNOWN');
  return value;
}
function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
function format(value: number): string { return Number(value.toFixed(6)).toString(); }
