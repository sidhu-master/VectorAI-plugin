// SPDX-License-Identifier: Apache-2.0

import {
  canonicalSemanticString,
  canonicalString,
  compileMultiPartTransform,
  compileSpatialEditProgram,
  findConnectedCarrierCandidates,
  findConnectedCarrierInterfaces,
  type EditCorePorts,
  type GroundedEditTarget,
  type SpatialCompilation,
} from '@vectorai/drawing-edit-core';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import {
  finalizePreviewRequestSchema,
  multiPartTransformRequestSchema,
  multiPartTransformRevisionRequestSchema,
  spatialEditProgramSchema,
  type Assessment,
  type ContextRef,
  type EvaluationRecord,
  type EvaluationRef,
  type FinalizePreviewRequest,
  type FinalizePreviewResult,
  type GroundingRef,
  type MultiPartTransformRequest,
  type MultiPartTransformRevisionRequest,
  type ObservationRef,
  type OperationLookupResult,
  type PreviewRef,
  type ReviewEvidence,
  type SelectionProjectionRef,
  type SpatialEditProgram,
  type TaskRef,
} from '@vectorai/drawing-edit-protocol';
import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingGroundingOverlay } from '@vectorai/plugin-space-contracts';
import { buildGeometryTopologyGraph, WorldModelCompiler } from '@vectorai/drawing-spatial';
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
  groundings: GroundingState[];
  program?: SpatialEditProgram;
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

export class SemanticEditService {
  readonly #pendingInstructions = new Map<string, {
    objective: string;
    rootUserMessageDigest: string;
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
    const ref: SemanticContextRef = {
      contextId: this.ports.id('context'),
      taskId: task.ref.taskId,
      observationId: observation.ref.observationId,
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
  const points = document.geometry.flatMap(geometryAnchors);
  if (points.length === 0) return 1;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
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
