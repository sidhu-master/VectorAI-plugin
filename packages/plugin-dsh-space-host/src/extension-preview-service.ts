// SPDX-License-Identifier: Apache-2.0

import type { DrawingRef, FinalizePreviewResult } from '@vectorai/drawing-edit-protocol';
import {
  extensionPreviewControlRequestSchema,
  extensionPreviewCreateRequestSchema,
  extensionPreviewReplaceRequestSchema,
  type ExtensionPreviewAssessmentResult,
  type ExtensionPreviewControlRequest,
  type ExtensionPreviewCreateRequest,
  type ExtensionPreviewCreateResult,
  type ExtensionPreviewDiscardResult,
  type ExtensionPreviewFinalizeResult,
  type ExtensionPreviewReplaceRequest,
} from '@vectorai/plugin-space-contracts';

import type { InMemoryDrawingRepository } from './repository';
import type { SemanticEditService } from './semantic-edit-service';

export interface ExtensionPreviewServicePorts {
  id(kind: string): string;
  digest(value: string): string;
  now(): number;
  ttlMs?: number;
}

interface ExtensionPreviewState {
  extensionId: string;
  workflowId: string;
  baseRef: DrawingRef;
  previewToken: string;
  expiresAt: number;
  taskId: string;
  groundingId: string;
  targetHandle: string;
  objective: string;
  preview: {
    previewHandle: string;
    candidateDigest: string;
    finalizeOperationId: string;
    finalizeOperationBindingDigest: string;
  };
  evaluationId?: string;
  finalized?: ExtensionPreviewFinalizeResult;
}

type ExtensionValidationFailure =
  | { status: 'needs-rebase'; currentRef: DrawingRef }
  | { status: 'rejected'; code: string; message: string };

type DrawingsPort = Pick<InMemoryDrawingRepository, 'getSnapshot'>;
type SemanticPort = Pick<SemanticEditService,
  | 'startTask'
  | 'observe'
  | 'buildContext'
  | 'ground'
  | 'previewProgram'
  | 'evaluatePreview'
  | 'finalizePreview'
  | 'discardPreview'
>;

export class ExtensionPreviewService {
  readonly #states = new Map<string, ExtensionPreviewState>();
  readonly #ttlMs: number;

  constructor(
    private readonly drawings: DrawingsPort,
    private readonly semantic: SemanticPort,
    private readonly ports: ExtensionPreviewServicePorts,
  ) {
    this.#ttlMs = ports.ttlMs ?? 15 * 60_000;
  }

  async create(
    sessionId: string,
    raw: ExtensionPreviewCreateRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionPreviewCreateResult> {
    const request = extensionPreviewCreateRequestSchema.parse(raw) as ExtensionPreviewCreateRequest;
    const stale = this.#currentRefResult(sessionId, request.ref);
    if (stale !== null) return stale;
    if (!sameRef(request.program.baseRef, request.ref)) {
      return rejected('EXTENSION_BASE_MISMATCH', 'The extension program base does not match the requested Drawing revision.');
    }
    const existing = this.#states.get(sessionId);
    if (existing !== undefined) {
      if (this.#expired(existing)) this.#expire(sessionId, existing);
      else return rejected('EXTENSION_PREVIEW_BUSY', 'Another extension Preview is active for this session.');
    }

    signal?.throwIfAborted();
    const task = this.semantic.startTask(sessionId, {
      objective: request.program.objective,
      rootUserMessageDigest: this.ports.digest(JSON.stringify({
        extensionId: request.extensionId,
        workflowId: request.workflowId,
        ref: request.ref,
        objective: request.program.objective,
      })),
      policy: 'auto-safe',
    });
    const observation = await this.semantic.observe(sessionId, { taskId: task.taskId });
    signal?.throwIfAborted();
    const context = this.semantic.buildContext(sessionId, {
      taskId: task.taskId,
      observationId: observation.observationId,
    });
    const grounding = this.semantic.ground(sessionId, {
      taskId: task.taskId,
      contextId: context.contextId,
      targetNodeIds: request.targetNodeIds,
      interfaces: (request.interfaces ?? []).map(({ interfaceId, nodeId, endpoint }) => ({
        interfaceId, nodeId, endpoint: endpoint!,
      })),
    });
    const preview = this.semantic.previewProgram(sessionId, {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      program: {
        ...structuredClone(request.program),
        baseRef: structuredClone(task.baseRef),
        targetHandle: grounding.targetHandle,
        objective: request.program.objective,
      },
    });
    const state: ExtensionPreviewState = {
      extensionId: request.extensionId,
      workflowId: request.workflowId,
      baseRef: structuredClone(request.ref),
      previewToken: this.ports.id('extension-preview'),
      expiresAt: this.ports.now() + this.#ttlMs,
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      targetHandle: grounding.targetHandle,
      objective: request.program.objective,
      preview: structuredClone(preview),
    };
    this.#states.set(sessionId, state);
    return ready(state);
  }

  async replace(
    sessionId: string,
    raw: ExtensionPreviewReplaceRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionPreviewCreateResult> {
    const request = extensionPreviewReplaceRequestSchema.parse(raw) as ExtensionPreviewReplaceRequest;
    const checked = this.#validate(sessionId, request);
    if ('status' in checked) return checked;
    if (!sameRef(request.program.baseRef, checked.baseRef)) {
      return rejected('EXTENSION_BASE_MISMATCH', 'The replacement program base does not match the active Preview.');
    }
    signal?.throwIfAborted();
    const replacement = this.semantic.previewProgram(sessionId, {
      taskId: checked.taskId,
      groundingId: checked.groundingId,
      program: {
        ...structuredClone(request.program),
        baseRef: structuredClone(checked.baseRef),
        targetHandle: checked.targetHandle,
        objective: checked.objective,
      },
    });
    checked.preview = structuredClone(replacement);
    checked.expiresAt = this.ports.now() + this.#ttlMs;
    checked.evaluationId = undefined;
    checked.finalized = undefined;
    return ready(checked);
  }

  async assess(
    sessionId: string,
    raw: ExtensionPreviewControlRequest,
    signal?: AbortSignal,
  ): Promise<ExtensionPreviewAssessmentResult> {
    const request = extensionPreviewControlRequestSchema.parse(raw) as ExtensionPreviewControlRequest;
    const checked = this.#validate(sessionId, request);
    if ('status' in checked) return checked;
    signal?.throwIfAborted();
    const evaluated = await this.semantic.evaluatePreview(sessionId, {
      taskId: checked.taskId,
      previewHandle: checked.preview.previewHandle,
      candidateDigest: checked.preview.candidateDigest,
      signal,
    });
    checked.evaluationId = evaluated.evaluation.evaluationId;
    return {
      status: 'assessed',
      previewToken: checked.previewToken,
      candidateDigest: checked.preview.candidateDigest,
      assessment: structuredClone(evaluated.assessment),
    };
  }

  async finalize(
    sessionId: string,
    raw: ExtensionPreviewControlRequest,
  ): Promise<ExtensionPreviewFinalizeResult> {
    const request = extensionPreviewControlRequestSchema.parse(raw) as ExtensionPreviewControlRequest;
    const replay = this.#ownedState(sessionId, request);
    if (replay !== null && replay.finalized !== undefined) return structuredClone(replay.finalized);
    const checked = this.#validate(sessionId, request);
    if ('status' in checked) return checked;
    if (checked.evaluationId === undefined) {
      return rejected('EXTENSION_ASSESSMENT_REQUIRED', 'The current extension Preview must be assessed before finalization.');
    }
    const result = this.semantic.finalizePreview(sessionId, {
      previewHandle: checked.preview.previewHandle,
      previewDigest: checked.preview.candidateDigest,
      finalizeOperationId: checked.preview.finalizeOperationId,
      finalizeOperationBindingDigest: checked.preview.finalizeOperationBindingDigest,
      evaluationId: checked.evaluationId,
    }) as FinalizePreviewResult;
    const response: ExtensionPreviewFinalizeResult = { status: 'finalized', result };
    checked.finalized = structuredClone(response);
    return response;
  }

  async discard(
    sessionId: string,
    raw: ExtensionPreviewControlRequest,
  ): Promise<ExtensionPreviewDiscardResult> {
    const request = extensionPreviewControlRequestSchema.parse(raw) as ExtensionPreviewControlRequest;
    const checked = this.#validate(sessionId, request);
    if ('status' in checked) return checked;
    const result = this.semantic.discardPreview(sessionId, checked.preview.previewHandle);
    this.#states.delete(sessionId);
    return result.status === 'discarded'
      ? { status: 'discarded', ref: structuredClone(checked.baseRef) }
      : rejected('EXTENSION_DISCARD_REJECTED', 'The first-layer Preview could not be discarded.');
  }

  disposeSession(sessionId: string): void {
    const state = this.#states.get(sessionId);
    if (state === undefined) return;
    if (state.finalized === undefined) {
      try { this.semantic.discardPreview(sessionId, state.preview.previewHandle); } catch { /* session teardown */ }
    }
    this.#states.delete(sessionId);
  }

  #validate(
    sessionId: string,
    request: ExtensionPreviewControlRequest,
  ): ExtensionPreviewState | ExtensionValidationFailure {
    const state = this.#ownedState(sessionId, request);
    if (state === null) return rejected('EXTENSION_PREVIEW_NOT_FOUND', 'No Preview belongs to this extension workflow.');
    if (
      state.previewToken !== request.previewToken
      || state.preview.candidateDigest !== request.candidateDigest
    ) return rejected('EXTENSION_PREVIEW_MISMATCH', 'The Preview token or candidate digest is no longer current.');
    if (this.#expired(state)) {
      this.#expire(sessionId, state);
      return rejected('EXTENSION_PREVIEW_EXPIRED', 'The extension Preview token expired.');
    }
    if (!sameRef(request.ref, state.baseRef)) {
      return rejected('EXTENSION_PREVIEW_BINDING_MISMATCH', 'The request is not bound to the active Preview revision.');
    }
    const stale = this.#currentRefResult(sessionId, state.baseRef);
    return stale ?? state;
  }

  #ownedState(sessionId: string, request: ExtensionPreviewControlRequest): ExtensionPreviewState | null {
    const state = this.#states.get(sessionId);
    return state !== undefined
      && state.extensionId === request.extensionId
      && state.workflowId === request.workflowId
      ? state
      : null;
  }

  #currentRefResult(sessionId: string, ref: DrawingRef): ExtensionValidationFailure | null {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (snapshot === null) {
      return rejected('DRAWING_REQUIRED', 'No Drawing is loaded for this session.');
    }
    return sameRef(snapshot.ref, ref)
      ? null
      : { status: 'needs-rebase', currentRef: structuredClone(snapshot.ref) };
  }

  #expired(state: ExtensionPreviewState): boolean {
    return this.ports.now() > state.expiresAt;
  }

  #expire(sessionId: string, state: ExtensionPreviewState): void {
    try { this.semantic.discardPreview(sessionId, state.preview.previewHandle); } catch { /* stale Preview */ }
    if (this.#states.get(sessionId) === state) this.#states.delete(sessionId);
  }
}

function ready(state: ExtensionPreviewState): ExtensionPreviewCreateResult {
  return {
    status: 'previewed',
    previewToken: state.previewToken,
    candidateDigest: state.preview.candidateDigest,
    ref: structuredClone(state.baseRef),
    expiresAt: state.expiresAt,
  };
}

function rejected(code: string, message: string) {
  return { status: 'rejected' as const, code, message };
}

function sameRef(left: DrawingRef, right: DrawingRef): boolean {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}
