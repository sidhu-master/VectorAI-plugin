// SPDX-License-Identifier: Apache-2.0

import {
  applyDrawingTransaction,
  canonicalSemanticString,
  canonicalString,
  invertDrawingTransaction,
  type EditCorePorts,
} from '@vectorai/drawing-edit-core';
import type { DrawingTransactionCommand, DurableOperationReceipt } from '@vectorai/drawing-edit-protocol';
import type {
  DrawingInteractiveStageResult,
  DrawingWorkspaceCommitRequest,
} from '@vectorai/drawing-workspace';

import { InMemoryDrawingRepository } from './repository';

type StagedResult = Extract<DrawingInteractiveStageResult, { status: 'staged' }>;

interface InteractiveIntent extends StagedResult {
  sessionId: string;
  expectedRef: { drawingId: string; revision: number };
  commands: DrawingTransactionCommand[];
  inverse: DrawingTransactionCommand[];
  candidateDigest: string;
}

export class InteractiveEditService {
  readonly #intents = new Map<string, InteractiveIntent>();

  constructor(
    private readonly drawings: InMemoryDrawingRepository,
    private readonly ports: EditCorePorts,
  ) {}

  stage(sessionId: string, request: DrawingWorkspaceCommitRequest): DrawingInteractiveStageResult {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: 'rejected', message: 'No Drawing is loaded.', code: 'DRAWING_REQUIRED' };
    if (request.expectedRevision !== snapshot.ref.revision) return {
      status: 'conflict',
      message: `Expected revision ${request.expectedRevision}, current revision is ${snapshot.ref.revision}`,
      snapshot,
    };
    if (request.commands.length === 0 || request.commands.length > 256) return {
      status: 'rejected', message: 'Interactive edit command count is invalid.', code: 'INTERACTIVE_COMMAND_COUNT_INVALID',
    };
    for (const command of request.commands) {
      if (command.type === 'node.create') return {
        status: 'rejected', message: 'Interactive creation is not supported by this gesture path.', code: 'INTERACTIVE_CREATE_FORBIDDEN',
      };
      if (command.type === 'node.update' && Object.keys(command.changes).some((field) => (
        field === 'id' || field === 'type' || field === 'plane' || field === 'quality'
      ))) return {
        status: 'rejected', message: 'The gesture attempted to change an identity or protected field.', code: 'INTERACTIVE_FIELD_FORBIDDEN',
      };
    }
    const commands = structuredClone(request.commands) as unknown as DrawingTransactionCommand[];
    let candidate;
    let inverse;
    try {
      candidate = applyDrawingTransaction(snapshot.document, commands, this.ports.now());
      inverse = invertDrawingTransaction(snapshot.document, commands);
      const restored = applyDrawingTransaction(candidate, inverse, this.ports.now());
      if (canonicalSemanticString(restored) !== canonicalSemanticString(snapshot.document)) {
        throw new Error('INVERSE_VERIFICATION_FAILED');
      }
    } catch (error) {
      return { status: 'rejected', message: errorMessage(error), code: 'INTERACTIVE_EDIT_REJECTED' };
    }
    const intentId = this.ports.id('intent');
    const operationId = this.ports.id('interactive');
    const candidateDigest = this.ports.digest(canonicalSemanticString(candidate));
    const intentDigest = this.ports.digest(canonicalString({
      sessionId, intentId, expectedRef: snapshot.ref, commands, candidateDigest,
    }));
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: 'interactive', operationId, sessionId, drawingId: snapshot.ref.drawingId,
      intentId, intentDigest, candidateDigest,
    }));
    const staged: InteractiveIntent = {
      status: 'staged', sessionId,
      expectedRef: structuredClone(snapshot.ref),
      commands, inverse, candidateDigest,
      intentId, intentDigest, operationId, operationBindingDigest,
      commandLine: `/drawing-apply-intent ${intentId} ${intentDigest} ${operationId} ${operationBindingDigest}`,
    };
    this.#intents.set(intentId, staged);
    return publicIntent(staged);
  }

  apply(sessionId: string, tokens: StagedResult): DurableOperationReceipt {
    const intent = this.#intents.get(tokens.intentId);
    if (!intent || intent.sessionId !== sessionId) throw new Error('INTERACTIVE_INTENT_NOT_FOUND');
    for (const key of ['intentDigest', 'operationId', 'operationBindingDigest'] as const) {
      if (tokens[key] !== intent[key]) throw new Error('INTERACTIVE_INTENT_BINDING_MISMATCH');
    }
    return this.drawings.commitSemantic(sessionId, {
      expectedRef: intent.expectedRef,
      operationId: intent.operationId,
      operationBindingDigest: intent.operationBindingDigest,
      candidateDigest: intent.candidateDigest,
      forward: intent.commands,
      inverse: intent.inverse,
      mode: 'interactive',
    });
  }

  applyCommand(sessionId: string, rawInput: string): DurableOperationReceipt {
    const [intentId, intentDigest, operationId, operationBindingDigest, ...extra] = rawInput.trim().split(/\s+/);
    if (!intentId || !intentDigest || !operationId || !operationBindingDigest || extra.length > 0) {
      throw new Error('INTERACTIVE_COMMAND_INVALID');
    }
    return this.apply(sessionId, {
      status: 'staged', intentId, intentDigest, operationId, operationBindingDigest,
      commandLine: `/drawing-apply-intent ${intentId} ${intentDigest} ${operationId} ${operationBindingDigest}`,
    });
  }
}

function publicIntent(intent: InteractiveIntent): StagedResult {
  const { intentId, intentDigest, operationId, operationBindingDigest, commandLine } = intent;
  return { status: 'staged', intentId, intentDigest, operationId, operationBindingDigest, commandLine };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
