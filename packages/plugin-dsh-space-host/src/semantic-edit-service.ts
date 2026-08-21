// SPDX-License-Identifier: Apache-2.0

import {
  canonicalSemanticString,
  canonicalString,
  compileSpatialEditProgram,
  type EditCorePorts,
  type GroundedEditTarget,
  type SpatialCompilation,
} from '@vectorai/drawing-edit-core';
import {
  finalizePreviewRequestSchema,
  spatialEditProgramSchema,
  type Assessment,
  type ContextRef,
  type EvaluationRecord,
  type EvaluationRef,
  type FinalizePreviewRequest,
  type FinalizePreviewResult,
  type GroundingRef,
  type ObservationRef,
  type OperationLookupResult,
  type PreviewRef,
  type ReviewEvidence,
  type SpatialEditProgram,
  type TaskRef,
} from '@vectorai/drawing-edit-protocol';
import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingUndoStageRequest, DrawingUndoStageResult } from '@vectorai/drawing-workspace';

import {
  InMemoryDrawingRepository,
  type UndoCommitRequest,
} from './repository';

interface TaskState {
  ref: TaskRef;
  objective: string;
  candidateCount: number;
  active: boolean;
}

interface GroundingState {
  ref: GroundingRef;
  target: GroundedEditTarget;
}

interface PreviewState {
  ref: PreviewRef;
  task: TaskState;
  grounding: GroundingState;
  program: SpatialEditProgram;
  compilation: SpatialCompilation;
}

interface EvaluationState {
  ref: EvaluationRef;
  evaluation: EvaluationRecord;
  assessment: Assessment;
}

export interface ReviewerDecision {
  outcome: 'satisfied' | 'needs_revision' | 'unavailable';
  defects: Array<{ code: string; reason: string; scopeDigest: string }>;
}

export interface SemanticEditServicePorts extends EditCorePorts {
  review?(input: {
    sessionId: string;
    objective: string;
    beforeSemanticDigest: string;
    afterSemanticDigest: string;
    effectDigest: string;
    changedNodeIds: string[];
    diagnostics: SpatialCompilation['diagnostics'];
    signal?: AbortSignal;
  }): Promise<ReviewerDecision>;
}

export interface ExtensionProgramRequest {
  targetNodeIds: string[];
  interfaces?: GroundedEditTarget['interfaces'];
  program: SpatialEditProgram;
}

export class SemanticEditService {
  readonly #pendingInstructions = new Map<string, {
    objective: string;
    rootUserMessageDigest: string;
  }>();
  readonly #sessionPolicies = new Map<string, 'review' | 'auto-safe'>();
  readonly #tasks = new Map<string, TaskState>();
  readonly #observations = new Map<string, ObservationRef>();
  readonly #contexts = new Map<string, ContextRef>();
  readonly #groundings = new Map<string, GroundingState>();
  readonly #previews = new Map<string, PreviewState>();
  readonly #evaluations = new Map<string, EvaluationState>();
  readonly #reviewInflight = new Map<string, Promise<ReviewerDecision>>();
  readonly #stickyReviewDefects = new Map<string, ReviewerDecision>();

  constructor(
    private readonly drawings: InMemoryDrawingRepository,
    private readonly ports: SemanticEditServicePorts,
  ) {}

  bindUserInstruction(sessionId: string, instruction: {
    objective: string;
    rootUserMessageDigest: string;
  }): void {
    const objective = instruction.objective.trim();
    if (!objective) return;
    this.#pendingInstructions.set(sessionId, { ...instruction, objective });
  }

  startBoundTask(sessionId: string, policy?: 'review' | 'auto-safe'): TaskRef {
    const pending = this.#pendingInstructions.get(sessionId);
    if (!pending) throw new Error('EDIT_USER_INSTRUCTION_REQUIRED');
    this.#pendingInstructions.delete(sessionId);
    return this.startTask(sessionId, { ...pending, policy: policy ?? this.#sessionPolicies.get(sessionId) ?? 'auto-safe' });
  }

  setSessionPolicy(sessionId: string, policy: 'review' | 'auto-safe'): void {
    this.#sessionPolicies.set(sessionId, policy);
    const current = this.#tasks.get(sessionId);
    if (policy === 'review' && current?.active && current.ref.policy === 'auto-safe') {
      current.ref = { ...current.ref, policy: 'review', stateEpoch: current.ref.stateEpoch + 1 };
    }
  }

  startTask(sessionId: string, input: {
    objective: string;
    rootUserMessageDigest: string;
    policy: 'review' | 'auto-safe';
  }): TaskRef {
    const snapshot = this.#snapshot(sessionId);
    const former = this.#tasks.get(sessionId);
    if (former) former.active = false;
    const workspacePreview = this.drawings.getPreview(sessionId);
    if (workspacePreview) this.drawings.discardPreview(sessionId, { handle: workspacePreview.handle });
    this.#previews.delete(sessionId);
    const objective = input.objective.trim();
    if (!objective) throw new Error('EDIT_OBJECTIVE_REQUIRED');
    const ref: TaskRef = {
      taskId: this.ports.id('task'),
      rootUserMessageDigest: input.rootUserMessageDigest,
      authoritativeObjectiveDigest: this.ports.digest(canonicalString({ text: objective })),
      baseRef: structuredClone(snapshot.ref),
      policy: input.policy,
      stateEpoch: (former?.ref.stateEpoch ?? 0) + 1,
    };
    this.#tasks.set(sessionId, { ref, objective, candidateCount: 0, active: true });
    return structuredClone(ref);
  }

  observe(sessionId: string, input: { taskId: string }): ObservationRef {
    const task = this.#task(sessionId, input.taskId);
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const ref: ObservationRef = {
      observationId: this.ports.id('observation'),
      taskId: task.ref.taskId,
      basis: { kind: 'canonical', ref: structuredClone(snapshot.ref) },
      artifactRefs: [],
      observationDigest: this.ports.digest(canonicalString({
        taskId: task.ref.taskId,
        ref: snapshot.ref,
        semantic: canonicalSemanticString(snapshot.document),
      })),
    };
    this.#observations.set(ref.observationId, ref);
    return structuredClone(ref);
  }

  buildContext(sessionId: string, input: { taskId: string; observationId: string }): ContextRef {
    const task = this.#task(sessionId, input.taskId);
    const observation = this.#observations.get(input.observationId);
    if (!observation || observation.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const ref: ContextRef = {
      contextId: this.ports.id('context'),
      taskId: task.ref.taskId,
      observationId: observation.observationId,
      contextDigest: this.ports.digest(canonicalString({
        observationDigest: observation.observationDigest,
        nodeIds: allNodes(snapshot.document).map(({ id }) => id).sort(),
      })),
    };
    this.#contexts.set(ref.contextId, ref);
    return structuredClone(ref);
  }

  ground(sessionId: string, input: {
    taskId: string;
    contextId: string;
    targetNodeIds: string[];
    interfaces: GroundedEditTarget['interfaces'];
  }): GroundingRef {
    const task = this.#task(sessionId, input.taskId);
    const context = this.#contexts.get(input.contextId);
    if (!context || context.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const nodes = new Map(allNodes(snapshot.document).map((node) => [String(node.id), node]));
    if (input.targetNodeIds.length === 0 || input.targetNodeIds.some((id) => !nodes.has(id))) {
      throw new Error('EDIT_TARGET_UNRESOLVED');
    }
    for (const port of input.interfaces) {
      const node = nodes.get(port.nodeId);
      if (!node || node.type !== 'line' || !port.endpoint) throw new Error('EDIT_INTERFACE_UNRESOLVED');
    }
    const sourceStatus: GroundedEditTarget['sourceStatus'] = snapshot.provisional
      ? 'provisional'
      : input.targetNodeIds.some((id) => nodes.get(id)?.quality.status !== 'confirmed')
        ? 'candidate'
        : 'confirmed';
    const targetHandle = this.ports.id('target');
    const target: GroundedEditTarget = {
      targetHandle,
      targetNodeIds: [...new Set(input.targetNodeIds)],
      interfaces: structuredClone(input.interfaces),
      sourceStatus,
    };
    const ref: GroundingRef = {
      groundingId: this.ports.id('grounding'),
      taskId: task.ref.taskId,
      contextId: context.contextId,
      targetHandle,
      targetScopeDigest: this.ports.digest(canonicalString([...target.targetNodeIds].sort())),
      protectedScopeDigest: this.ports.digest(canonicalString(
        allNodes(snapshot.document).map(({ id }) => String(id))
          .filter((id) => !target.targetNodeIds.includes(id) && !target.interfaces.some((port) => port.nodeId === id))
          .sort(),
      )),
      evidenceDigest: this.ports.digest(canonicalString({ context: context.contextDigest, sourceStatus })),
    };
    this.#groundings.set(ref.groundingId, { ref, target });
    return structuredClone(ref);
  }

  previewProgram(sessionId: string, input: {
    taskId: string;
    groundingId: string;
    program: SpatialEditProgram;
  }): PreviewRef {
    const task = this.#task(sessionId, input.taskId);
    if (task.candidateCount >= 3) throw new Error('EDIT_CANDIDATE_BUDGET_EXHAUSTED');
    const grounding = this.#groundings.get(input.groundingId);
    if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const program = spatialEditProgramSchema.parse(input.program) as SpatialEditProgram;
    if (program.objective !== task.objective) throw new Error('EDIT_OBJECTIVE_MISMATCH');
    if (
      program.baseRef.drawingId !== task.ref.baseRef.drawingId
      || program.baseRef.revision !== task.ref.baseRef.revision
    ) throw new Error('EDIT_BASE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const compilation = compileSpatialEditProgram({
      document: snapshot.document,
      program,
      grounding: grounding.target,
      ports: this.ports,
    });
    const workspace = this.drawings.createPreview(sessionId, {
      ref: snapshot.ref,
      commands: compilation.forward as never,
      summary: program.summary,
    });
    if (workspace.status !== 'previewed') {
      throw new Error(workspace.status === 'rejected' ? workspace.code ?? 'EDIT_PREVIEW_REJECTED' : 'EDIT_BASE_STALE');
    }
    const finalizeOperationId = this.ports.id('finalize');
    const finalizeOperationBindingDigest = this.ports.digest(canonicalString({
      mode: 'semantic', sessionId, drawingId: snapshot.ref.drawingId,
      operationId: finalizeOperationId,
      previewHandle: workspace.preview.handle,
      candidateDigest: compilation.candidateDigest,
    }));
    const ref: PreviewRef = {
      previewHandle: workspace.preview.handle,
      taskId: task.ref.taskId,
      groundingId: grounding.ref.groundingId,
      baseRef: structuredClone(snapshot.ref),
      candidateDigest: compilation.candidateDigest,
      effectDigest: compilation.effectDigest,
      finalizeOperationId,
      finalizeOperationBindingDigest,
    };
    task.candidateCount += 1;
    this.#previews.set(sessionId, { ref, task, grounding, program, compilation });
    return structuredClone(ref);
  }

  revisePreview(sessionId: string, input: {
    taskId: string;
    currentPreviewHandle: string;
    currentCandidateDigest: string;
    groundingId: string;
    program: SpatialEditProgram;
  }): PreviewRef {
    const current = this.#preview(
      sessionId, input.currentPreviewHandle, input.currentCandidateDigest,
    );
    if (current.ref.taskId !== input.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    return this.previewProgram(sessionId, {
      taskId: input.taskId,
      groundingId: input.groundingId,
      program: input.program,
    });
  }

  async evaluatePreview(sessionId: string, input: {
    taskId: string;
    previewHandle: string;
    candidateDigest: string;
    signal?: AbortSignal;
  }): Promise<{ evaluation: EvaluationRecord; assessment: Assessment }> {
    const task = this.#task(sessionId, input.taskId);
    const preview = this.#preview(sessionId, input.previewHandle, input.candidateDigest);
    if (preview.task !== task) throw new Error('EDIT_LINEAGE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const beforeContentDigest = this.ports.digest(canonicalSemanticString(snapshot.document));
    const afterContentDigest = this.ports.digest(canonicalSemanticString(preview.compilation.candidate));
    const riskKey = this.ports.digest(canonicalString({
      taskObjective: task.ref.authoritativeObjectiveDigest,
      baseRef: task.ref.baseRef,
      afterContentDigest,
      effectDigest: preview.ref.effectDigest,
    }));
    const sticky = this.#stickyReviewDefects.get(riskKey);
    let reviewPromise = this.#reviewInflight.get(riskKey);
    if (!reviewPromise && !sticky && this.ports.review) {
      reviewPromise = this.ports.review({
          sessionId,
          objective: task.objective,
          beforeSemanticDigest: beforeContentDigest,
          afterSemanticDigest: afterContentDigest,
          effectDigest: preview.ref.effectDigest,
          changedNodeIds: [
            ...preview.compilation.actualEffect.createdNodeIds,
            ...preview.compilation.actualEffect.updatedNodeIds,
            ...preview.compilation.actualEffect.deletedNodeIds,
          ],
          diagnostics: preview.compilation.diagnostics,
          signal: input.signal,
        });
      this.#reviewInflight.set(riskKey, reviewPromise);
    }
    let reviewed: ReviewerDecision;
    if (sticky) reviewed = sticky;
    else if (reviewPromise) {
      try {
        reviewed = await reviewPromise;
      } finally {
        if (this.#reviewInflight.get(riskKey) === reviewPromise) this.#reviewInflight.delete(riskKey);
      }
    } else reviewed = {
          outcome: preview.compilation.diagnostics.some(({ hard }) => hard)
            ? 'needs_revision' as const : 'satisfied' as const,
          defects: preview.compilation.diagnostics.filter(({ hard }) => hard).map((diagnostic) => ({
            code: diagnostic.code, reason: diagnostic.message, scopeDigest: preview.ref.effectDigest,
          })),
        };
    if (reviewed.outcome === 'needs_revision') {
      const immutable = structuredClone(reviewed);
      this.#stickyReviewDefects.set(riskKey, immutable);
      reviewed = immutable;
    }
    this.#preview(sessionId, input.previewHandle, input.candidateDigest);
    const review: ReviewEvidence = {
      kind: 'reviewer', provider: this.ports.review ? 'dsh-subagent' : 'deterministic-local', providerVersion: '1',
      authoritativeObjective: { text: task.objective, attachmentContentDigests: [] },
      renderManifest: {
        rendererVersion: 'semantic-digest-v1',
        beforeContentDigest,
        afterContentDigest,
        viewport: this.drawings.summarize(sessionId)?.bounds ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        width: 1, height: 1, overlays: ['changed-nodes'],
      },
      outcome: reviewed.outcome,
      defects: reviewed.defects.map((diagnostic) => ({
        defectId: this.ports.id('defect'), code: diagnostic.code,
        reason: diagnostic.reason, scopeDigest: diagnostic.scopeDigest,
      })),
      resolvedDefects: [],
    };
    const evaluationId = this.ports.id('evaluation');
    const evaluationDigest = this.ports.digest(canonicalString({
      preview: preview.ref, diagnostics: preview.compilation.diagnostics, review,
    }));
    const evaluation: EvaluationRecord = {
      evaluationId,
      taskId: task.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      diagnostics: structuredClone(preview.compilation.diagnostics),
      mandatoryEvaluatorVersions: ['source-quality-v1', 'scope-v1', 'postconditions-v1', 'inverse-v1'],
      review,
      evaluationDigest,
    };
    const assessment = this.#assess(sessionId, preview, evaluation);
    const ref: EvaluationRef = {
      evaluationId, taskId: task.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      evaluationDigest,
    };
    this.#evaluations.set(evaluationId, { ref, evaluation, assessment });
    return { evaluation: structuredClone(evaluation), assessment: structuredClone(assessment) };
  }

  finalizePreview(sessionId: string, raw: FinalizePreviewRequest): FinalizePreviewResult {
    const request = finalizePreviewRequestSchema.parse(raw);
    const currentTask = this.#tasks.get(sessionId);
    const preview = this.#previews.get(sessionId);
    if (!currentTask?.active || !preview || preview.task !== currentTask) throw new Error('EDIT_TASK_STALE');
    this.#preview(sessionId, request.previewHandle, request.previewDigest);
    if (
      request.finalizeOperationId !== preview.ref.finalizeOperationId
      || request.finalizeOperationBindingDigest !== preview.ref.finalizeOperationBindingDigest
    ) throw new Error('EDIT_OPERATION_BINDING_MISMATCH');
    const evaluated = this.#evaluations.get(request.evaluationId);
    if (
      !evaluated
      || evaluated.ref.previewHandle !== preview.ref.previewHandle
      || evaluated.ref.candidateDigest !== preview.ref.candidateDigest
    ) throw new Error('EDIT_EVALUATION_STALE');
    if (evaluated.assessment.disposition !== 'auto_safe') {
      return {
        status: 'rejected',
        disposition: evaluated.assessment.disposition === 'blocked' ? 'blocked' : 'confirmation_required',
        code: evaluated.assessment.reasons[0] ?? 'EDIT_CONFIRMATION_REQUIRED',
        message: evaluated.assessment.disposition === 'blocked'
          ? 'The candidate is blocked by a non-overridable safety rule.'
          : 'The candidate requires an exact human confirmation before commit.',
      };
    }
    return this.#commitPreview(sessionId, preview, evaluated, 'auto-safe');
  }

  confirmFinalize(sessionId: string, raw: FinalizePreviewRequest): FinalizePreviewResult {
    const request = finalizePreviewRequestSchema.parse(raw);
    const currentTask = this.#tasks.get(sessionId);
    const preview = this.#previews.get(sessionId);
    if (!currentTask?.active || !preview || preview.task !== currentTask) throw new Error('EDIT_TASK_STALE');
    this.#preview(sessionId, request.previewHandle, request.previewDigest);
    if (
      request.finalizeOperationId !== preview.ref.finalizeOperationId
      || request.finalizeOperationBindingDigest !== preview.ref.finalizeOperationBindingDigest
    ) throw new Error('EDIT_OPERATION_BINDING_MISMATCH');
    const evaluated = this.#evaluations.get(request.evaluationId);
    if (!evaluated || evaluated.ref.candidateDigest !== preview.ref.candidateDigest) {
      throw new Error('EDIT_EVALUATION_STALE');
    }
    if (evaluated.assessment.disposition === 'blocked') {
      return { status: 'rejected', disposition: 'blocked', code: evaluated.assessment.reasons[0] ?? 'EDIT_BLOCKED', message: 'The candidate is blocked.' };
    }
    return this.#commitPreview(sessionId, preview, evaluated, 'confirmed');
  }

  discardPreview(sessionId: string, previewHandle: string) {
    const preview = this.#previews.get(sessionId);
    if (!preview || preview.ref.previewHandle !== previewHandle) throw new Error('EDIT_PREVIEW_STALE');
    const result = this.drawings.discardPreview(sessionId, { handle: previewHandle });
    if (result.status !== 'discarded') throw new Error(result.code ?? 'EDIT_DISCARD_REJECTED');
    this.#previews.delete(sessionId);
    return result;
  }

  #commitPreview(
    sessionId: string,
    preview: PreviewState,
    evaluated: EvaluationState,
    mode: 'auto-safe' | 'confirmed',
  ): FinalizePreviewResult {
    const receipt = this.drawings.commitSemantic(sessionId, {
      expectedRef: preview.ref.baseRef,
      operationId: preview.ref.finalizeOperationId,
      operationBindingDigest: preview.ref.finalizeOperationBindingDigest,
      candidateDigest: preview.ref.candidateDigest,
      forward: preview.compilation.forward,
      inverse: preview.compilation.inverse,
      mode,
      assessment: evaluated.assessment,
      reviewEvidence: evaluated.evaluation.review,
    });
    if (receipt.status === 'no-effect') return {
      status: 'already-satisfied',
      ref: receipt.ref,
      operationId: receipt.operationId,
      operationBindingDigest: receipt.operationBindingDigest,
    };
    if (receipt.status !== 'committed' || receipt.mode !== 'semantic') {
      throw new Error('EDIT_COMMIT_RECEIPT_INVALID');
    }
    this.#previews.delete(sessionId);
    return {
      status: 'committed', mode, commitId: receipt.commitId,
      ref: receipt.resultingRef,
      operationId: receipt.operationId,
      operationBindingDigest: receipt.operationBindingDigest,
    };
  }

  getOperation(sessionId: string, operationId: string, bindingDigest: string): OperationLookupResult {
    return this.drawings.getOperation(sessionId, operationId, bindingDigest);
  }

  undo(sessionId: string, request: UndoCommitRequest) {
    return this.drawings.undoCommit(sessionId, request);
  }

  undoAuthorized(sessionId: string, input: Omit<UndoCommitRequest, 'operationId' | 'operationBindingDigest'>) {
    const operationId = this.ports.id('undo');
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: 'undo', operationId, sessionId,
      drawingId: input.expectedCurrentRef.drawingId,
      targetCommitId: input.targetCommitId,
      expectedCurrentRef: input.expectedCurrentRef,
    }));
    return this.undo(sessionId, { ...input, operationId, operationBindingDigest });
  }

  stageUndo(sessionId: string, input: DrawingUndoStageRequest): DrawingUndoStageResult {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: 'rejected', code: 'DRAWING_REQUIRED', message: 'No Drawing is loaded.' };
    if (
      snapshot.ref.drawingId !== input.expectedCurrentRef.drawingId
      || snapshot.ref.revision !== input.expectedCurrentRef.revision
    ) return { status: 'rejected', code: 'UNDO_CONFLICT', message: 'The Drawing revision changed.' };
    if (!snapshot.lastCommit?.undoable || snapshot.lastCommit.commitId !== input.targetCommitId) {
      return { status: 'rejected', code: 'UNDO_TARGET_NOT_CURRENT', message: 'The requested commit is not the current undo target.' };
    }
    const operationId = this.ports.id('undo');
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: 'undo', operationId, sessionId,
      drawingId: input.expectedCurrentRef.drawingId,
      targetCommitId: input.targetCommitId,
      expectedCurrentRef: input.expectedCurrentRef,
    }));
    return {
      status: 'staged', ...structuredClone(input), operationId, operationBindingDigest,
      commandLine: `/drawing-undo ${input.targetCommitId} ${input.expectedCurrentRef.drawingId}@${input.expectedCurrentRef.revision} ${operationId} ${operationBindingDigest}`,
    };
  }

  async runExtensionProgram(sessionId: string, input: ExtensionProgramRequest, signal?: AbortSignal) {
    const task = this.startBoundTask(sessionId);
    const observation = this.observe(sessionId, { taskId: task.taskId });
    const context = this.buildContext(sessionId, {
      taskId: task.taskId,
      observationId: observation.observationId,
    });
    const grounding = this.ground(sessionId, {
      taskId: task.taskId,
      contextId: context.contextId,
      targetNodeIds: input.targetNodeIds,
      interfaces: input.interfaces ?? [],
    });
    const taskState = this.#task(sessionId, task.taskId);
    const preview = this.previewProgram(sessionId, {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      program: {
        ...structuredClone(input.program),
        baseRef: structuredClone(task.baseRef),
        targetHandle: grounding.targetHandle,
        objective: taskState.objective,
      },
    });
    const evaluated = await this.evaluatePreview(sessionId, {
      taskId: task.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
      signal,
    });
    const result = this.finalizePreview(sessionId, {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluated.evaluation.evaluationId,
    });
    return { task, observation, context, grounding, preview, ...evaluated, result };
  }

  #assess(sessionId: string, preview: PreviewState, evaluation: EvaluationRecord): Assessment {
    const reasons: string[] = [];
    const hard = evaluation.diagnostics.some((diagnostic) => diagnostic.severity === 'error' && diagnostic.hard);
    if (hard) reasons.push('HARD_VALIDATION_FAILED');
    if (preview.grounding.target.sourceStatus !== 'confirmed') reasons.push('SOURCE_NOT_CONFIRMED');
    if (evaluation.diagnostics.some((diagnostic) => diagnostic.severity !== 'info')) reasons.push('DIAGNOSTICS_PRESENT');
    if (evaluation.review.outcome !== 'satisfied') reasons.push('REVIEW_NOT_SATISFIED');
    const safeAnnotationCreate = preview.program.operations.every((operation) => (
      operation.kind === 'create_annotation_batch'
      && operation.annotations.every((node) => annotationConfirmed(node))
      && operation.associations.every((node) => associationResolved(node))
    ));
    if (
      preview.compilation.actualEffect.deletedNodeIds.length > 0
      || (preview.compilation.actualEffect.createdNodeIds.length > 0 && !safeAnnotationCreate)
    ) {
      reasons.push('LIFECYCLE_CHANGE');
    }
    const allowed = new Set([
      ...preview.grounding.target.targetNodeIds,
      ...preview.grounding.target.interfaces.map(({ nodeId }) => nodeId),
    ]);
    if (preview.compilation.actualEffect.updatedNodeIds.some((id) => !allowed.has(id))) {
      reasons.push('OUT_OF_SCOPE_EFFECT');
    }
    const base = {
      assessmentId: this.ports.id('assessment'),
      taskId: preview.task.ref.taskId,
      drawingId: preview.ref.baseRef.drawingId,
      baseRef: structuredClone(preview.ref.baseRef),
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      evaluationDigest: evaluation.evaluationDigest,
      policyVersion: 'auto-safe-v1',
      evaluatorVersions: [...evaluation.mandatoryEvaluatorVersions],
      effectDigest: preview.ref.effectDigest,
      reasons,
    };
    if (hard || reasons.includes('OUT_OF_SCOPE_EFFECT')) return {
      ...base, disposition: 'blocked', hardDeny: hard, nonOverridableProtected: reasons.includes('OUT_OF_SCOPE_EFFECT'),
    };
    if (preview.task.ref.policy !== 'auto-safe') reasons.push('TASK_REVIEW_POLICY');
    if (reasons.length > 0) return {
      ...base, disposition: 'confirmation_required', requiredEffectDigest: preview.ref.effectDigest,
    };
    return {
      ...base,
      disposition: 'auto_safe',
      autoQualification: {
        exactScope: true, cleanDiagnostics: true, sourceConfirmed: true,
        reviewerSatisfied: true, inverseVerified: true,
      },
    };
  }

  #task(sessionId: string, taskId: string): TaskState {
    const task = this.#tasks.get(sessionId);
    if (!task?.active || task.ref.taskId !== taskId) throw new Error('EDIT_TASK_STALE');
    return task;
  }

  #preview(sessionId: string, handle: string, digest: string): PreviewState {
    const preview = this.#previews.get(sessionId);
    if (!preview || preview.ref.previewHandle !== handle || preview.ref.candidateDigest !== digest) {
      throw new Error('EDIT_PREVIEW_STALE');
    }
    return preview;
  }

  #snapshot(sessionId: string) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) throw new Error('DRAWING_REQUIRED');
    return snapshot;
  }

  #snapshotAtTask(sessionId: string, task: TaskState) {
    const snapshot = this.#snapshot(sessionId);
    if (
      snapshot.ref.drawingId !== task.ref.baseRef.drawingId
      || snapshot.ref.revision !== task.ref.baseRef.revision
    ) throw new Error('EDIT_BASE_STALE');
    return snapshot;
  }
}

function allNodes(document: DrawingDocument) {
  return [...document.geometry, ...document.annotations, ...document.relations, ...document.features];
}

function annotationConfirmed(node: Record<string, unknown>): boolean {
  const quality = node.quality as Record<string, unknown> | undefined;
  return quality?.status === 'confirmed'
    && (node.type !== 'dimension' || node.associationStatus === 'resolved');
}

function associationResolved(node: Record<string, unknown>): boolean {
  return node.type === 'association'
    && node.kind === 'annotation-target'
    && Array.isArray(node.geometryIds)
    && node.geometryIds.length > 0;
}
