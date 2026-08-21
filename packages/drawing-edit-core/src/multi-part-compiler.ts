// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';
import type {
  Diagnostic,
  DrawingRef,
  DrawingTransactionCommand,
  SpatialEditProgram,
} from '@vectorai/drawing-edit-protocol';

import { canonicalSemanticString, canonicalString } from './canonical';
import {
  compileSpatialEditProgram,
  type ActualEffect,
  type EditCorePorts,
  type GroundedEditTarget,
  type SpatialCompilation,
} from './compiler';
import { applyDrawingTransaction, findDrawingNode } from './document-transaction';
import { invertDrawingTransaction } from './inverse';

export interface MultiPartGroundedTransform {
  groundingId: string;
  grounding: GroundedEditTarget;
  translation: Vec2;
  rotationRadians?: number;
  pivot?: Vec2;
}

export interface MultiPartSpatialCompilationInput {
  document: DrawingDocument;
  baseRef: DrawingRef;
  objective: string;
  summary: string;
  parts: MultiPartGroundedTransform[];
  ports: EditCorePorts;
}

export function compileMultiPartTransform(
  input: MultiPartSpatialCompilationInput,
): SpatialCompilation {
  if (input.baseRef.drawingId !== input.document.id) throw new Error('EDIT_DRAWING_MISMATCH');
  if (input.parts.length < 2 || input.parts.length > 16) throw new Error('EDIT_PART_COUNT_INVALID');
  assertPartScopes(input.document, input.parts);

  const initial = structuredClone(input.document);
  let working = structuredClone(input.document);
  const forward: DrawingTransactionCommand[] = [];
  const diagnostics: Diagnostic[] = [];
  const effects: ActualEffect[] = [];

  for (const part of input.parts) {
    const compiled = compileSpatialEditProgram({
      document: working,
      program: programForPart(input, part),
      grounding: part.grounding,
      ports: input.ports,
    });
    working = compiled.candidate;
    forward.push(...compiled.forward);
    diagnostics.push(...compiled.diagnostics);
    effects.push(compiled.actualEffect);
  }

  const inverse = invertDrawingTransaction(initial, forward);
  const restored = applyDrawingTransaction(working, inverse, input.ports.now());
  if (canonicalSemanticString(restored) !== canonicalSemanticString(initial)) {
    throw new Error('EDIT_INVERSE_VERIFICATION_FAILED');
  }

  const actualEffect = mergeEffects(effects);
  const effectDigest = input.ports.digest(canonicalString(actualEffect));
  const semanticParts = input.parts.map((part) => ({
    translation: structuredClone(part.translation),
    ...(part.rotationRadians === undefined ? {} : {
      rotationRadians: part.rotationRadians,
      pivot: structuredClone(part.pivot),
    }),
    targetScope: [...part.grounding.targetNodeIds].sort(),
    interfaceScopes: part.grounding.interfaces
      .map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
      .sort((left, right) => left.interfaceId.localeCompare(right.interfaceId)),
  }));
  const candidateDigest = input.ports.digest(canonicalString({
    baseRef: input.baseRef,
    resultingSemanticDocument: JSON.parse(canonicalSemanticString(working)),
    effectDigest,
    forward,
    inverse,
    parts: semanticParts,
  }));
  const semanticRiskKey = input.ports.digest(canonicalString({
    baseRef: input.baseRef,
    resultingSemanticDigest: input.ports.digest(canonicalSemanticString(working)),
    effectDigest,
    authoritativeObjective: input.objective,
    partScopes: semanticParts.map(({ targetScope, interfaceScopes }) => ({ targetScope, interfaceScopes })),
  }));

  return {
    forward,
    inverse,
    candidate: working,
    actualEffect,
    diagnostics,
    candidateDigest,
    effectDigest,
    semanticRiskKey,
  };
}

function assertPartScopes(
  document: DrawingDocument,
  parts: readonly MultiPartGroundedTransform[],
): void {
  const groundingIds = new Set<string>();
  const targetNodeIds = new Set<string>();
  const endpointSlots = new Set<string>();
  for (const part of parts) {
    if (groundingIds.has(part.groundingId)) throw new Error('EDIT_GROUNDING_DUPLICATE');
    groundingIds.add(part.groundingId);
    if ((part.rotationRadians === undefined) !== (part.pivot === undefined)) {
      throw new Error('EDIT_ROTATION_PIVOT_PAIR_REQUIRED');
    }
    if (![...part.translation, ...(part.pivot ?? []), part.rotationRadians ?? 0].every(Number.isFinite)) {
      throw new Error('EDIT_TRANSFORM_INVALID');
    }
    for (const nodeId of part.grounding.targetNodeIds) {
      if (!findDrawingNode(document, nodeId)) throw new Error('EDIT_TARGET_UNRESOLVED');
      if (targetNodeIds.has(nodeId)) throw new Error('EDIT_PART_TARGET_OVERLAP');
      targetNodeIds.add(nodeId);
    }
    for (const port of part.grounding.interfaces) {
      if (!port.endpoint || !findDrawingNode(document, port.nodeId)) {
        throw new Error('EDIT_INTERFACE_UNRESOLVED');
      }
      const slot = `${port.nodeId}:${port.endpoint}`;
      if (endpointSlots.has(slot)) throw new Error('EDIT_PART_INTERFACE_CONFLICT');
      endpointSlots.add(slot);
    }
  }
}

function programForPart(
  input: MultiPartSpatialCompilationInput,
  part: MultiPartGroundedTransform,
): SpatialEditProgram {
  const target = part.grounding.targetNodeIds.length === 1
    ? findDrawingNode(input.document, part.grounding.targetNodeIds[0]!)
    : null;
  const connectedCarrier = target?.plane === 'geometry'
    && (target.node.type === 'circle' || target.node.type === 'ellipse');
  const connected = connectedCarrier || part.grounding.interfaces.length > 0;
  const operation: SpatialEditProgram['operations'][number] = connected
    ? {
        kind: 'connected_transform',
        translation: [...part.translation] as [number, number],
        ...(part.rotationRadians === undefined && connectedCarrier
          ? {}
          : {
              rotationRadians: part.rotationRadians ?? 0,
              pivot: [...(part.pivot ?? [0, 0])] as [number, number],
            }),
        interfaceIds: part.grounding.interfaces.map(({ interfaceId }) => interfaceId),
      }
    : {
        kind: 'rigid_transform',
        translation: [...part.translation] as [number, number],
        rotationRadians: part.rotationRadians ?? 0,
        pivot: [...(part.pivot ?? [0, 0])] as [number, number],
      };
  return {
    baseRef: structuredClone(input.baseRef),
    targetHandle: part.grounding.targetHandle,
    summary: input.summary,
    objective: input.objective,
    operations: [operation],
    preserveScopes: [],
    postconditions: [],
    evidenceRefs: [`grounding:${part.groundingId}`],
  };
}

function mergeEffects(effects: readonly ActualEffect[]): ActualEffect {
  const createdNodeIds = new Set<string>();
  const updatedNodeIds = new Set<string>();
  const deletedNodeIds = new Set<string>();
  const changedFields = new Map<string, Set<string>>();
  for (const effect of effects) {
    effect.createdNodeIds.forEach((id) => createdNodeIds.add(id));
    effect.updatedNodeIds.forEach((id) => updatedNodeIds.add(id));
    effect.deletedNodeIds.forEach((id) => deletedNodeIds.add(id));
    for (const [id, fields] of Object.entries(effect.changedFields)) {
      const aggregate = changedFields.get(id) ?? new Set<string>();
      fields.forEach((field) => aggregate.add(field));
      changedFields.set(id, aggregate);
    }
  }
  return {
    createdNodeIds: [...createdNodeIds].sort(),
    updatedNodeIds: [...updatedNodeIds].sort(),
    deletedNodeIds: [...deletedNodeIds].sort(),
    changedFields: Object.fromEntries([...changedFields.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, fields]) => [id, [...fields].sort()])),
  };
}
