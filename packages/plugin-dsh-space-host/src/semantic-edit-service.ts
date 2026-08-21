// SPDX-License-Identifier: Apache-2.0

import {
  canonicalSemanticString,
  canonicalString,
  compileMultiPartTransform,
  compileSpatialEditProgram,
  findConnectedCarrierCandidates,
  findConnectedCarrierInterfaces,
  solveSpatialIntent,
  type EditCorePorts,
  type GroundedEditTarget,
  type SpatialSolverReceipt,
  type SpatialCompilation,
} from '@vectorai/drawing-edit-core';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import {
  drawingSelectPartsRequestSchema,
  finalizePreviewRequestSchema,
  multiPartTransformRequestSchema,
  multiPartTransformRevisionRequestSchema,
  spatialEditProgramSchema,
  spatialIntentRequestSchema,
  spatialIntentRevisionSchema,
  type Assessment,
  type ContextRef,
  type DrawingSelectPartsRequest,
  type EvaluationRecord,
  type EvaluationRef,
  type ExplicitNumericConstraint,
  type FinalizePreviewRequest,
  type FinalizePreviewResult,
  type GroundingRef,
  type MultiPartTransformRequest,
  type MultiPartTransformRevisionRequest,
  type ObservationRef,
  type OperationLookupResult,
  type PreviewRef,
  type ReviewEvidence,
  type SemanticPartSelection,
  type SelectionProjectionRef,
  type SpatialEditProgram,
  type SpatialIntentRequest,
  type SpatialIntentRevision,
  type TaskRef,
} from '@vectorai/drawing-edit-protocol';
import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingGroundingOverlay } from '@vectorai/plugin-space-contracts';
import {
  buildGeometryTopologyGraph,
  GroundingLedger,
  resolveSpatialPoint,
  WorldModelCompiler,
  type GroundingEvidenceEvent,
} from '@vectorai/drawing-spatial';
import type { DrawingUndoStageRequest, DrawingUndoStageResult } from '@vectorai/drawing-workspace';

import {
  InMemoryDrawingRepository,
  type UndoCommitRequest,
} from './repository';
import type { DrawingSolverProvenance } from './durable-envelope';
import { SemanticEditEpisodeStore, type BoundUserInstruction } from './semantic-episode';

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
  groundings: GroundingState[];
  program?: SpatialEditProgram;
  compilation: SpatialCompilation;
  intent?: SpatialIntentRequest;
  intentDigest?: string;
  solverProvenance?: DrawingSolverProvenance;
}

interface EvaluationState {
  ref: EvaluationRef;
  evaluation: EvaluationRecord;
  assessment: Assessment;
}

export interface ReviewerDecision {
  outcome: 'satisfied' | 'needs_revision' | 'unavailable';
  defects: Array<{ code: string; reason: string; scopeDigest: string }>;
  render?: {
    rendererVersion: string;
    contentDigest: string;
    width: number;
    height: number;
    comparisonLayout: 'before | after';
    worldToImage: [number, number, number, number, number, number];
    overlays: string[];
    attachment?: ImageAttachmentRef;
  };
}

export interface SemanticEditServicePorts extends EditCorePorts {
  renderObservation?(input: {
    document: DrawingDocument;
    viewport: { minX: number; minY: number; maxX: number; maxY: number };
    selectedNodeIds: string[];
  }): Promise<{
    contentDigest: string;
    attachment: ImageAttachmentRef;
    width: number;
    height: number;
    worldToImage: [number, number, number, number, number, number];
  }>;
  review?(input: {
    sessionId: string;
    objective: string;
    beforeSemanticDigest: string;
    afterSemanticDigest: string;
    effectDigest: string;
    changedNodeIds: string[];
    diagnostics: SpatialCompilation['diagnostics'];
    beforeDocument: DrawingDocument;
    afterDocument: DrawingDocument;
    viewport: { minX: number; minY: number; maxX: number; maxY: number };
    signal?: AbortSignal;
  }): Promise<ReviewerDecision>;
}

export interface ExtensionProgramRequest {
  targetNodeIds: string[];
  interfaces?: GroundedEditTarget['interfaces'];
  program: SpatialEditProgram;
}

export interface SemanticContextRef extends ContextRef {
  coordinateSystem: {
    space: 'world';
    positiveX: 'right';
    positiveY: 'up';
    negativeX: 'left';
    negativeY: 'down';
    positiveRotation: 'counterclockwise';
    modelRotationUnit: 'degrees';
  };
  geometryFacts: Array<{
    nodeId: string;
    type: string;
    quality: 'confirmed' | 'candidate';
    center: [number, number] | null;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  }>;
  connectedCarrierFacts: Array<{
    carrierNodeId: string;
    carrierType: 'circle' | 'ellipse';
    contactedOpenConnectorCount: number;
    contactedPortCount: number;
    interfaces: Array<{ interfaceId: string; nodeId: string; endpoint: 'start' | 'end' }>;
  }>;
  topologyFacts: {
    segmentCount: number;
    vertexCount: number;
    interfaceVertices: Array<{ vertexId: string; point: readonly [number, number]; nodeIds: string[] }>;
  };
  knowledge: {
    status: 'complete' | 'partial' | 'unknown';
    worldModelVersion: string;
    unresolvedBoundaryRefs: string[];
  };
}

interface ObservationState {
  ref: ObservationRef;
  attachment?: ImageAttachmentRef;
  view?: {
    width: number;
    height: number;
    worldToImage: [number, number, number, number, number, number];
  };
}

interface EpisodeSelectionCandidate {
  key: string;
  nodeIds: string[];
  score: number;
  summary: string;
  stateEpoch: number;
}

interface EpisodeSelectionState {
  episodeId: string;
  taskId: string;
  observationId: string;
  contextId: string;
  ledger: GroundingLedger;
  selectedParts: Record<string, GroundedEditTarget>;
  groundings: Record<string, GroundingState>;
  candidates: Map<string, EpisodeSelectionCandidate>;
  nextCandidate: number;
}

export type CurrentPartSelectionResult =
  | {
    state: 'selected';
    parts: Array<{
      partKey: string;
      label: string;
      sourceStatus: GroundedEditTarget['sourceStatus'];
      nodeCount: number;
      interfaceCount: number;
    }>;
    nextTools: string[];
  }
  | {
    state: 'selection_ambiguous';
    partKey: string;
    candidates: Array<{ key: string; summary: string }>;
    nextTools: string[];
  }
  | {
    state: 'invalid_state' | 'reobserve_required';
    code: string;
    nextTools: string[];
  };

export class SemanticEditService {
  readonly #pendingInstructions = new Map<string, {
    rootUserMessageId: string;
    objective: string;
    rootUserMessageDigest: string;
    numericConstraints: ExplicitNumericConstraint[];
  }>();
  readonly #sessionPolicies = new Map<string, 'review' | 'auto-safe'>();
  readonly #tasks = new Map<string, TaskState>();
  readonly #observations = new Map<string, ObservationState>();
  readonly #contexts = new Map<string, SemanticContextRef>();
  readonly #groundings = new Map<string, GroundingState>();
  readonly #previews = new Map<string, PreviewState>();
  readonly #evaluations = new Map<string, EvaluationState>();
  readonly #reviewInflight = new Map<string, Promise<ReviewerDecision>>();
  readonly #stickyReviewDefects = new Map<string, ReviewerDecision>();
  readonly #selectionProjections = new Map<string, SelectionProjectionRef>();
  readonly #groundingOverlays = new Map<string, DrawingGroundingOverlay>();
  readonly #episodes: SemanticEditEpisodeStore;
  readonly #episodeSelections = new Map<string, EpisodeSelectionState>();
  readonly #currentOperations = new Map<string, { operationId: string; operationBindingDigest: string }>();
  readonly #terminalFinalizeResults = new Map<string, FinalizePreviewResult>();

  constructor(
    private readonly drawings: InMemoryDrawingRepository,
    private readonly ports: SemanticEditServicePorts,
  ) {
    this.#episodes = new SemanticEditEpisodeStore({ id: ports.id, digest: ports.digest });
  }

  bindUserInstruction(sessionId: string, instruction: {
    rootUserMessageId: string;
    objective: string;
    rootUserMessageDigest: string;
    numericConstraints: ExplicitNumericConstraint[];
  }): void {
    const objective = instruction.objective.trim();
    if (!objective) return;
    const bound = { ...instruction, objective };
    const former = this.#episodes.current(sessionId);
    this.#episodes.bindInstruction(sessionId, bound);
    if (former && !this.#episodes.current(sessionId)) {
      this.#episodeSelections.delete(sessionId);
      this.#groundingOverlays.delete(sessionId);
      this.#currentOperations.delete(sessionId);
      this.#terminalFinalizeResults.delete(sessionId);
    }
    this.#pendingInstructions.set(sessionId, bound);
  }

  startBoundTask(sessionId: string, policy?: 'review' | 'auto-safe'): TaskRef {
    const pending = this.#pendingInstructions.get(sessionId) ?? this.#episodes.boundInstruction(sessionId);
    if (!pending) throw new Error('EDIT_USER_INSTRUCTION_REQUIRED');
    this.#pendingInstructions.delete(sessionId);
    const task = this.startTask(sessionId, {
      ...pending,
      policy: policy ?? this.#sessionPolicies.get(sessionId) ?? 'auto-safe',
    });
    this.#episodes.start(sessionId, pending, task.baseRef);
    return task;
  }

  setSessionPolicy(sessionId: string, policy: 'review' | 'auto-safe'): void {
    this.#sessionPolicies.set(sessionId, policy);
    const current = this.#tasks.get(sessionId);
    if (policy === 'review' && current?.active && current.ref.policy === 'auto-safe') {
      current.ref = { ...current.ref, policy: 'review', stateEpoch: current.ref.stateEpoch + 1 };
    }
  }

  projectSelection(sessionId: string, input: {
    expectedRef: { drawingId: string; revision: number };
    nodeIds: string[];
  }):
    | { status: 'projected'; projection: SelectionProjectionRef }
    | { status: 'cleared' }
    | { status: 'stale'; currentRef: { drawingId: string; revision: number } }
    | { status: 'rejected'; code: string; message: string } {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: 'rejected', code: 'DRAWING_REQUIRED', message: 'No Drawing is loaded.' };
    if (
      snapshot.ref.drawingId !== input.expectedRef.drawingId
      || snapshot.ref.revision !== input.expectedRef.revision
    ) return { status: 'stale', currentRef: structuredClone(snapshot.ref) };
    const ids = [...new Set(input.nodeIds)];
    if (ids.length === 0) {
      this.#selectionProjections.delete(sessionId);
      return { status: 'cleared' };
    }
    if (ids.length > 256) {
      return { status: 'rejected', code: 'SELECTION_SIZE_INVALID', message: 'Select between 1 and 256 Drawing nodes.' };
    }
    const visible = new Map(allNodes(snapshot.document).map((node) => [String(node.id), node.visible]));
    if (ids.some((id) => visible.get(id) !== true)) {
      return { status: 'rejected', code: 'SELECTION_NODE_INVALID', message: 'Selection contains a missing or hidden node.' };
    }
    const projection: SelectionProjectionRef = {
      selectionProjectionId: this.ports.id('selection'),
      drawingRef: structuredClone(snapshot.ref),
      nodeIds: ids,
      projectionDigest: this.ports.digest(canonicalString({ ref: snapshot.ref, nodeIds: [...ids].sort() })),
      expiresAt: this.ports.now() + 10 * 60_000,
    };
    this.#selectionProjections.set(sessionId, projection);
    return { status: 'projected', projection: structuredClone(projection) };
  }

  currentSelectionProjection(sessionId: string): SelectionProjectionRef | null {
    const projection = this.#selectionProjections.get(sessionId);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (
      !projection
      || projection.expiresAt <= this.ports.now()
      || !snapshot
      || projection.drawingRef.drawingId !== snapshot.ref.drawingId
      || projection.drawingRef.revision !== snapshot.ref.revision
    ) {
      if (projection) this.#selectionProjections.delete(sessionId);
      return null;
    }
    return structuredClone(projection);
  }

  startTask(sessionId: string, input: {
    objective: string;
    rootUserMessageDigest: string;
    policy: 'review' | 'auto-safe';
  }): TaskRef {
    this.#episodes.invalidate(sessionId, 'task-replaced');
    this.#episodeSelections.delete(sessionId);
    this.#currentOperations.delete(sessionId);
    this.#terminalFinalizeResults.delete(sessionId);
    const snapshot = this.#snapshot(sessionId);
    const former = this.#tasks.get(sessionId);
    if (former) former.active = false;
    const workspacePreview = this.drawings.getPreview(sessionId);
    if (workspacePreview) this.drawings.discardPreview(sessionId, { handle: workspacePreview.handle });
    this.#previews.delete(sessionId);
    this.#groundingOverlays.delete(sessionId);
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

  async observeCurrent(sessionId: string): Promise<{
    state: 'observed';
    drawing: { drawingId: string; revision: number };
    selectionAvailable: boolean;
    selectionCandidates: Array<{ key: string; summary: string }>;
    numericConstraints: Array<{ numericKey: string; kind: string; value: number | [number, number]; unit: string }>;
    nextTools: string[];
  }> {
    const snapshot = this.#snapshot(sessionId);
    let episode = this.#episodes.current(sessionId, snapshot.ref);
    if (!episode) {
      this.startBoundTask(sessionId);
      episode = this.#episodes.current(sessionId, snapshot.ref);
    }
    if (!episode) throw new Error('EDIT_EPISODE_REQUIRED');
    const task = this.#tasks.get(sessionId);
    if (!task?.active) throw new Error('EDIT_TASK_REQUIRED');

    const existing = this.#episodeSelections.get(sessionId);
    if (existing?.episodeId === episode.episodeId) {
      return this.#currentObservationResult(sessionId, episode.instruction, snapshot.ref);
    }

    const observation = await this.observe(sessionId, { taskId: task.ref.taskId });
    const context = this.buildContext(sessionId, {
      taskId: task.ref.taskId,
      observationId: observation.observationId,
    });
    const transitioned = this.#episodes.transition(sessionId, episode.stateEpoch, {
      kind: 'observed',
      observation: { observationId: observation.observationId, contextId: context.contextId },
    });
    this.#episodeSelections.set(sessionId, {
      episodeId: transitioned.episodeId,
      taskId: task.ref.taskId,
      observationId: observation.observationId,
      contextId: context.contextId,
      ledger: new GroundingLedger({
        episodeId: transitioned.episodeId,
        drawingId: snapshot.ref.drawingId as never,
        revision: String(snapshot.ref.revision) as never,
      }),
      selectedParts: {},
      groundings: {},
      candidates: new Map(),
      nextCandidate: 0,
    });
    return this.#currentObservationResult(sessionId, transitioned.instruction, snapshot.ref);
  }

  selectCurrentParts(
    sessionId: string,
    rawRequest: DrawingSelectPartsRequest,
  ): CurrentPartSelectionResult {
    const existingEpisode = this.#episodes.current(sessionId);
    if (!existingEpisode) {
      return { state: 'invalid_state', code: 'EDIT_EPISODE_REQUIRED', nextTools: ['drawing_observe'] };
    }
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot || !this.#episodes.current(sessionId, snapshot.ref)) {
      this.#episodeSelections.delete(sessionId);
      this.#groundingOverlays.delete(sessionId);
      return { state: 'reobserve_required', code: 'EDIT_BASE_STALE', nextTools: ['drawing_observe'] };
    }
    const episode = this.#episodes.current(sessionId)!;
    const state = this.#episodeSelections.get(sessionId);
    const task = this.#tasks.get(sessionId);
    if (!state || state.episodeId !== episode.episodeId || !task?.active) {
      return { state: 'invalid_state', code: 'EDIT_OBSERVATION_REQUIRED', nextTools: ['drawing_observe'] };
    }
    const request = drawingSelectPartsRequestSchema.parse(rawRequest);
    const resolved: Array<{
      partKey: string;
      label: string;
      nodeIds: string[];
    }> = [];

    for (const part of request.parts) {
      let candidates: EpisodeSelectionCandidate[];
      try {
        candidates = this.#resolvePartCandidates(sessionId, snapshot.document, snapshot.ref, state, episode.stateEpoch, part);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'EDIT_SELECTION_UNRESOLVED';
        return { state: 'invalid_state', code, nextTools: ['drawing_select_parts'] };
      }
      if (candidates.length === 0) {
        return { state: 'invalid_state', code: 'EDIT_SELECTION_UNRESOLVED', nextTools: ['drawing_select_parts'] };
      }
      if (candidates.length > 1) {
        const safeCandidates = candidates.slice(0, 8).map((candidate) => {
          const key = `c${++state.nextCandidate}`;
          state.candidates.set(key, { ...candidate, key, stateEpoch: episode.stateEpoch });
          return { key, summary: candidate.summary };
        });
        return {
          state: 'selection_ambiguous',
          partKey: part.partKey,
          candidates: safeCandidates,
          nextTools: ['drawing_select_parts'],
        };
      }
      resolved.push({ partKey: part.partKey, label: part.label, nodeIds: candidates[0]!.nodeIds });
    }

    const selectedResult: Extract<CurrentPartSelectionResult, { state: 'selected' }>['parts'] = [];
    for (const part of resolved) {
      const grounding = this.ground(sessionId, {
        taskId: state.taskId,
        contextId: state.contextId,
        targetNodeIds: part.nodeIds,
        interfaces: inferSelectionInterfaces(snapshot.document, part.nodeIds, snapshot.ref.revision),
        partKey: part.partKey,
        label: part.label,
      });
      const internal = this.#groundings.get(grounding.groundingId);
      if (!internal) throw new Error('EDIT_GROUNDING_REQUIRED');
      state.selectedParts[part.partKey] = structuredClone(internal.target);
      state.groundings[part.partKey] = internal;
      this.#appendGroundingEvidence(state, episode, snapshot.ref, part, grounding);
      selectedResult.push({
        partKey: part.partKey,
        label: part.label,
        sourceStatus: internal.target.sourceStatus,
        nodeCount: internal.target.targetNodeIds.length,
        interfaceCount: internal.target.interfaces.length,
      });
    }
    state.candidates.clear();
    const transitioned = this.#episodes.transition(sessionId, episode.stateEpoch, {
      kind: 'selected', semanticRequest: request,
      selection: { partKeys: resolved.map(({ partKey }) => partKey) },
    });
    const overlay = this.#groundingOverlays.get(sessionId);
    if (overlay) this.#groundingOverlays.set(sessionId, {
      ...overlay,
      stateEpoch: transitioned.stateEpoch,
      disposition: 'active',
    });
    return { state: 'selected', parts: selectedResult, nextTools: ['drawing_preview_spatial_intent'] };
  }

  currentSelectedParts(sessionId: string): Record<string, GroundedEditTarget> {
    const episode = this.#episodes.current(sessionId);
    const state = this.#episodeSelections.get(sessionId);
    if (!episode || !state || state.episodeId !== episode.episodeId) return {};
    return structuredClone(state.selectedParts);
  }

  currentGroundingLedger(sessionId: string): GroundingEvidenceEvent[] {
    const episode = this.#episodes.current(sessionId);
    const state = this.#episodeSelections.get(sessionId);
    return episode && state?.episodeId === episode.episodeId ? state.ledger.events() : [];
  }

  previewCurrentIntent(
    sessionId: string,
    rawIntent: SpatialIntentRequest,
  ): PreviewRef {
    const intent = spatialIntentRequestSchema.parse(rawIntent) as SpatialIntentRequest;
    const snapshot = this.#snapshot(sessionId);
    const episode = this.#episodes.current(sessionId, snapshot.ref);
    const selection = this.#episodeSelections.get(sessionId);
    const task = this.#tasks.get(sessionId);
    if (!episode || !selection || selection.episodeId !== episode.episodeId || !task?.active) {
      throw new Error('EDIT_SELECTION_REQUIRED');
    }
    if (Object.keys(selection.selectedParts).length === 0) throw new Error('EDIT_SELECTION_REQUIRED');
    const intentDigest = this.ports.digest(canonicalString(intent));
    const currentPreview = this.#previews.get(sessionId);
    if (currentPreview?.intentDigest === intentDigest && currentPreview.task === task) {
      return structuredClone(currentPreview.ref);
    }
    if (task.candidateCount >= 3) throw new Error('EDIT_CANDIDATE_BUDGET_EXHAUSTED');
    const compilation = solveSpatialIntent({
      document: snapshot.document,
      baseRef: snapshot.ref,
      parts: selection.selectedParts,
      intent,
      numericConstraints: episode.instruction.numericConstraints,
      ports: this.ports,
    });
    const selectedPartScopeDigests = Object.fromEntries(Object.keys(selection.selectedParts).sort().map((partKey) => {
      const part = selection.selectedParts[partKey]!;
      return [partKey, this.ports.digest(canonicalString({
        targetNodeIds: [...part.targetNodeIds].sort(),
        interfaces: part.interfaces
          .map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
          .sort((left, right) => left.interfaceId.localeCompare(right.interfaceId)),
      }))];
    }));
    const referencedNumericKeys = new Set(intent.goals.flatMap((goal) => (
      goal.kind === 'explicit_numeric' ? [goal.numericKey] : []
    )));
    const numericEvidenceDigests = episode.instruction.numericConstraints
      .filter(({ numericKey }) => referencedNumericKeys.has(numericKey))
      .map((constraint) => this.ports.digest(canonicalString(constraint)));
    const solverProvenance: DrawingSolverProvenance = {
      solverVersion: compilation.solver.version,
      canonicalIntentDigest: intentDigest,
      selectedPartScopeDigests,
      numericEvidenceDigests,
      receipt: structuredClone(compilation.solver),
    };
    const groundings = Object.keys(selection.groundings).sort().map((partKey) => selection.groundings[partKey]!);
    const ref = this.#storeCompilation(
      sessionId, task, snapshot.ref, groundings, compilation, intent.summary,
    );
    const stored = this.#previews.get(sessionId);
    if (!stored) throw new Error('EDIT_PREVIEW_STALE');
    stored.intent = structuredClone(intent);
    stored.intentDigest = intentDigest;
    stored.solverProvenance = solverProvenance;
    const transitioned = this.#episodes.transition(sessionId, episode.stateEpoch, {
      kind: 'preview_ready',
      semanticRequest: intent,
      preview: { candidateDigest: ref.candidateDigest, effectDigest: ref.effectDigest },
    });
    this.#currentOperations.set(sessionId, {
      operationId: ref.finalizeOperationId,
      operationBindingDigest: ref.finalizeOperationBindingDigest,
    });
    this.#terminalFinalizeResults.delete(sessionId);
    if (transitioned.candidateCount > 3) throw new Error('EDIT_CANDIDATE_BUDGET_EXHAUSTED');
    return structuredClone(ref);
  }

  reviseCurrentIntent(sessionId: string, rawRevision: SpatialIntentRevision): PreviewRef {
    const revision = spatialIntentRevisionSchema.parse(rawRevision) as SpatialIntentRevision;
    const current = this.#previews.get(sessionId);
    if (!current?.intent) throw new Error('EDIT_PREVIEW_REQUIRED');
    return this.previewCurrentIntent(sessionId, {
      summary: current.intent.summary,
      goals: revision.goalDelta,
      preserve: revision.preserveDelta ?? current.intent.preserve,
    });
  }

  evaluateCurrentPreview(sessionId: string, signal?: AbortSignal) {
    const preview = this.#previews.get(sessionId);
    if (!preview) throw new Error('EDIT_PREVIEW_REQUIRED');
    return this.evaluatePreview(sessionId, {
      taskId: preview.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      signal,
    });
  }

  finalizeCurrentPreview(sessionId: string, confirmed = false): FinalizePreviewResult {
    const replay = this.#terminalFinalizeResults.get(sessionId);
    if (replay) return structuredClone(replay);
    const preview = this.#previews.get(sessionId);
    if (!preview) throw new Error('EDIT_PREVIEW_REQUIRED');
    const evaluated = [...this.#evaluations.values()].reverse().find(({ ref }) => (
      ref.previewHandle === preview.ref.previewHandle
      && ref.candidateDigest === preview.ref.candidateDigest
    ));
    if (!evaluated) throw new Error('EDIT_EVALUATION_REQUIRED');
    const request = {
      previewHandle: preview.ref.previewHandle,
      previewDigest: preview.ref.candidateDigest,
      finalizeOperationId: preview.ref.finalizeOperationId,
      finalizeOperationBindingDigest: preview.ref.finalizeOperationBindingDigest,
      evaluationId: evaluated.ref.evaluationId,
    };
    const result = confirmed
      ? this.confirmFinalize(sessionId, request)
      : this.finalizePreview(sessionId, request);
    if (result.status === 'committed' || result.status === 'already-satisfied') {
      const episode = this.#episodes.current(sessionId);
      if (episode) this.#episodes.transition(sessionId, episode.stateEpoch, {
        kind: 'committed', receipt: result,
      });
      const task = this.#tasks.get(sessionId);
      if (task) task.active = false;
      this.#episodeSelections.delete(sessionId);
      this.#groundingOverlays.delete(sessionId);
      this.#terminalFinalizeResults.set(sessionId, structuredClone(result));
    }
    return result;
  }

  discardCurrentPreview(sessionId: string) {
    const preview = this.#previews.get(sessionId);
    if (!preview) throw new Error('EDIT_PREVIEW_REQUIRED');
    const result = this.discardPreview(sessionId, preview.ref.previewHandle);
    const episode = this.#episodes.current(sessionId);
    if (episode) this.#episodes.transition(sessionId, episode.stateEpoch, { kind: 'discarded' });
    this.#episodeSelections.delete(sessionId);
    this.#currentOperations.delete(sessionId);
    this.#terminalFinalizeResults.delete(sessionId);
    return result;
  }

  getCurrentOperation(sessionId: string): OperationLookupResult {
    const operation = this.#currentOperations.get(sessionId);
    return operation
      ? this.drawings.getOperation(sessionId, operation.operationId, operation.operationBindingDigest)
      : { status: 'absent' };
  }

  #currentObservationResult(
    sessionId: string,
    instruction: BoundUserInstruction,
    drawingRef: { drawingId: string; revision: number },
  ) {
    const state = this.#episodeSelections.get(sessionId);
    const episode = this.#episodes.current(sessionId, drawingRef);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (state && episode && snapshot && state.candidates.size === 0) {
      const nodes = snapshot.document.geometry
        .filter(({ visible }) => visible)
        .map((node) => ({
          node,
          size: geometryNodeSize(node),
        }))
        .sort((left, right) => right.size - left.size
          || String(left.node.id).localeCompare(String(right.node.id)))
        .slice(0, 64);
      for (const { node } of nodes) {
        const key = `c${++state.nextCandidate}`;
        state.candidates.set(key, {
          ...selectionCandidate(snapshot.document, [String(node.id)], 0, episode.stateEpoch),
          key,
        });
      }
    }
    return {
      state: 'observed' as const,
      drawing: structuredClone(drawingRef),
      selectionAvailable: this.currentSelectionProjection(sessionId) !== null,
      selectionCandidates: state
        ? [...state.candidates.values()].map(({ key, summary }) => ({ key, summary }))
        : [],
      numericConstraints: instruction.numericConstraints.map(({ numericKey, kind, value, unit }) => ({
        numericKey, kind, value: Array.isArray(value) ? [value[0]!, value[1]!] as [number, number] : value, unit,
      })),
      nextTools: ['drawing_select_parts'],
    };
  }

  #resolvePartCandidates(
    sessionId: string,
    document: DrawingDocument,
    drawingRef: { drawingId: string; revision: number },
    state: EpisodeSelectionState,
    stateEpoch: number,
    part: SemanticPartSelection,
  ): EpisodeSelectionCandidate[] {
    const perReference = part.references.map((reference): EpisodeSelectionCandidate[] => {
      if (reference.kind === 'current_selection') {
        const projection = this.#currentSelectionProjectionForRef(sessionId, drawingRef);
        return projection ? [selectionCandidate(document, projection.nodeIds, 0, stateEpoch)] : [];
      }
      if (reference.kind === 'candidate') {
        const candidate = state.candidates.get(reference.key);
        if (!candidate || candidate.stateEpoch !== stateEpoch) throw new Error('EDIT_CANDIDATE_EXPIRED');
        return [structuredClone(candidate)];
      }
      if (reference.kind === 'semantic_query') {
        const exact = semanticCandidates(document, reference.text, stateEpoch);
        return exact.length > 0
          ? exact
          : visualFallbackCandidates(state.candidates.values(), reference.text, stateEpoch);
      }
      const observation = this.#observations.get(state.observationId);
      if (!observation?.view) throw new Error('EDIT_OBSERVATION_VIEW_REQUIRED');
      const resolvePoint = (normalized: readonly [number, number]) => resolveSpatialPoint({
        kind: 'observation', observationId: state.observationId, normalized,
      }, {
        document,
        drawingId: drawingRef.drawingId as never,
        revision: String(drawingRef.revision) as never,
        readObservationView: (observationId) => observationId === state.observationId ? {
          drawingId: drawingRef.drawingId as never,
          revision: String(drawingRef.revision) as never,
          view: observation.view!,
        } : null,
      });
      if (reference.kind === 'observation_point') {
        return pointCandidates(document, resolvePoint([reference.normalized[0]!, reference.normalized[1]!]), stateEpoch);
      }
      return regionCandidates(document, reference.polygon.map((point) => resolvePoint([point[0]!, point[1]!])), stateEpoch);
    });

    const resolvedReferences = perReference.filter((candidates) => candidates.length > 0);
    const combinations = resolvedReferences
      .reduce<EpisodeSelectionCandidate[][]>((current, alternatives) => (
        current.flatMap((combination) => alternatives.map((candidate) => [...combination, candidate])).slice(0, 64)
      ), [[]]);
    const combined = resolvedReferences.length > 1
      ? combinations.map((combination) => selectionCandidate(
        document,
        [...new Set(combination.flatMap(({ nodeIds }) => nodeIds))],
        combination.reduce((score, candidate) => score + candidate.score, 0),
        stateEpoch,
      ))
      : resolvedReferences.flat();
    const candidates = new Map<string, EpisodeSelectionCandidate>();
    for (const candidate of combined) {
      const identity = [...candidate.nodeIds].sort().join('\0');
      const current = candidates.get(identity);
      if (!current || candidate.score < current.score) candidates.set(identity, candidate);
    }
    for (const exclusion of part.exclude ?? []) {
      if (exclusion.kind === 'candidate') {
        const excluded = state.candidates.get(exclusion.value);
        if (excluded) candidates.delete([...excluded.nodeIds].sort().join('\0'));
        continue;
      }
      for (const [identity, candidate] of candidates) {
        if (candidate.nodeIds.some((nodeId) => semanticNodeMatches(document, nodeId, exclusion.value))) {
          candidates.delete(identity);
        }
      }
    }
    return [...candidates.values()]
      .sort((left, right) => left.score - right.score
        || left.nodeIds.join('\0').localeCompare(right.nodeIds.join('\0')))
      .slice(0, 8);
  }

  #currentSelectionProjectionForRef(
    sessionId: string,
    drawingRef: { drawingId: string; revision: number },
  ): SelectionProjectionRef | null {
    const projection = this.#selectionProjections.get(sessionId);
    return projection
      && projection.drawingRef.drawingId === drawingRef.drawingId
      && projection.drawingRef.revision === drawingRef.revision
      && projection.expiresAt > this.ports.now()
      ? structuredClone(projection)
      : null;
  }

  #appendGroundingEvidence(
    state: EpisodeSelectionState,
    episode: { episodeId: string },
    drawingRef: { drawingId: string; revision: number },
    part: { partKey: string; label: string; nodeIds: string[] },
    grounding: GroundingRef,
  ): void {
    const hypothesisId = this.ports.id('hypothesis');
    const evidenceRefs = [state.observationId];
    const hypothesis = {
      id: hypothesisId,
      drawingId: drawingRef.drawingId as never,
      revision: String(drawingRef.revision) as never,
      label: part.label,
      referringExpression: part.partKey,
      observationRefs: [state.observationId],
      regionRefs: [],
      supports: [
        ...part.nodeIds.map((nodeId) => ({
          kind: 'node' as const, ref: nodeId, weight: 1, role: 'interior' as const,
        })),
        ...grounding.interfaces.map(({ interfaceId }) => ({
          kind: 'half-edge' as const, ref: interfaceId, weight: 1, role: 'interface' as const,
        })),
      ],
      excludedSupports: [],
      interfaceRefs: grounding.interfaces.map(({ interfaceId }) => interfaceId),
      confidence: 1,
      provenance: { provider: 'vectorai-host', evidenceRefs, createdAt: this.ports.now() },
    };
    state.ledger.append({
      id: this.ports.id('grounding-event'),
      episodeId: episode.episodeId,
      drawingId: drawingRef.drawingId as never,
      revision: String(drawingRef.revision) as never,
      hypothesisId,
      kind: 'proposed',
      hypothesis,
      evidenceRefs,
      reasonCode: 'MODEL_SEMANTIC_SELECTION',
      createdAt: this.ports.now(),
    });
    state.ledger.append({
      id: this.ports.id('grounding-event'),
      episodeId: episode.episodeId,
      drawingId: drawingRef.drawingId as never,
      revision: String(drawingRef.revision) as never,
      hypothesisId,
      kind: 'selected',
      evidenceRefs,
      reasonCode: 'HOST_SELECTION_RESOLVED',
      createdAt: this.ports.now(),
    });
  }

  async observe(sessionId: string, input: { taskId: string }): Promise<ObservationRef> {
    const task = this.#task(sessionId, input.taskId);
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const selection = this.currentSelectionProjection(sessionId);
    const viewport = this.drawings.summarize(sessionId)?.bounds
      ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const rendered = this.ports.renderObservation
      ? await this.ports.renderObservation({
          document: snapshot.document,
          viewport,
          selectedNodeIds: selection?.nodeIds ?? [],
        })
      : undefined;
    const basis = { kind: 'canonical' as const, ref: structuredClone(snapshot.ref) };
    const semanticContentDigest = this.ports.digest(canonicalSemanticString(snapshot.document));
    const ref: ObservationRef = {
      observationId: this.ports.id('observation'),
      taskId: task.ref.taskId,
      basis,
      artifactRefs: [{
        id: rendered ? String(rendered.attachment.attachmentId) : this.ports.id('observation-artifact'),
        contentDigest: rendered?.contentDigest ?? semanticContentDigest,
        mimeType: 'image/png',
        basis,
      }],
      ...(selection ? { selectionProjectionId: selection.selectionProjectionId } : {}),
      observationDigest: this.ports.digest(canonicalString({
        taskId: task.ref.taskId,
        ref: snapshot.ref,
        semanticContentDigest,
        artifactContentDigest: rendered?.contentDigest ?? semanticContentDigest,
        selectionProjectionDigest: selection?.projectionDigest,
      })),
    };
    this.#observations.set(ref.observationId, {
      ref,
      ...(rendered ? {
        attachment: rendered.attachment,
        view: {
          width: rendered.width,
          height: rendered.height,
          worldToImage: rendered.worldToImage,
        },
      } : {}),
    });
    return structuredClone(ref);
  }

  observationAttachment(observationId: string): ImageAttachmentRef | null {
    const attachment = this.#observations.get(observationId)?.attachment;
    return attachment ? structuredClone(attachment) : null;
  }

  currentObservationAttachment(sessionId: string): ImageAttachmentRef | null {
    const episode = this.#episodes.current(sessionId);
    const selection = this.#episodeSelections.get(sessionId);
    if (!episode || !selection || selection.episodeId !== episode.episodeId) return null;
    return this.observationAttachment(selection.observationId);
  }

  currentPreviewPresentation(sessionId: string): {
    state: 'preview_ready';
    summary: string;
    changedNodeCount: number;
    solver?: {
      candidateCount: number;
      goalResidual: number;
      movementCost: number;
      deformationCost: number;
      collisionPenalty: number;
      topologyPenalty: number;
    };
    nextTools: ['drawing_evaluate_preview'];
  } {
    const preview = this.#previews.get(sessionId);
    if (!preview) throw new Error('EDIT_PREVIEW_REQUIRED');
    const effect = preview.compilation.actualEffect;
    const receipt = preview.solverProvenance?.receipt;
    return {
      state: 'preview_ready',
      summary: preview.intent?.summary ?? preview.program?.summary ?? '',
      changedNodeCount: effect.createdNodeIds.length + effect.updatedNodeIds.length + effect.deletedNodeIds.length,
      ...(receipt ? {
        solver: {
          candidateCount: receipt.candidateCount,
          goalResidual: receipt.goalResidual,
          movementCost: receipt.movementCost,
          deformationCost: receipt.deformationCost,
          collisionPenalty: receipt.collisionPenalty,
          topologyPenalty: receipt.topologyPenalty,
        },
      } : {}),
      nextTools: ['drawing_evaluate_preview'],
    };
  }

  buildContext(sessionId: string, input: { taskId: string; observationId: string }): SemanticContextRef {
    const task = this.#task(sessionId, input.taskId);
    const observation = this.#observations.get(input.observationId);
    if (!observation || observation.ref.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const world = new WorldModelCompiler({ digest: this.ports.digest }).compile(
      snapshot.document,
      String(snapshot.ref.revision) as never,
      { limit: 2_000 },
    );
    const geometryFacts = snapshot.document.geometry.slice(0, 512).map((node) => ({
      nodeId: String(node.id),
      type: node.type,
      quality: node.quality.status,
      center: geometryCenter(node),
      bounds: geometryNodeBounds(node),
    }));
    const connectedCarrierFacts = findConnectedCarrierCandidates(snapshot.document).map((candidate) => ({
      ...candidate,
      interfaces: findConnectedCarrierInterfaces(snapshot.document, candidate.carrierNodeId)
        .map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })),
    }));
    const topology = buildGeometryTopologyGraph({
      document: snapshot.document,
      revision: String(snapshot.ref.revision) as never,
    });
    const topologyFacts = {
      segmentCount: topology.segments.length,
      vertexCount: topology.vertices.length,
      interfaceVertices: topology.vertices.flatMap((vertex) => {
        const nodeIds = [...new Set(vertex.incidentSegmentIds.flatMap((segmentId) => {
          const segment = topology.segment(segmentId);
          return segment ? [String(segment.nodeId)] : [];
        }))].sort();
        return nodeIds.length > 1
          ? [{ vertexId: vertex.id, point: structuredClone(vertex.point), nodeIds }]
          : [];
      }).slice(0, 512),
    };
    const knowledgeStatus = world.knowledge.state === 'resolved'
      ? 'complete' as const
      : world.knowledge.state === 'partial' ? 'partial' as const : 'unknown' as const;
    const coordinateSystem = {
      space: 'world' as const,
      positiveX: 'right' as const,
      positiveY: 'up' as const,
      negativeX: 'left' as const,
      negativeY: 'down' as const,
      positiveRotation: 'counterclockwise' as const,
      modelRotationUnit: 'degrees' as const,
    };
    const ref: SemanticContextRef = {
      contextId: this.ports.id('context'),
      taskId: task.ref.taskId,
      observationId: observation.ref.observationId,
      coordinateSystem,
      geometryFacts,
      connectedCarrierFacts,
      topologyFacts,
      knowledge: {
        status: knowledgeStatus,
        worldModelVersion: world.compilerVersion,
        unresolvedBoundaryRefs: world.knowledge.unresolvedBoundaryRefs,
      },
      contextDigest: this.ports.digest(canonicalString({
        observationDigest: observation.ref.observationDigest,
        coordinateSystem,
        geometryFacts,
        connectedCarrierFacts,
        topologyFacts,
        worldInputDigest: world.inputDigest,
        worldKnowledge: world.knowledge,
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
    selectionProjectionId?: string;
    partKey?: string;
    label?: string;
  }): GroundingRef {
    const task = this.#task(sessionId, input.taskId);
    const context = this.#contexts.get(input.contextId);
    if (!context || context.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const nodes = new Map(allNodes(snapshot.document).map((node) => [String(node.id), node]));
    const selectionProjectionId = input.selectionProjectionId?.trim() || undefined;
    const projection = selectionProjectionId === undefined
      ? null
      : this.currentSelectionProjection(sessionId);
    if (selectionProjectionId !== undefined && projection?.selectionProjectionId !== selectionProjectionId) {
      throw new Error('EDIT_SELECTION_PROJECTION_STALE');
    }
    const targetNodeIds = projection ? [...projection.nodeIds] : [...new Set(input.targetNodeIds)];
    if (
      projection
      && input.targetNodeIds.length > 0
      && canonicalString([...new Set(input.targetNodeIds)].sort()) !== canonicalString([...targetNodeIds].sort())
    ) throw new Error('EDIT_SELECTION_SCOPE_MISMATCH');
    if (targetNodeIds.length === 0 || targetNodeIds.some((id) => !nodes.has(id))) {
      throw new Error('EDIT_TARGET_UNRESOLVED');
    }
    const discoveredInterfaces = inferSelectionInterfaces(
      snapshot.document,
      targetNodeIds,
      snapshot.ref.revision,
    );
    const discoveredIds = new Set(discoveredInterfaces.map(({ interfaceId }) => interfaceId));
    const interfaces = input.interfaces.length > 0
      ? structuredClone(input.interfaces)
      : discoveredInterfaces;
    for (const port of interfaces) {
      const node = nodes.get(port.nodeId);
      if (!node || node.type !== 'line' || !port.endpoint) throw new Error('EDIT_INTERFACE_UNRESOLVED');
      if (discoveredInterfaces.length > 0 && !discoveredIds.has(port.interfaceId)) {
        throw new Error('EDIT_INTERFACE_NOT_CONTACTED');
      }
    }
    const sourceStatus: GroundedEditTarget['sourceStatus'] = snapshot.provisional
      ? 'provisional'
      : targetNodeIds.some((id) => nodes.get(id)?.quality.status !== 'confirmed')
        ? 'candidate'
        : 'confirmed';
    const targetHandle = this.ports.id('target');
    const target: GroundedEditTarget = {
      targetHandle,
      targetNodeIds,
      interfaces,
      sourceStatus,
    };
    const ref: GroundingRef = {
      groundingId: this.ports.id('grounding'),
      taskId: task.ref.taskId,
      contextId: context.contextId,
      targetHandle,
      targetNodeIds: [...target.targetNodeIds],
      interfaces: target.interfaces.map((port) => ({
        interfaceId: port.interfaceId,
        nodeId: port.nodeId,
        endpoint: port.endpoint!,
      })),
      targetScopeDigest: this.ports.digest(canonicalString([...target.targetNodeIds].sort())),
      protectedScopeDigest: this.ports.digest(canonicalString(
        allNodes(snapshot.document).map(({ id }) => String(id))
          .filter((id) => !target.targetNodeIds.includes(id) && !target.interfaces.some((port) => port.nodeId === id))
          .sort(),
      )),
      evidenceDigest: this.ports.digest(canonicalString({
        context: context.contextDigest,
        sourceStatus,
        selectionProjectionDigest: projection?.projectionDigest,
      })),
    };
    this.#groundings.set(ref.groundingId, { ref, target });
    this.#updateGroundingOverlay(sessionId, task, snapshot.ref, ref, input.partKey, input.label);
    return structuredClone(ref);
  }

  currentGroundingOverlay(sessionId: string): DrawingGroundingOverlay | null {
    const overlay = this.#groundingOverlays.get(sessionId);
    const task = this.#tasks.get(sessionId);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (
      !overlay
      || !task?.active
      || overlay.taskId !== task.ref.taskId
      || !snapshot
      || overlay.drawingRef.drawingId !== snapshot.ref.drawingId
      || overlay.drawingRef.revision !== snapshot.ref.revision
    ) {
      if (overlay) this.#groundingOverlays.delete(sessionId);
      return null;
    }
    return structuredClone(overlay);
  }

  resolveCurrentPreview(sessionId: string, previewHandle: string): PreviewRef {
    const preview = this.#previews.get(sessionId);
    if (!preview || preview.ref.previewHandle !== previewHandle) throw new Error('EDIT_PREVIEW_STALE');
    return structuredClone(preview.ref);
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
    return this.#storeCompilation(sessionId, task, snapshot.ref, [grounding], compilation, program.summary, program);
  }

  previewMultiPartTransform(
    sessionId: string,
    raw: MultiPartTransformRequest,
  ): PreviewRef {
    const input = multiPartTransformRequestSchema.parse(raw);
    const task = this.#task(sessionId, input.taskId);
    if (task.candidateCount >= 3) throw new Error('EDIT_CANDIDATE_BUDGET_EXHAUSTED');
    const groundings = input.parts.map(({ groundingId }) => {
      const grounding = this.#groundings.get(groundingId);
      if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
      return grounding;
    });
    const contextId = groundings[0]?.ref.contextId;
    if (!contextId || groundings.some(({ ref }) => ref.contextId !== contextId)) {
      throw new Error('EDIT_CONTEXT_MISMATCH');
    }
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const compilation = compileMultiPartTransform({
      document: snapshot.document,
      baseRef: task.ref.baseRef,
      objective: task.objective,
      summary: input.summary,
      parts: input.parts.map((part, index) => ({
        groundingId: part.groundingId,
        grounding: groundings[index]!.target,
        translation: [part.translation[0]!, part.translation[1]!],
        ...(part.rotationRadians === undefined ? {} : {
          rotationRadians: part.rotationRadians,
          pivot: [part.pivot![0]!, part.pivot![1]!],
        }),
      })),
      ports: this.ports,
    });
    return this.#storeCompilation(
      sessionId, task, snapshot.ref, groundings, compilation, input.summary,
    );
  }

  reviseMultiPartTransform(
    sessionId: string,
    raw: MultiPartTransformRevisionRequest,
  ): PreviewRef {
    const input = multiPartTransformRevisionRequestSchema.parse(raw);
    const current = this.#preview(
      sessionId, input.currentPreviewHandle, input.currentCandidateDigest,
    );
    if (current.ref.taskId !== input.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    return this.previewMultiPartTransform(sessionId, {
      taskId: input.taskId,
      parts: input.parts,
      summary: input.summary,
    });
  }

  previewGroundedTransform(sessionId: string, input: {
    taskId: string;
    groundingId: string;
    translation: [number, number];
    rotationDegrees?: number;
    pivot?: [number, number];
    summary: string;
  }): PreviewRef {
    const task = this.#task(sessionId, input.taskId);
    const grounding = this.#groundings.get(input.groundingId);
    if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    const translation = finiteVec2(input.translation, 'EDIT_TRANSLATION_INVALID');
    const rotationDegrees = input.rotationDegrees;
    if (rotationDegrees !== undefined && !Number.isFinite(rotationDegrees)) throw new Error('EDIT_ROTATION_INVALID');
    const snapshot = this.#snapshotAtTask(sessionId, task);
    const interfaces = grounding.target.interfaces.map(({ interfaceId }) => interfaceId);
    const closedCarrier = grounding.target.targetNodeIds.length === 1
      ? snapshot.document.geometry.find(({ id }) => String(id) === grounding.target.targetNodeIds[0])
      : undefined;
    const operation: SpatialEditProgram['operations'][number] = interfaces.length > 0
      && (closedCarrier?.type === 'circle' || closedCarrier?.type === 'ellipse')
      ? {
          kind: 'connected_transform',
          translation,
          ...(rotationDegrees === undefined ? {} : { rotationRadians: rotationDegrees * Math.PI / 180 }),
          interfaceIds: interfaces,
        }
      : {
          kind: 'rigid_transform',
          translation,
          rotationRadians: (rotationDegrees ?? 0) * Math.PI / 180,
          pivot: input.pivot === undefined
            ? groundedGeometryCenter(snapshot.document, grounding.target.targetNodeIds)
            : finiteVec2(input.pivot, 'EDIT_PIVOT_INVALID'),
        };
    return this.previewProgram(sessionId, {
      taskId: task.ref.taskId,
      groundingId: grounding.ref.groundingId,
      program: {
        baseRef: structuredClone(task.ref.baseRef),
        targetHandle: grounding.target.targetHandle,
        summary: input.summary,
        objective: task.objective,
        operations: [operation],
        preserveScopes: [],
        postconditions: [],
        evidenceRefs: [grounding.ref.evidenceDigest],
      },
    });
  }

  reviseGroundedTransform(sessionId: string, input: {
    taskId: string;
    currentPreviewHandle: string;
    currentCandidateDigest: string;
    groundingId: string;
    translation: [number, number];
    rotationDegrees?: number;
    pivot?: [number, number];
    summary: string;
  }): PreviewRef {
    const current = this.#preview(
      sessionId, input.currentPreviewHandle, input.currentCandidateDigest,
    );
    if (current.ref.taskId !== input.taskId) throw new Error('EDIT_LINEAGE_MISMATCH');
    return this.previewGroundedTransform(sessionId, input);
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
  }): Promise<{
    evaluation: EvaluationRecord;
    assessment: Assessment;
    imageAttachment?: ImageAttachmentRef;
  }> {
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
      const viewport = this.drawings.summarize(sessionId)?.bounds ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
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
          beforeDocument: snapshot.document,
          afterDocument: preview.compilation.candidate,
          viewport,
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
        rendererVersion: reviewed.render?.rendererVersion ?? 'semantic-digest-v1',
        beforeContentDigest,
        afterContentDigest,
        artifactContentDigest: reviewed.render?.contentDigest ?? afterContentDigest,
        comparisonLayout: 'before | after',
        worldToImage: reviewed.render?.worldToImage ?? [1, 0, 0, -1, 0, 0],
        viewport: this.drawings.summarize(sessionId)?.bounds ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        width: reviewed.render?.width ?? 1,
        height: reviewed.render?.height ?? 1,
        overlays: reviewed.render?.overlays ?? ['changed-nodes'],
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
    return {
      evaluation: structuredClone(evaluation),
      assessment: structuredClone(assessment),
      ...(reviewed.render?.attachment
        ? { imageAttachment: structuredClone(reviewed.render.attachment) }
        : {}),
    };
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
    this.#groundingOverlays.delete(sessionId);
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
      ...(preview.solverProvenance ? { solverProvenance: preview.solverProvenance } : {}),
    });
    if (receipt.status === 'no-effect') {
      this.#previews.delete(sessionId);
      this.#groundingOverlays.delete(sessionId);
      return {
        status: 'already-satisfied',
        ref: receipt.ref,
        operationId: receipt.operationId,
        operationBindingDigest: receipt.operationBindingDigest,
      };
    }
    if (receipt.status !== 'committed' || receipt.mode !== 'semantic') {
      throw new Error('EDIT_COMMIT_RECEIPT_INVALID');
    }
    this.#previews.delete(sessionId);
    this.#groundingOverlays.delete(sessionId);
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

  disposeSession(sessionId: string): void {
    const task = this.#tasks.get(sessionId);
    if (task) task.active = false;
    this.#pendingInstructions.delete(sessionId);
    this.#sessionPolicies.delete(sessionId);
    this.#tasks.delete(sessionId);
    this.#previews.delete(sessionId);
    this.#selectionProjections.delete(sessionId);
    this.#groundingOverlays.delete(sessionId);
    this.#episodeSelections.delete(sessionId);
    this.#currentOperations.delete(sessionId);
    this.#terminalFinalizeResults.delete(sessionId);
    this.#episodes.dispose(sessionId);
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
    const observation = await this.observe(sessionId, { taskId: task.taskId });
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
    if (preview.groundings.some(({ target }) => target.sourceStatus !== 'confirmed')) reasons.push('SOURCE_NOT_CONFIRMED');
    if (evaluation.diagnostics.some((diagnostic) => diagnostic.severity !== 'info')) reasons.push('DIAGNOSTICS_PRESENT');
    if (evaluation.review.outcome !== 'satisfied') reasons.push('REVIEW_NOT_SATISFIED');
    const safeAnnotationCreate = preview.program?.operations.every((operation) => (
      operation.kind === 'create_annotation_batch'
      && operation.annotations.every((node) => annotationConfirmed(node))
      && operation.associations.every((node) => associationResolved(node))
    )) ?? false;
    if (
      preview.compilation.actualEffect.deletedNodeIds.length > 0
      || (preview.compilation.actualEffect.createdNodeIds.length > 0 && !safeAnnotationCreate)
    ) {
      reasons.push('LIFECYCLE_CHANGE');
    }
    const allowed = new Set([
      ...preview.groundings.flatMap(({ target }) => target.targetNodeIds),
      ...preview.groundings.flatMap(({ target }) => target.interfaces.map(({ nodeId }) => nodeId)),
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

  #storeCompilation(
    sessionId: string,
    task: TaskState,
    baseRef: { drawingId: string; revision: number },
    groundings: GroundingState[],
    compilation: SpatialCompilation,
    summary: string,
    program?: SpatialEditProgram,
  ): PreviewRef {
    const workspace = this.drawings.createPreview(sessionId, {
      ref: baseRef,
      commands: compilation.forward as never,
      summary,
    });
    if (workspace.status !== 'previewed') {
      throw new Error(workspace.status === 'rejected' ? workspace.code ?? 'EDIT_PREVIEW_REJECTED' : 'EDIT_BASE_STALE');
    }
    const finalizeOperationId = this.ports.id('finalize');
    const finalizeOperationBindingDigest = this.ports.digest(canonicalString({
      mode: 'semantic', sessionId, drawingId: baseRef.drawingId,
      operationId: finalizeOperationId,
      previewHandle: workspace.preview.handle,
      candidateDigest: compilation.candidateDigest,
    }));
    const groundingIds = groundings.map(({ ref }) => ref.groundingId);
    const ref: PreviewRef = {
      previewHandle: workspace.preview.handle,
      taskId: task.ref.taskId,
      groundingId: groundingIds[0]!,
      ...(groundingIds.length > 1 ? { groundingIds } : {}),
      baseRef: structuredClone(baseRef),
      candidateDigest: compilation.candidateDigest,
      effectDigest: compilation.effectDigest,
      finalizeOperationId,
      finalizeOperationBindingDigest,
    };
    task.candidateCount += 1;
    this.#previews.set(sessionId, {
      ref, task, groundings: [...groundings], ...(program ? { program } : {}), compilation,
    });
    this.#groundingOverlays.delete(sessionId);
    return structuredClone(ref);
  }

  #updateGroundingOverlay(
    sessionId: string,
    task: TaskState,
    drawingRef: { drawingId: string; revision: number },
    grounding: GroundingRef,
    rawPartKey?: string,
    rawLabel?: string,
  ): void {
    const partKey = rawPartKey?.trim();
    const label = rawLabel?.trim();
    if (partKey !== undefined && (partKey.length === 0 || partKey.length > 64)) {
      throw new Error('EDIT_PART_KEY_INVALID');
    }
    if (label !== undefined && (label.length === 0 || label.length > 80)) {
      throw new Error('EDIT_PART_LABEL_INVALID');
    }
    if ((partKey === undefined) !== (label === undefined)) throw new Error('EDIT_PART_DISPLAY_PAIR_REQUIRED');
    const current = this.#groundingOverlays.get(sessionId);
    const existingGroups = partKey && current?.taskId === task.ref.taskId
      ? [...current.groups]
      : [];
    const existingIndex = partKey
      ? existingGroups.findIndex((group) => group.partKey === partKey)
      : -1;
    const colorIndex = existingIndex >= 0
      ? existingGroups[existingIndex]!.colorIndex
      : existingGroups.length;
    const group = {
      groundingId: grounding.groundingId,
      partKey: partKey ?? `grounding:${grounding.groundingId}`,
      label: label ?? 'Grounded target',
      colorIndex,
      nodeIds: [...grounding.targetNodeIds].sort(),
      interfaces: grounding.interfaces
        .map((port) => structuredClone(port))
        .sort((left, right) => left.interfaceId.localeCompare(right.interfaceId)),
    };
    if (existingIndex >= 0) existingGroups.splice(existingIndex, 1, group);
    else existingGroups.push(group);
    this.#groundingOverlays.set(sessionId, {
      version: 1,
      drawingRef: structuredClone(drawingRef),
      taskId: task.ref.taskId,
      stateEpoch: task.ref.stateEpoch,
      disposition: 'active',
      groups: existingGroups,
    });
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

function inferSelectionInterfaces(
  document: DrawingDocument,
  targetNodeIds: string[],
  revision: number,
): GroundedEditTarget['interfaces'] {
  const selected = new Set(targetNodeIds);
  const targets = document.geometry.filter((node) => selected.has(String(node.id)));
  const exactCarrierInterfaces = targets.flatMap((target) => (
    target.type === 'circle' || target.type === 'ellipse'
      ? findConnectedCarrierInterfaces(document, String(target.id))
        .map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
      : []
  ));
  if (exactCarrierInterfaces.length > 0) {
    return exactCarrierInterfaces.sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
  }
  const topology = buildGeometryTopologyGraph({
    document,
    revision: String(revision) as never,
  });
  const graphInterfaces = topology.vertices.flatMap((vertex) => {
    const segments = vertex.incidentSegmentIds.flatMap((id) => {
      const segment = topology.segment(id);
      return segment ? [segment] : [];
    });
    if (!segments.some(({ nodeId }) => selected.has(String(nodeId)))) return [];
    return segments.flatMap((segment) => {
      if (selected.has(String(segment.nodeId))) return [];
      const node = document.geometry.find(({ id }) => id === segment.nodeId);
      if (!node || node.type !== 'line') return [];
      const endpoint = segment.startVertexId === vertex.id
        ? 'start' as const
        : segment.endVertexId === vertex.id ? 'end' as const : null;
      return endpoint ? [{
        interfaceId: `${String(node.id)}:${endpoint}`,
        nodeId: String(node.id),
        endpoint,
      }] : [];
    });
  });
  if (graphInterfaces.length > 0) {
    return [...new Map(graphInterfaces.map((port) => [port.interfaceId, port])).values()]
      .sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
  }
  const tolerance = Math.max(geometryDiagonal(document) * 0.0025, 1e-6);
  const interfaces: GroundedEditTarget['interfaces'] = [];
  for (const connector of document.geometry) {
    if (selected.has(String(connector.id)) || connector.type !== 'line') continue;
    for (const endpoint of ['start', 'end'] as const) {
      const point = connector[endpoint];
      if (!targets.some((target) => distanceToGeometryBoundary(target, point) <= tolerance)) continue;
      interfaces.push({
        interfaceId: `${String(connector.id)}:${endpoint}`,
        nodeId: String(connector.id),
        endpoint,
      });
    }
  }
  return interfaces.sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
}

function distanceToGeometryBoundary(
  node: DrawingDocument['geometry'][number],
  point: readonly [number, number],
): number {
  if (node.type === 'circle') {
    return Math.abs(Math.hypot(point[0] - node.center[0], point[1] - node.center[1]) - node.radius);
  }
  if (node.type === 'ellipse') {
    const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (major <= 1e-9 || node.ratio <= 0) return Number.POSITIVE_INFINITY;
    const ux = node.majorAxis[0] / major;
    const uy = node.majorAxis[1] / major;
    const dx = point[0] - node.center[0];
    const dy = point[1] - node.center[1];
    const normalized = Math.hypot((dx * ux + dy * uy) / major, (-dx * uy + dy * ux) / (major * node.ratio));
    return Math.abs(normalized - 1) * major;
  }
  const anchors = geometryAnchors(node);
  return anchors.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...anchors.map((anchor) => Math.hypot(point[0] - anchor[0], point[1] - anchor[1])));
}

function geometryAnchors(node: DrawingDocument['geometry'][number]): Array<readonly [number, number]> {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'ray':
    case 'xline': return [node.origin];
    case 'circle':
    case 'arc':
    case 'ellipse': return [node.center];
    case 'polyline': return node.vertices.map(({ point }) => point);
    case 'spline': return node.controlPoints;
  }
}

function geometryCenter(node: DrawingDocument['geometry'][number]): [number, number] | null {
  if (node.type === 'point') return [node.x, node.y];
  if (node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse') return [...node.center];
  const anchors = geometryAnchors(node);
  if (anchors.length === 0) return null;
  return [
    anchors.reduce((sum, point) => sum + point[0], 0) / anchors.length,
    anchors.reduce((sum, point) => sum + point[1], 0) / anchors.length,
  ];
}

function geometryNodeBounds(node: DrawingDocument['geometry'][number]) {
  if (node.type === 'circle' || node.type === 'arc') return {
    minX: node.center[0] - node.radius,
    minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius,
    maxY: node.center[1] + node.radius,
  };
  if (node.type === 'ellipse') {
    const major = Math.hypot(...node.majorAxis);
    return {
      minX: node.center[0] - major,
      minY: node.center[1] - major,
      maxX: node.center[0] + major,
      maxY: node.center[1] + major,
    };
  }
  const anchors = geometryAnchors(node);
  if (anchors.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = anchors.map(([x]) => x);
  const ys = anchors.map(([, y]) => y);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

function geometryDiagonal(document: DrawingDocument): number {
  const bounds = document.geometry.filter(({ visible }) => visible).map(geometryNodeBounds);
  if (bounds.length === 0) return 1;
  return Math.hypot(
    Math.max(...bounds.map(({ maxX }) => maxX)) - Math.min(...bounds.map(({ minX }) => minX)),
    Math.max(...bounds.map(({ maxY }) => maxY)) - Math.min(...bounds.map(({ minY }) => minY)),
  ) || 1;
}

function selectionCandidate(
  document: DrawingDocument,
  nodeIds: string[],
  score: number,
  stateEpoch: number,
): EpisodeSelectionCandidate {
  const unique = [...new Set(nodeIds)].sort();
  return {
    key: '',
    nodeIds: unique,
    score,
    summary: candidateSummary(document, unique),
    stateEpoch,
  };
}

function pointCandidates(
  document: DrawingDocument,
  point: readonly [number, number],
  stateEpoch: number,
): EpisodeSelectionCandidate[] {
  const ranked = document.geometry
    .filter(({ visible }) => visible)
    .map((node) => ({ node, distance: distanceToSelectableGeometry(node, point) }))
    .sort((left, right) => left.distance - right.distance || String(left.node.id).localeCompare(String(right.node.id)));
  const minimum = ranked[0]?.distance ?? Number.POSITIVE_INFINITY;
  const tolerance = Math.max(geometryDiagonal(document) * 0.03, 1e-6);
  if (minimum > tolerance) return [];
  return ranked
    .filter(({ distance }) => distance <= minimum + tolerance * 0.1)
    .slice(0, 8)
    .map(({ node, distance }) => selectionCandidate(document, [String(node.id)], distance, stateEpoch));
}

function regionCandidates(
  document: DrawingDocument,
  polygon: Array<readonly [number, number]>,
  stateEpoch: number,
): EpisodeSelectionCandidate[] {
  if (polygon.length < 3) return [];
  const nodeIds = document.geometry
    .filter(({ visible }) => visible)
    .filter((node) => {
      const center = geometryCenter(node);
      return center !== null && pointInPolygon(center, polygon);
    })
    .map(({ id }) => String(id))
    .sort();
  return nodeIds.length === 0 ? [] : [selectionCandidate(document, nodeIds, 0, stateEpoch)];
}

function geometryNodeSize(node: DrawingDocument['geometry'][number]): number {
  const bounds = geometryNodeBounds(node);
  return Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

function semanticCandidates(
  document: DrawingDocument,
  query: string,
  stateEpoch: number,
): EpisodeSelectionCandidate[] {
  return document.geometry
    .filter(({ visible, id }) => visible && semanticNodeMatches(document, String(id), query))
    .map((node) => selectionCandidate(document, [String(node.id)], semanticMatchScore(node, query), stateEpoch))
    .sort((left, right) => left.score - right.score || left.nodeIds[0]!.localeCompare(right.nodeIds[0]!))
    .slice(0, 8);
}

function visualFallbackCandidates(
  candidates: Iterable<EpisodeSelectionCandidate>,
  query: string,
  stateEpoch: number,
): EpisodeSelectionCandidate[] {
  const normalized = normalizeSemanticText(query);
  const hints = [
    { present: /(?:^| )left(?: |$)/.test(normalized) || query.includes('左'), match: 'left' },
    { present: /(?:^| )right(?: |$)/.test(normalized) || query.includes('右'), match: 'right' },
    { present: /(?:^| )(?:top|upper)(?: |$)/.test(normalized) || query.includes('上'), match: 'upper' },
    { present: /(?:^| )(?:bottom|lower)(?: |$)/.test(normalized) || query.includes('下'), match: 'lower' },
    { present: /(?:^| )(?:circle|round)(?: |$)/.test(normalized) || query.includes('圆'), match: 'circle' },
    { present: /(?:^| )line(?: |$)/.test(normalized) || query.includes('线'), match: 'line' },
  ].filter(({ present }) => present).map(({ match }) => match);
  const all = [...candidates].filter((candidate) => candidate.stateEpoch === stateEpoch);
  const filtered = hints.length === 0
    ? all
    : all.filter(({ summary }) => hints.every((hint) => summary.includes(hint)));
  return (filtered.length > 0 ? filtered : all).slice(0, 16).map((candidate) => structuredClone(candidate));
}

function semanticNodeMatches(document: DrawingDocument, nodeId: string, query: string): boolean {
  const node = document.geometry.find(({ id }) => String(id) === nodeId);
  if (!node) return false;
  const normalizedQuery = normalizeSemanticText(query);
  if (!normalizedQuery) return false;
  const searchable = `${normalizeSemanticText(nodeId)} ${normalizeSemanticText(node.type)}`;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => searchable.includes(token));
}

function semanticMatchScore(node: DrawingDocument['geometry'][number], query: string): number {
  const normalizedQuery = normalizeSemanticText(query);
  const normalizedId = normalizeSemanticText(String(node.id));
  return normalizedId === normalizedQuery ? 0 : normalizedId.includes(normalizedQuery) ? 1 : 2;
}

function normalizeSemanticText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function candidateSummary(document: DrawingDocument, nodeIds: string[]): string {
  const nodes = document.geometry.filter(({ id }) => nodeIds.includes(String(id)));
  const typeSummary = [...new Set(nodes.map(({ type }) => type))].sort().join('+') || 'geometry';
  const centers = nodes.flatMap((node) => {
    const center = geometryCenter(node);
    return center ? [center] : [];
  });
  if (centers.length === 0) return `${nodeIds.length} ${typeSummary} element`;
  const centerX = centers.reduce((sum, [x]) => sum + x, 0) / centers.length;
  const centerY = centers.reduce((sum, [, y]) => sum + y, 0) / centers.length;
  const bounds = document.geometry.map(geometryNodeBounds);
  const minX = Math.min(...bounds.map(({ minX: value }) => value));
  const maxX = Math.max(...bounds.map(({ maxX: value }) => value));
  const minY = Math.min(...bounds.map(({ minY: value }) => value));
  const maxY = Math.max(...bounds.map(({ maxY: value }) => value));
  const horizontal = centerX < minX + (maxX - minX) / 3 ? 'left'
    : centerX > minX + (maxX - minX) * 2 / 3 ? 'right' : 'center';
  const vertical = centerY < minY + (maxY - minY) / 3 ? 'lower'
    : centerY > minY + (maxY - minY) * 2 / 3 ? 'upper' : 'middle';
  return `${nodeIds.length} ${typeSummary} element in ${vertical}-${horizontal} area`;
}

function pointInPolygon(
  point: readonly [number, number],
  polygon: Array<readonly [number, number]>,
): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index]!;
    const [x2, y2] = polygon[previous]!;
    if ((y1 > point[1]) !== (y2 > point[1])
      && point[0] < (x2 - x1) * (point[1] - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function distanceToSelectableGeometry(
  node: DrawingDocument['geometry'][number],
  point: readonly [number, number],
): number {
  if (node.type === 'point') return Math.hypot(point[0] - node.x, point[1] - node.y);
  if (node.type === 'circle' || node.type === 'arc') {
    const radial = Math.hypot(point[0] - node.center[0], point[1] - node.center[1]);
    return node.type === 'circle' && radial <= node.radius ? 0 : Math.abs(radial - node.radius);
  }
  if (node.type === 'ellipse') {
    const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (major <= 1e-9 || node.ratio <= 0) return Number.POSITIVE_INFINITY;
    const ux = node.majorAxis[0] / major;
    const uy = node.majorAxis[1] / major;
    const dx = point[0] - node.center[0];
    const dy = point[1] - node.center[1];
    const normalized = Math.hypot((dx * ux + dy * uy) / major, (-dx * uy + dy * ux) / (major * node.ratio));
    return normalized <= 1 ? 0 : (normalized - 1) * major;
  }
  const segments = node.type === 'line'
    ? [[node.start, node.end] as const]
    : node.type === 'polyline'
      ? node.vertices.slice(1).map((vertex, index) => [node.vertices[index]!.point, vertex.point] as const)
      : node.type === 'spline'
        ? node.controlPoints.slice(1).map((vertex, index) => [node.controlPoints[index]!, vertex] as const)
        : [];
  if (segments.length > 0) return Math.min(...segments.map(([start, end]) => distanceToSegment(point, start, end)));
  const center = geometryCenter(node);
  return center ? Math.hypot(point[0] - center[0], point[1] - center[1]) : Number.POSITIVE_INFINITY;
}

function distanceToSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}

function finiteVec2(value: [number, number], code: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || value.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(code);
  }
  return [value[0], value[1]];
}

function groundedGeometryCenter(document: DrawingDocument, targetNodeIds: string[]): [number, number] {
  const selected = new Set(targetNodeIds);
  const points = document.geometry
    .filter(({ id }) => selected.has(String(id)))
    .flatMap(geometryAnchors);
  if (points.length === 0) throw new Error('EDIT_TRANSFORM_PIVOT_UNRESOLVED');
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
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
