// SPDX-License-Identifier: Apache-2.0

import { resolveTranslationMotionRig } from '@vectorai/drawing-edit-core';
import type {
  DrawingMotionRigDiscardResult,
  DrawingMotionRigProjection,
  DrawingMotionRigResult,
  DrawingWorkspaceRef,
} from '@vectorai/plugin-space-contracts';

import { InMemoryDrawingRepository } from './repository';

export type DrawingCreateMotionRigResult =
  | {
    state: 'ready';
    summary: string;
    controlNodeCount: number;
    connectorNodeCount: number;
  }
  | {
    state: 'needs_correction';
    summary: string;
    reason: string;
  }
  | {
    state: 'blocked';
    code: 'drawing_required' | 'unsupported_geometry' | 'ambiguous_topology';
    message: string;
  };

export class MotionRigService {
  readonly #rigs = new Map<string, DrawingMotionRigProjection>();

  constructor(private readonly drawings: InMemoryDrawingRepository) {}

  create(sessionId: string, semanticNodeIds: readonly string[]): DrawingCreateMotionRigResult {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return {
      state: 'blocked', code: 'drawing_required', message: 'No editable vector Drawing is loaded.',
    };
    try {
      const definition = resolveTranslationMotionRig(snapshot.document, semanticNodeIds);
      const projection: DrawingMotionRigProjection = {
        version: 1,
        drawingRef: structuredClone(snapshot.ref),
        state: 'ready',
        ...definition,
      };
      this.#rigs.set(sessionId, projection);
      return {
        state: 'ready',
        summary: 'Temporary movement constraint is ready.',
        controlNodeCount: projection.controlBodyNodeIds.length,
        connectorNodeCount: projection.connectors.length,
      };
    } catch (error) {
      return createFailure(error);
    }
  }

  current(sessionId: string): DrawingMotionRigProjection | null {
    const rig = this.#rigs.get(sessionId);
    if (!rig) return null;
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot || !sameRef(snapshot.ref, rig.drawingRef)) {
      this.#rigs.delete(sessionId);
      return null;
    }
    return structuredClone(rig);
  }

  rebuild(
    sessionId: string,
    expectedRef: DrawingWorkspaceRef,
    nodeIds: readonly string[],
  ): DrawingMotionRigResult {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: 'rejected', code: 'DRAWING_REQUIRED', message: 'No Drawing is loaded.' };
    if (!sameRef(snapshot.ref, expectedRef)) return {
      status: 'stale', currentRef: structuredClone(snapshot.ref),
    };
    try {
      const definition = resolveTranslationMotionRig(snapshot.document, nodeIds);
      const projection: DrawingMotionRigProjection = {
        version: 1, drawingRef: structuredClone(snapshot.ref), state: 'ready', ...definition,
      };
      this.#rigs.set(sessionId, projection);
      return { status: 'ready', projection: structuredClone(projection) };
    } catch (error) {
      const previous = this.current(sessionId);
      return {
        status: 'needs-correction',
        ...(previous ? { projection: previous } : {}),
        message: errorMessage(error),
      };
    }
  }

  discard(sessionId: string, expectedRef?: DrawingWorkspaceRef): DrawingMotionRigDiscardResult {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) {
      this.#rigs.delete(sessionId);
      return { status: 'rejected', code: 'DRAWING_REQUIRED', message: 'No Drawing is loaded.' };
    }
    if (expectedRef && !sameRef(snapshot.ref, expectedRef)) return {
      status: 'stale', currentRef: structuredClone(snapshot.ref),
    };
    this.#rigs.delete(sessionId);
    return { status: 'discarded' };
  }

  disposeSession(sessionId: string): void {
    this.#rigs.delete(sessionId);
  }
}

function createFailure(error: unknown): DrawingCreateMotionRigResult {
  const reason = errorMessage(error);
  if (reason === 'MOTION_RIG_AMBIGUOUS') return {
    state: 'blocked', code: 'ambiguous_topology', message: 'Multiple movement anchors are equally plausible.',
  };
  if (reason === 'MOTION_RIG_GEOMETRY_UNSUPPORTED') return {
    state: 'blocked', code: 'unsupported_geometry', message: 'The selected connector geometry is not safely deformable.',
  };
  return { state: 'needs_correction', summary: 'The movement constraint needs selection correction.', reason };
}

function sameRef(left: DrawingWorkspaceRef, right: DrawingWorkspaceRef): boolean {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
