// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type {
  DrawingRef,
  ExplicitNumericConstraint,
  SpatialGoal,
  SpatialIntentRequest,
  SpatialReference,
} from '@vectorai/drawing-edit-protocol';

import { canonicalString } from './canonical';
import {
  compileSpatialEditProgram,
  type EditCorePorts,
  type GroundedEditTarget,
  type SpatialCompilation,
} from './compiler';
import { compileMultiPartTransform } from './multi-part-compiler';

const MAGNITUDE_RATIO = {
  minimum: 0.02,
  slight: 0.05,
  moderate: 0.12,
  strong: 0.22,
} as const;
const SOLVER_VERSION = 'spatial-intent-solver-0.1.0' as const;
const MAX_CANDIDATES = 256;
const EPSILON = 1e-7;

interface SolvedTransform {
  partKey: string;
  translation: Vec2;
  rotationRadians?: number;
}

export interface SpatialSolverReceipt {
  version: typeof SOLVER_VERSION;
  candidateCount: number;
  selectedRank: number;
  goalResidual: number;
  movementCost: number;
  deformationCost: number;
  collisionPenalty: number;
  topologyPenalty: number;
  solvedTransforms: SolvedTransform[];
  inputsContainModelCoordinates: false;
}

export interface SpatialIntentSolverInput {
  document: DrawingDocument;
  baseRef: DrawingRef;
  parts: Record<string, GroundedEditTarget>;
  intent: SpatialIntentRequest;
  numericConstraints: ExplicitNumericConstraint[];
  ports: EditCorePorts;
  resolvedReferences?: Record<string, Vec2>;
}

export type SpatialIntentSolution = SpatialCompilation & { solver: SpatialSolverReceipt };

interface TransformState {
  translation: [number, number];
  rotationRadians?: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ScoredCandidate {
  compilation: SpatialCompilation;
  transforms: Record<string, TransformState>;
  goalResidual: number;
  movementCost: number;
  deformationCost: number;
  collisionPenalty: number;
  topologyPenalty: number;
  key: string;
}

export function solveSpatialIntent(input: SpatialIntentSolverInput): SpatialIntentSolution {
  validateInput(input);
  const scale = drawingDiagonal(input.document);
  const primary = solvePrimaryTransforms(input, scale);
  const candidates = generateCandidateTransforms(input, primary, scale).slice(0, MAX_CANDIDATES);
  const viable: ScoredCandidate[] = [];

  for (const transforms of candidates) {
    try {
      const compilation = compileTransforms(input, transforms);
      const topologyPenalty = topologyPenaltyFor(input, compilation.candidate);
      const collisionPenalty = collisionPenaltyFor(input, compilation.candidate);
      if (topologyPenalty > EPSILON || collisionPenalty > EPSILON) continue;
      assertProtectedScope(input, compilation.candidate);
      viable.push({
        compilation,
        transforms,
        goalResidual: goalResidualFor(input, compilation.candidate, transforms, scale),
        movementCost: movementCostFor(transforms, scale),
        deformationCost: deformationCostFor(transforms),
        collisionPenalty,
        topologyPenalty,
        key: canonicalString(canonicalTransforms(transforms)),
      });
    } catch {
      // A failed candidate never mutates the canonical input and is not eligible for ranking.
    }
  }

  viable.sort((left, right) => left.goalResidual - right.goalResidual
    || left.collisionPenalty - right.collisionPenalty
    || left.topologyPenalty - right.topologyPenalty
    || left.movementCost - right.movementCost
    || left.deformationCost - right.deformationCost
    || left.key.localeCompare(right.key));
  const selected = viable[0];
  if (!selected || selected.goalResidual > 1e-5) throw new Error('EDIT_SPATIAL_NO_SOLUTION');

  return {
    ...selected.compilation,
    solver: {
      version: SOLVER_VERSION,
      candidateCount: candidates.length,
      selectedRank: 0,
      goalResidual: selected.goalResidual,
      movementCost: selected.movementCost,
      deformationCost: selected.deformationCost,
      collisionPenalty: selected.collisionPenalty,
      topologyPenalty: selected.topologyPenalty,
      solvedTransforms: canonicalTransforms(selected.transforms),
      inputsContainModelCoordinates: false,
    },
  };
}

function validateInput(input: SpatialIntentSolverInput): void {
  if (input.baseRef.drawingId !== input.document.id) throw new Error('EDIT_DRAWING_MISMATCH');
  const partKeys = Object.keys(input.parts);
  if (partKeys.length < 1 || partKeys.length > 16) throw new Error('EDIT_PART_COUNT_INVALID');
  for (const goal of input.intent.goals) {
    if (!input.parts[goal.subject]) throw new Error('EDIT_PART_UNRESOLVED');
    if ('reference' in goal && goal.reference.kind === 'part' && !input.parts[goal.reference.partKey]) {
      throw new Error('EDIT_REFERENCE_UNRESOLVED');
    }
    if (goal.kind === 'explicit_numeric' && !input.numericConstraints.some(({ numericKey }) => numericKey === goal.numericKey)) {
      throw new Error('EDIT_NUMERIC_EVIDENCE_MISSING');
    }
  }
  for (const target of Object.values(input.parts)) {
    if (target.targetNodeIds.length === 0) throw new Error('EDIT_TARGET_UNRESOLVED');
    for (const nodeId of target.targetNodeIds) {
      if (!input.document.geometry.some(({ id }) => String(id) === nodeId)) throw new Error('EDIT_TARGET_UNRESOLVED');
    }
  }
}

function solvePrimaryTransforms(
  input: SpatialIntentSolverInput,
  scale: number,
): Record<string, TransformState> {
  const transforms: Record<string, TransformState> = Object.fromEntries(Object.keys(input.parts).sort().map((partKey) => [
    partKey, { translation: [0, 0] as [number, number] },
  ]));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const goal of input.intent.goals) applyGoal(input, transforms, goal, scale);
  }
  for (const transform of Object.values(transforms)) {
    if (![...transform.translation, transform.rotationRadians ?? 0].every(Number.isFinite)) {
      throw new Error('EDIT_SPATIAL_MATH_INVALID');
    }
  }
  return transforms;
}

function applyGoal(
  input: SpatialIntentSolverInput,
  transforms: Record<string, TransformState>,
  goal: SpatialGoal,
  scale: number,
): void {
  const transform = transforms[goal.subject]!;
  const subject = transformedPartGeometry(input, goal.subject, transforms);
  if (goal.kind === 'direction') {
    const amount = scale * MAGNITUDE_RATIO[goal.magnitude];
    if (goal.direction === 'up') transform.translation[1] = amount;
    if (goal.direction === 'down') transform.translation[1] = -amount;
    if (goal.direction === 'left') transform.translation[0] = -amount;
    if (goal.direction === 'right') transform.translation[0] = amount;
    return;
  }
  if (goal.kind === 'explicit_numeric') {
    applyNumericGoal(input, transforms, goal);
    return;
  }
  const reference = referenceGeometry(input, goal.reference, transforms);
  if (goal.kind === 'alignment') {
    let coupledX = false;
    let coupledY = false;
    if (goal.reference.kind === 'part') {
      const referenceTransform = transforms[goal.reference.partKey]!;
      const referenceOriginal = originalPartGeometry(input, goal.reference.partKey);
      if ((goal.axis === 'y' || goal.axis === 'both')
        && hasDirectionalGoal(input, goal.subject, 'down')
        && hasDirectionalGoal(input, goal.reference.partKey, 'down')) {
        const targetY = Math.min(subject.center[1], reference.center[1]);
        transform.translation[1] = targetY - originalPartGeometry(input, goal.subject).center[1];
        referenceTransform.translation[1] = targetY - referenceOriginal.center[1];
        coupledY = true;
      }
      if ((goal.axis === 'x' || goal.axis === 'both')
        && hasDirectionalGoal(input, goal.subject, 'left')
        && hasDirectionalGoal(input, goal.reference.partKey, 'left')) {
        const targetX = Math.min(subject.center[0], reference.center[0]);
        transform.translation[0] = targetX - originalPartGeometry(input, goal.subject).center[0];
        referenceTransform.translation[0] = targetX - referenceOriginal.center[0];
        coupledX = true;
      }
    }
    if (!coupledX && (goal.axis === 'x' || goal.axis === 'both')) {
      transform.translation[0] += reference.center[0] - subject.center[0];
    }
    if (!coupledY && (goal.axis === 'y' || goal.axis === 'both')) {
      transform.translation[1] += reference.center[1] - subject.center[1];
    }
    return;
  }
  if (goal.kind === 'relative_position') {
    const gap = scale * MAGNITUDE_RATIO[goal.magnitude];
    if (goal.relation === 'above') transform.translation[1] += reference.bounds.maxY + gap - subject.bounds.minY;
    if (goal.relation === 'below') transform.translation[1] += reference.bounds.minY - gap - subject.bounds.maxY;
    if (goal.relation === 'left_of') transform.translation[0] += reference.bounds.minX - gap - subject.bounds.maxX;
    if (goal.relation === 'right_of') transform.translation[0] += reference.bounds.maxX + gap - subject.bounds.minX;
    if (goal.relation === 'centered') {
      transform.translation[0] += reference.center[0] - subject.center[0];
      transform.translation[1] += reference.center[1] - subject.center[1];
    }
    if (goal.relation === 'near' || goal.relation === 'far') {
      const dx = subject.center[0] - reference.center[0];
      const dy = subject.center[1] - reference.center[1];
      const distance = Math.hypot(dx, dy) || 1;
      const targetDistance = goal.relation === 'near' ? gap : gap + scale * 0.5;
      transform.translation[0] += dx / distance * targetDistance - dx;
      transform.translation[1] += dy / distance * targetDistance - dy;
    }
    return;
  }
  applyTopologySeed(input, transforms, goal, scale);
}

function hasDirectionalGoal(
  input: SpatialIntentSolverInput,
  partKey: string,
  direction: Extract<SpatialGoal, { kind: 'direction' }>['direction'],
): boolean {
  return input.intent.goals.some((goal) => goal.kind === 'direction'
    && goal.subject === partKey && goal.direction === direction);
}

function applyNumericGoal(
  input: SpatialIntentSolverInput,
  transforms: Record<string, TransformState>,
  goal: Extract<SpatialGoal, { kind: 'explicit_numeric' }>,
): void {
  const constraint = input.numericConstraints.find(({ numericKey }) => numericKey === goal.numericKey);
  if (!constraint) throw new Error('EDIT_NUMERIC_EVIDENCE_MISSING');
  const transform = transforms[goal.subject]!;
  if (goal.quantity === 'angle') {
    if (constraint.kind !== 'angle' || Array.isArray(constraint.value)) throw new Error('EDIT_NUMERIC_KIND_MISMATCH');
    transform.rotationRadians = angleRadians(constraint.value, constraint.unit);
    return;
  }
  if (constraint.kind === 'coordinate' || Array.isArray(constraint.value)) throw new Error('EDIT_NUMERIC_KIND_MISMATCH');
  const value = distanceInDrawingUnits(constraint.value, constraint.unit, input.document.unitSystem.length);
  const original = originalPartGeometry(input, goal.subject);
  if (goal.quantity === 'delta_x') transform.translation[0] = value;
  if (goal.quantity === 'delta_y') transform.translation[1] = value;
  if (goal.quantity === 'target_x') transform.translation[0] = value - original.center[0];
  if (goal.quantity === 'target_y') transform.translation[1] = value - original.center[1];
  if (goal.quantity === 'distance') {
    const direction = input.intent.goals.find((candidate): candidate is Extract<SpatialGoal, { kind: 'direction' }> => (
      candidate.kind === 'direction' && candidate.subject === goal.subject
    ));
    if (!direction) throw new Error('EDIT_NUMERIC_DIRECTION_REQUIRED');
    transform.translation = direction.direction === 'up' ? [0, value]
      : direction.direction === 'down' ? [0, -value]
        : direction.direction === 'left' ? [-value, 0] : [value, 0];
  }
}

function applyTopologySeed(
  input: SpatialIntentSolverInput,
  transforms: Record<string, TransformState>,
  goal: Extract<SpatialGoal, { kind: 'topology' }>,
  scale: number,
): void {
  const transform = transforms[goal.subject]!;
  const subject = transformedPartGeometry(input, goal.subject, transforms);
  const reference = referenceGeometry(input, goal.reference, transforms);
  if (goal.relation === 'touches') {
    transform.translation[0] += reference.bounds.minX - subject.bounds.maxX;
    transform.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === 'crosses') {
    transform.translation[0] += reference.center[0] - subject.center[0];
    transform.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === 'does_not_cross' && topologyRelation(input.document, input.parts[goal.subject]!, goal.reference, input.parts, 'crosses')) {
    transform.translation[1] += reference.bounds.maxY - subject.bounds.minY + scale * MAGNITUDE_RATIO.minimum;
  }
  if (goal.relation === 'inside') {
    transform.translation[0] += reference.center[0] - subject.center[0];
    transform.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === 'outside') {
    transform.translation[0] += reference.bounds.maxX - subject.bounds.minX + scale * MAGNITUDE_RATIO.minimum;
  }
}

function generateCandidateTransforms(
  input: SpatialIntentSolverInput,
  primary: Record<string, TransformState>,
  scale: number,
): Array<Record<string, TransformState>> {
  const candidates = new Map<string, Record<string, TransformState>>();
  const add = (candidate: Record<string, TransformState>) => {
    const cloned = structuredClone(candidate);
    candidates.set(canonicalString(canonicalTransforms(cloned)), cloned);
  };
  add(primary);
  const neighborhood = scale * MAGNITUDE_RATIO.minimum;
  for (const partKey of Object.keys(primary).sort()) {
    const exactX = hasExactAxis(input, partKey, 'x');
    const exactY = hasExactAxis(input, partKey, 'y');
    for (const [dx, dy] of [[-neighborhood, 0], [neighborhood, 0], [0, -neighborhood], [0, neighborhood]] as const) {
      if (dx !== 0 && exactX || dy !== 0 && exactY) continue;
      const candidate = structuredClone(primary);
      candidate[partKey]!.translation[0] += dx;
      candidate[partKey]!.translation[1] += dy;
      add(candidate);
    }
  }
  for (const goal of input.intent.goals) {
    if (goal.kind !== 'topology' || goal.relation !== 'touches') continue;
    const reference = referenceGeometry(input, goal.reference, primary);
    const subject = transformedPartGeometry(input, goal.subject, primary);
    const original = originalPartGeometry(input, goal.subject);
    const placements: Vec2[] = [
      [reference.bounds.maxX + subject.width / 2, reference.center[1]],
      [reference.center[0], reference.bounds.minY - subject.height / 2],
      [reference.center[0], reference.bounds.maxY + subject.height / 2],
    ];
    for (const center of placements) {
      const candidate = structuredClone(primary);
      candidate[goal.subject]!.translation = [center[0] - original.center[0], center[1] - original.center[1]];
      add(candidate);
    }
  }
  return [...candidates.values()]
    .sort((left, right) => canonicalString(canonicalTransforms(left)).localeCompare(canonicalString(canonicalTransforms(right))))
    .slice(0, MAX_CANDIDATES);
}

function hasExactAxis(input: SpatialIntentSolverInput, partKey: string, axis: 'x' | 'y'): boolean {
  return input.intent.goals.some((goal) => goal.kind === 'explicit_numeric'
    && goal.subject === partKey
    && (axis === 'x'
      ? goal.quantity === 'delta_x' || goal.quantity === 'target_x' || goal.quantity === 'distance'
      : goal.quantity === 'delta_y' || goal.quantity === 'target_y' || goal.quantity === 'distance'));
}

function compileTransforms(
  input: SpatialIntentSolverInput,
  transforms: Record<string, TransformState>,
): SpatialCompilation {
  const changed = Object.keys(transforms).sort().filter((partKey) => {
    const transform = transforms[partKey]!;
    return Math.hypot(...transform.translation) > EPSILON || Math.abs(transform.rotationRadians ?? 0) > EPSILON;
  });
  if (changed.length === 0) throw new Error('EDIT_NO_EFFECT');
  if (changed.length === 1) {
    const partKey = changed[0]!;
    const transform = transforms[partKey]!;
    const grounding = input.parts[partKey]!;
    const pivot = originalPartGeometry(input, partKey).center;
    const connected = grounding.interfaces.length > 0 || grounding.targetNodeIds.some((nodeId) => {
      const node = input.document.geometry.find(({ id }) => String(id) === nodeId);
      return node?.type === 'circle' || node?.type === 'ellipse';
    });
    return compileSpatialEditProgram({
      document: input.document,
      grounding,
      ports: input.ports,
      program: {
        baseRef: input.baseRef,
        targetHandle: grounding.targetHandle,
        summary: input.intent.summary,
        objective: input.intent.summary,
        operations: [connected ? {
          kind: 'connected_transform',
          translation: transform.translation,
          ...(transform.rotationRadians === undefined ? {} : {
            rotationRadians: transform.rotationRadians,
            pivot: [pivot[0], pivot[1]],
          }),
          interfaceIds: grounding.interfaces.map(({ interfaceId }) => interfaceId),
        } : {
          kind: 'rigid_transform',
          translation: transform.translation,
          rotationRadians: transform.rotationRadians ?? 0,
          pivot: [pivot[0], pivot[1]],
        }],
        preserveScopes: [],
        postconditions: [],
        evidenceRefs: [`semantic-part:${partKey}`],
      },
    });
  }
  return compileMultiPartTransform({
    document: input.document,
    baseRef: input.baseRef,
    objective: input.intent.summary,
    summary: input.intent.summary,
    parts: changed.map((partKey) => {
      const transform = transforms[partKey]!;
      return {
        groundingId: `semantic-part:${partKey}`,
        grounding: input.parts[partKey]!,
        translation: transform.translation,
        ...(transform.rotationRadians === undefined ? {} : {
          rotationRadians: transform.rotationRadians,
          pivot: originalPartGeometry(input, partKey).center,
        }),
      };
    }),
    ports: input.ports,
  });
}

function goalResidualFor(
  input: SpatialIntentSolverInput,
  candidate: DrawingDocument,
  transforms: Record<string, TransformState>,
  scale: number,
): number {
  let residual = 0;
  for (const goal of input.intent.goals) {
    const subject = partGeometry(candidate, input.parts[goal.subject]!);
    if (goal.kind === 'direction') {
      const desired = scale * MAGNITUDE_RATIO[goal.magnitude];
      const transform = transforms[goal.subject]!;
      const actual = goal.direction === 'up' ? transform.translation[1]
        : goal.direction === 'down' ? -transform.translation[1]
          : goal.direction === 'left' ? -transform.translation[0] : transform.translation[0];
      residual += Math.max(0, desired - actual) / scale + (actual < 0 ? 1 : 0);
      continue;
    }
    if (goal.kind === 'explicit_numeric') {
      const expected = input.numericConstraints.find(({ numericKey }) => numericKey === goal.numericKey)!;
      const original = originalPartGeometry(input, goal.subject);
      if (goal.quantity === 'angle') {
        const value = Array.isArray(expected.value) ? Number.NaN : angleRadians(expected.value, expected.unit);
        residual += Math.abs((transforms[goal.subject]!.rotationRadians ?? 0) - value);
      } else if (!Array.isArray(expected.value)) {
        const value = distanceInDrawingUnits(expected.value, expected.unit, input.document.unitSystem.length);
        const actual = goal.quantity === 'delta_x' ? subject.center[0] - original.center[0]
          : goal.quantity === 'delta_y' ? subject.center[1] - original.center[1]
            : goal.quantity === 'target_x' ? subject.center[0]
              : goal.quantity === 'target_y' ? subject.center[1]
                : Math.hypot(subject.center[0] - original.center[0], subject.center[1] - original.center[1]);
        residual += Math.abs(actual - value) / scale;
      }
      continue;
    }
    const reference = referenceGeometryInCandidate(input, candidate, goal.reference);
    if (goal.kind === 'alignment') {
      if (goal.axis === 'x' || goal.axis === 'both') residual += Math.abs(subject.center[0] - reference.center[0]) / scale;
      if (goal.axis === 'y' || goal.axis === 'both') residual += Math.abs(subject.center[1] - reference.center[1]) / scale;
    } else if (goal.kind === 'relative_position') {
      if (goal.relation === 'above') residual += Math.max(0, reference.bounds.maxY - subject.bounds.minY) / scale;
      if (goal.relation === 'below') residual += Math.max(0, subject.bounds.maxY - reference.bounds.minY) / scale;
      if (goal.relation === 'left_of') residual += Math.max(0, subject.bounds.maxX - reference.bounds.minX) / scale;
      if (goal.relation === 'right_of') residual += Math.max(0, reference.bounds.maxX - subject.bounds.minX) / scale;
      if (goal.relation === 'centered') residual += Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1]) / scale;
      if (goal.relation === 'near') residual += Math.max(0, Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1]) - scale * 0.25) / scale;
      if (goal.relation === 'far') residual += Math.max(0, scale * 0.35 - Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1])) / scale;
    }
  }
  return residual + topologyPenaltyFor(input, candidate);
}

function topologyPenaltyFor(input: SpatialIntentSolverInput, candidate: DrawingDocument): number {
  let penalty = 0;
  for (const goal of input.intent.goals) {
    if (goal.kind !== 'topology') continue;
    const relation = topologyRelation(candidate, input.parts[goal.subject]!, goal.reference, input.parts, goal.relation);
    if (!relation) penalty += 1;
  }
  return penalty;
}

function topologyRelation(
  document: DrawingDocument,
  subject: GroundedEditTarget,
  reference: SpatialReference,
  parts: Record<string, GroundedEditTarget>,
  relation: Extract<SpatialGoal, { kind: 'topology' }>['relation'],
): boolean {
  if (reference.kind !== 'part') return false;
  const referencePart = parts[reference.partKey];
  if (!referencePart) return false;
  const subjectNodes = subject.targetNodeIds.flatMap((id) => document.geometry.filter((node) => String(node.id) === id));
  const referenceNodes = referencePart.targetNodeIds.flatMap((id) => document.geometry.filter((node) => String(node.id) === id));
  if (subjectNodes.length === 0 || referenceNodes.length === 0) return false;
  if (relation === 'crosses') return subjectNodes.some((left) => referenceNodes.some((right) => geometriesCross(left, right)));
  if (relation === 'does_not_cross') return !subjectNodes.some((left) => referenceNodes.some((right) => geometriesCross(left, right)));
  if (relation === 'touches') return subjectNodes.some((left) => referenceNodes.some((right) => geometriesTouch(left, right)));
  const subjectBounds = unionBounds(subjectNodes.map(boundsOfGeometry));
  const referenceBounds = unionBounds(referenceNodes.map(boundsOfGeometry));
  const inside = containsBounds(referenceBounds, subjectBounds);
  return relation === 'inside' ? inside : !inside;
}

function collisionPenaltyFor(input: SpatialIntentSolverInput, candidate: DrawingDocument): number {
  const partNodeIds = new Set(Object.values(input.parts).flatMap(({ targetNodeIds }) => targetNodeIds));
  const interfaceNodeIds = new Set(Object.values(input.parts).flatMap(({ interfaces }) => interfaces.map(({ nodeId }) => nodeId)));
  let penalty = 0;
  for (const [partKey, target] of Object.entries(input.parts)) {
    for (const targetId of target.targetNodeIds) {
      const beforeTarget = geometryById(input.document, targetId);
      const afterTarget = geometryById(candidate, targetId);
      if (!beforeTarget || !afterTarget) continue;
      for (const afterOther of candidate.geometry) {
        const otherId = String(afterOther.id);
        if (partNodeIds.has(otherId) || interfaceNodeIds.has(otherId) || otherId === targetId) continue;
        const beforeOther = geometryById(input.document, otherId);
        if (!beforeOther) continue;
        if (geometriesIntersect(afterTarget, afterOther) && !geometriesIntersect(beforeTarget, beforeOther)) penalty += 1;
      }
    }
    for (const [otherPartKey, other] of Object.entries(input.parts)) {
      if (partKey >= otherPartKey || topologyAllowsContact(input.intent.goals, partKey, otherPartKey)) continue;
      for (const leftId of target.targetNodeIds) for (const rightId of other.targetNodeIds) {
        const leftBefore = geometryById(input.document, leftId);
        const rightBefore = geometryById(input.document, rightId);
        const leftAfter = geometryById(candidate, leftId);
        const rightAfter = geometryById(candidate, rightId);
        if (leftBefore && rightBefore && leftAfter && rightAfter
          && geometriesIntersect(leftAfter, rightAfter) && !geometriesIntersect(leftBefore, rightBefore)) penalty += 1;
      }
    }
  }
  return penalty;
}

function topologyAllowsContact(goals: SpatialGoal[], left: string, right: string): boolean {
  return goals.some((goal) => goal.kind === 'topology'
    && goal.reference.kind === 'part'
    && ((goal.subject === left && goal.reference.partKey === right)
      || (goal.subject === right && goal.reference.partKey === left))
    && ['touches', 'crosses', 'inside'].includes(goal.relation));
}

function assertProtectedScope(input: SpatialIntentSolverInput, candidate: DrawingDocument): void {
  if (!input.intent.preserve.some(({ kind }) => kind === 'protected_scope')) return;
  const editable = new Set([
    ...Object.values(input.parts).flatMap(({ targetNodeIds }) => targetNodeIds),
    ...Object.values(input.parts).flatMap(({ interfaces }) => interfaces.map(({ nodeId }) => nodeId)),
  ]);
  for (const before of input.document.geometry) {
    if (editable.has(String(before.id))) continue;
    const after = candidate.geometry.find(({ id }) => id === before.id);
    if (!after || canonicalString(after) !== canonicalString(before)) throw new Error('EDIT_PROTECTED_SCOPE_CHANGED');
  }
}

function movementCostFor(transforms: Record<string, TransformState>, scale: number): number {
  return Object.values(transforms).reduce((sum, transform) => (
    sum + Math.hypot(...transform.translation) / scale + Math.abs(transform.rotationRadians ?? 0)
  ), 0);
}

function deformationCostFor(transforms: Record<string, TransformState>): number {
  return Object.values(transforms).reduce((sum, transform) => sum + Math.abs(transform.rotationRadians ?? 0), 0);
}

function canonicalTransforms(transforms: Record<string, TransformState>): SolvedTransform[] {
  return Object.keys(transforms).sort().map((partKey) => ({
    partKey,
    translation: [...transforms[partKey]!.translation],
    ...(transforms[partKey]!.rotationRadians === undefined ? {} : {
      rotationRadians: transforms[partKey]!.rotationRadians,
    }),
  }));
}

function originalPartGeometry(input: SpatialIntentSolverInput, partKey: string) {
  return partGeometry(input.document, input.parts[partKey]!);
}

function transformedPartGeometry(
  input: SpatialIntentSolverInput,
  partKey: string,
  transforms: Record<string, TransformState>,
) {
  const original = originalPartGeometry(input, partKey);
  const [dx, dy] = transforms[partKey]!.translation;
  return {
    center: [original.center[0] + dx, original.center[1] + dy] as Vec2,
    bounds: shiftBounds(original.bounds, dx, dy),
    width: original.width,
    height: original.height,
  };
}

function partGeometry(document: DrawingDocument, target: GroundedEditTarget) {
  const nodes = target.targetNodeIds.map((nodeId) => geometryById(document, nodeId)).filter((node): node is GeometryNode => Boolean(node));
  if (nodes.length === 0) throw new Error('EDIT_TARGET_UNRESOLVED');
  const bounds = unionBounds(nodes.map(boundsOfGeometry));
  return {
    bounds,
    center: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] as Vec2,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function referenceGeometry(
  input: SpatialIntentSolverInput,
  reference: SpatialReference,
  transforms: Record<string, TransformState>,
) {
  if (reference.kind === 'part') return transformedPartGeometry(input, reference.partKey, transforms);
  const point = referencePoint(input, reference);
  return { center: point, bounds: pointBounds(point), width: 0, height: 0 };
}

function referenceGeometryInCandidate(
  input: SpatialIntentSolverInput,
  candidate: DrawingDocument,
  reference: SpatialReference,
) {
  if (reference.kind === 'part') return partGeometry(candidate, input.parts[reference.partKey]!);
  const point = referencePoint(input, reference);
  return { center: point, bounds: pointBounds(point), width: 0, height: 0 };
}

function referencePoint(input: SpatialIntentSolverInput, reference: SpatialReference): Vec2 {
  const bounds = drawingBounds(input.document);
  if (reference.kind === 'drawing_anchor') {
    const center: Vec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
    if (reference.anchor === 'center') return center;
    if (reference.anchor === 'top') return [center[0], bounds.maxY];
    if (reference.anchor === 'bottom') return [center[0], bounds.minY];
    if (reference.anchor === 'left') return [bounds.minX, center[1]];
    return [bounds.maxX, center[1]];
  }
  if (reference.kind === 'part') throw new Error('EDIT_REFERENCE_UNRESOLVED');
  const key = reference.kind === 'semantic_anchor'
    ? `semantic:${reference.query}`
    : `observation:${reference.normalized[0]},${reference.normalized[1]}`;
  const point = input.resolvedReferences?.[key];
  if (!point || !point.every(Number.isFinite)) throw new Error('EDIT_REFERENCE_UNRESOLVED');
  return [...point];
}

function geometryById(document: DrawingDocument, nodeId: string): GeometryNode | undefined {
  return document.geometry.find(({ id }) => String(id) === nodeId);
}

function drawingBounds(document: DrawingDocument): Bounds {
  return unionBounds(document.geometry.filter(({ visible }) => visible).map(boundsOfGeometry));
}

function drawingDiagonal(document: DrawingDocument): number {
  const bounds = drawingBounds(document);
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (!Number.isFinite(diagonal) || diagonal <= EPSILON) return 1;
  return diagonal;
}

function boundsOfGeometry(node: GeometryNode): Bounds {
  if (node.type === 'point') return pointBounds([node.x, node.y]);
  if (node.type === 'circle' || node.type === 'arc') return {
    minX: node.center[0] - node.radius, minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius, maxY: node.center[1] + node.radius,
  };
  if (node.type === 'ellipse') {
    const major = Math.hypot(...node.majorAxis);
    return { minX: node.center[0] - major, minY: node.center[1] - major, maxX: node.center[0] + major, maxY: node.center[1] + major };
  }
  const points: Vec2[] = node.type === 'line' ? [node.start, node.end]
    : node.type === 'ray' || node.type === 'xline' ? [node.origin]
      : node.type === 'polyline' ? node.vertices.map(({ point }) => point)
        : node.controlPoints;
  return boundsOfPoints(points);
}

function boundsOfPoints(points: readonly Vec2[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function unionBounds(bounds: Bounds[]): Bounds {
  if (bounds.length === 0) throw new Error('EDIT_DRAWING_EMPTY');
  return {
    minX: Math.min(...bounds.map(({ minX }) => minX)), minY: Math.min(...bounds.map(({ minY }) => minY)),
    maxX: Math.max(...bounds.map(({ maxX }) => maxX)), maxY: Math.max(...bounds.map(({ maxY }) => maxY)),
  };
}

function pointBounds([x, y]: Vec2): Bounds {
  return { minX: x, minY: y, maxX: x, maxY: y };
}

function shiftBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return { minX: bounds.minX + dx, minY: bounds.minY + dy, maxX: bounds.maxX + dx, maxY: bounds.maxY + dy };
}

function containsBounds(outer: Bounds, inner: Bounds): boolean {
  return inner.minX >= outer.minX - EPSILON && inner.maxX <= outer.maxX + EPSILON
    && inner.minY >= outer.minY - EPSILON && inner.maxY <= outer.maxY + EPSILON;
}

function geometriesCross(left: GeometryNode, right: GeometryNode): boolean {
  if (left.type === 'line' && right.type === 'line') return segmentsIntersect(left.start, left.end, right.start, right.end, true);
  return geometriesIntersect(left, right);
}

function geometriesTouch(left: GeometryNode, right: GeometryNode): boolean {
  if (left.type === 'circle' && right.type === 'circle') {
    return Math.abs(Math.hypot(left.center[0] - right.center[0], left.center[1] - right.center[1]) - left.radius - right.radius) <= 1e-5;
  }
  return geometriesIntersect(left, right);
}

function geometriesIntersect(left: GeometryNode, right: GeometryNode): boolean {
  if (left.type === 'circle' && right.type === 'circle') {
    return Math.hypot(left.center[0] - right.center[0], left.center[1] - right.center[1]) <= left.radius + right.radius + EPSILON;
  }
  if (left.type === 'line' && right.type === 'line') return segmentsIntersect(left.start, left.end, right.start, right.end, false);
  if (left.type === 'circle' && right.type === 'line') return distanceToSegment(left.center, right.start, right.end) <= left.radius + EPSILON;
  if (left.type === 'line' && right.type === 'circle') return distanceToSegment(right.center, left.start, left.end) <= right.radius + EPSILON;
  const a = boundsOfGeometry(left);
  const b = boundsOfGeometry(right);
  return a.minX <= b.maxX + EPSILON && a.maxX + EPSILON >= b.minX
    && a.minY <= b.maxY + EPSILON && a.maxY + EPSILON >= b.minY;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2, proper: boolean): boolean {
  const cross = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return proper
    ? abC * abD < -EPSILON && cdA * cdB < -EPSILON
    : abC * abD <= EPSILON && cdA * cdB <= EPSILON
      && Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + EPSILON
      && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + EPSILON;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}

function distanceInDrawingUnits(value: number, unit: string, drawingUnit: 'mm' | 'cm' | 'm'): number {
  const millimeters = unit === 'mm' ? value : unit === 'cm' ? value * 10 : unit === 'm' ? value * 1_000 : unit === 'in' ? value * 25.4 : Number.NaN;
  if (!Number.isFinite(millimeters)) throw new Error('EDIT_NUMERIC_UNIT_UNSUPPORTED');
  return drawingUnit === 'mm' ? millimeters : drawingUnit === 'cm' ? millimeters / 10 : millimeters / 1_000;
}

function angleRadians(value: number, unit: string): number {
  if (unit === 'deg') return value * Math.PI / 180;
  if (unit === 'rad') return value;
  throw new Error('EDIT_NUMERIC_UNIT_UNSUPPORTED');
}
