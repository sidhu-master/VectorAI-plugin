import { createHash, randomUUID } from 'node:crypto';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import {
  GroundingLedger,
  createTaskRelevantView,
  type TaskRelevantView,
} from '../drawing-grounding/index.js';
import {
  mergeSpatialFrames,
  projectActionFrame,
  projectGroundingFrame,
} from '../drawing-interaction/index.js';
import type { CounterfactualWorldService } from '../drawing-preview-world/service.js';
import { proposeSpatialActions } from '../drawing-spatial-actions/index.js';
import {
  ModelToolExecutionError,
} from '../drawing-tools/registry.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolExecutionContext,
} from '../drawing-tools/types.js';
import { WorldModelCompiler } from './compiler.js';
import {
  parseBuildWorldSlice,
  parseGroundSemanticEntities,
  parseInspectCounterfactual,
  parseInspectWorldSlice,
  parseProposeSpatialActions,
  parseRefineSemanticEntity,
  type BuildWorldSliceInput,
  type GroundSemanticEntitiesInput,
  type InspectCounterfactualInput,
  type InspectWorldSliceInput,
  type ProposeSpatialActionsInput,
  type RefineSemanticEntityInput,
} from './tool-inputs.js';
import {
  groundedNodeIds,
  inspectReferences,
  nodeIds,
  summarizeWorld,
  supportsToNodeIds,
  unresolvedSupportsAcrossSlices,
  validateGroundingReferences,
} from './tool-projection.js';
import type { WorldModelCompileRequest, WorldModelSlice } from './types.js';

type ToolDefinition = ModelDrawingToolDefinition<unknown, unknown>;
type HandleKind = 'slice' | 'grounding-event';

interface StoredSlice {
  handle: string;
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  request: WorldModelCompileRequest;
  world: WorldModelSlice;
}

/**
 * Episode-scoped tools for computed spatial facts and temporary semantic evidence.
 * Every definition is read-only with respect to canonical Drawing IR.
 */
export class DrawingWorldModelTools {
  readonly definitions: readonly ToolDefinition[];
  readonly #application: DrawingApplication;
  readonly #compiler: WorldModelCompiler;
  readonly #counterfactualWorld: CounterfactualWorldService;
  readonly #handleFactory: (kind: HandleKind) => string;
  readonly #now: () => number;
  readonly #slices = new Map<string, StoredSlice>();
  readonly #ledgers = new Map<string, GroundingLedger>();
  readonly #latestViews = new Map<string, TaskRelevantView>();
  readonly #runScopes = new Map<string, Set<string>>();

  constructor(input: {
    application: DrawingApplication;
    counterfactualWorld: CounterfactualWorldService;
    compiler?: WorldModelCompiler;
    handleFactory?: (kind: HandleKind) => string;
    now?: () => number;
  }) {
    this.#application = input.application;
    this.#counterfactualWorld = input.counterfactualWorld;
    this.#compiler = input.compiler ?? new WorldModelCompiler();
    this.#handleFactory = input.handleFactory ?? ((kind) => `${kind}_${randomUUID()}`);
    this.#now = input.now ?? Date.now;
    this.definitions = Object.freeze([
      this.#buildWorldSlice(),
      this.#inspectWorldSlice(),
      this.#groundSemanticEntities(),
      this.#refineSemanticEntity(),
      this.#proposeSpatialActions(),
      this.#inspectCounterfactualWorld(),
    ]);
  }

  snapshot(): { sliceCount: number; ledgerCount: number; taskViewCount: number } {
    return {
      sliceCount: this.#slices.size,
      ledgerCount: this.#ledgers.size,
      taskViewCount: this.#latestViews.size,
    };
  }

  discardRun(runId: string): number {
    let discarded = 0;
    for (const [handle, slice] of this.#slices) {
      if (slice.runId !== runId) continue;
      this.#slices.delete(handle);
      discarded += 1;
    }
    for (const key of this.#runScopes.get(runId) ?? []) {
      this.#ledgers.delete(key);
      this.#latestViews.delete(key);
    }
    this.#runScopes.delete(runId);
    return discarded;
  }

  #buildWorldSlice(): ToolDefinition {
    return define<BuildWorldSliceInput, unknown>(
      'build_world_slice', parseBuildWorldSlice, async ({ invocation, input }) => {
        const workspace = await this.#application.readCurrent(invocation.drawingId);
        const world = this.#compiler.compile(workspace.document, workspace.revision, input);
        const stored = this.#storeSlice(invocation, input, world);
        return {
          output: { sliceHandle: stored.handle, world: summarizeWorld(world, false) },
          revisionAfter: workspace.revision,
          affectedNodeIds: nodeIds(world),
        };
      },
    );
  }

  #inspectWorldSlice(): ToolDefinition {
    return define<InspectWorldSliceInput, unknown>(
      'inspect_world_slice', parseInspectWorldSlice, async ({ invocation, input }) => {
        const stored = this.#requireSlice(input.sliceHandle, invocation);
        if (input.continuationToken) {
          const workspace = await this.#application.readCurrent(invocation.drawingId);
          const request = { ...stored.request, continuationToken: input.continuationToken };
          const world = this.#compiler.compile(workspace.document, workspace.revision, request);
          const next = this.#storeSlice(invocation, request, world);
          return {
            output: {
              sliceHandle: next.handle,
              world: summarizeWorld(world, input.includeSamples),
              entities: [],
              missingRefs: [],
            },
            revisionAfter: workspace.revision,
            affectedNodeIds: nodeIds(world),
          };
        }
        const inspected = inspectReferences(stored.world, input.refs, input.includeSamples);
        return {
          output: {
            sliceHandle: stored.handle,
            world: summarizeWorld(stored.world, false),
            entities: inspected.entities,
            missingRefs: inspected.missingRefs,
          },
          revisionAfter: stored.revision,
          affectedNodeIds: inspected.nodeIds,
        };
      },
    );
  }

  #groundSemanticEntities(): ToolDefinition {
    return define<GroundSemanticEntitiesInput, unknown>(
      'ground_semantic_entities', parseGroundSemanticEntities,
      async ({ invocation, input }) => {
        const slice = this.#requireSlice(input.sliceHandle, invocation);
        if (validateGroundingReferences(slice.world, input.candidates).length > 0) {
          reject('GROUNDING_SUPPORT_UNRESOLVED', 'requery');
        }
        const selected = new Set(input.selectedCandidateIds);
        if (input.selectedCandidateIds.some((id) => !input.candidates.some((item) => item.id === id))) {
          reject('GROUNDING_SELECTION_UNRESOLVED', 'requery');
        }
        const ledger = this.#ledger(invocation);
        if (input.candidates.some((candidate) => ledger.current(candidate.id))) {
          reject('GROUNDING_HYPOTHESIS_EXISTS', 'replan');
        }
        for (const candidate of input.candidates) {
          const hypothesis = {
            id: candidate.id,
            drawingId: invocation.drawingId,
            revision: invocation.revision,
            label: candidate.label,
            referringExpression: input.referringExpression,
            observationRefs: candidate.observationRefs,
            regionRefs: candidate.regionRefs,
            supports: candidate.supports,
            excludedSupports: candidate.excludedSupports,
            interfaceRefs: candidate.interfaceRefs,
            confidence: candidate.confidence,
            provenance: {
              provider: 'drawing-world-model-tool',
              evidenceRefs: unique([...input.evidenceRefs, ...candidate.observationRefs]),
              createdAt: this.#now(),
              modelCallId: invocation.toolCallId,
              compilerVersion: slice.world.compilerVersion,
              inputDigest: slice.world.inputDigest,
            },
          };
          ledger.append({
            id: this.#handleFactory('grounding-event'),
            episodeId: invocation.episodeId,
            drawingId: invocation.drawingId,
            revision: invocation.revision,
            hypothesisId: candidate.id,
            kind: 'proposed',
            hypothesis,
            evidenceRefs: input.evidenceRefs,
            reasonCode: 'MODEL_CANDIDATE_PROPOSED',
            createdAt: this.#now(),
          });
          if (selected.has(candidate.id)) {
            ledger.append({
              id: this.#handleFactory('grounding-event'),
              episodeId: invocation.episodeId,
              drawingId: invocation.drawingId,
              revision: invocation.revision,
              hypothesisId: candidate.id,
              kind: 'selected',
              evidenceRefs: input.evidenceRefs,
              reasonCode: 'MODEL_CANDIDATE_SELECTED',
              createdAt: this.#now(),
            });
          }
        }
        const key = ledgerKey(invocation);
        const selectedRelations = input.relations.filter((relation) => (
          selected.has(relation.from) && selected.has(relation.to)
        ));
        const ignoredRelations = input.relations
          .filter((relation) => !selectedRelations.includes(relation))
          .map((relation) => ({
            relation: structuredClone(relation),
            reason: 'endpoint-not-selected' as const,
          }));
        const taskRelevantView = input.selectedCandidateIds.length === 0
          ? null
          : createTaskRelevantView({
            episodeId: invocation.episodeId,
            drawingId: invocation.drawingId,
            revision: invocation.revision,
            goalDigest: digest(input.goalDescription),
            hypotheses: ledger.currentStates({ includeInactive: true })
              .map((state) => state.hypothesis),
            entityIds: input.selectedCandidateIds,
            relations: selectedRelations,
            abstraction: input.abstraction,
            evidenceRefs: input.evidenceRefs,
          });
        if (taskRelevantView) this.#latestViews.set(key, taskRelevantView);
        const delta = ledger.deltaSince(0);
        const currentCandidates = ledger.currentStates({ includeInactive: true })
          .filter((state) => input.candidates.some((candidate) => candidate.id === state.hypothesisId))
          .map((state) => state.hypothesis);
        return {
          output: {
            sliceHandle: slice.handle,
            ledger: { nextCursor: delta.nextCursor, current: ledger.currentStates() },
            taskRelevantView,
            ignoredRelations,
            interactionFrame: projectGroundingFrame({
              world: slice.world,
              candidates: currentCandidates,
              selectedCandidateIds: input.selectedCandidateIds,
            }),
          },
          revisionAfter: slice.revision,
          affectedNodeIds: groundedNodeIds(slice.world, input.candidates),
        };
      },
    );
  }

  #refineSemanticEntity(): ToolDefinition {
    return define<RefineSemanticEntityInput, unknown>(
      'refine_semantic_entity', parseRefineSemanticEntity,
      async ({ invocation, input }) => {
        const ledger = this.#ledgers.get(ledgerKey(invocation));
        if (!ledger || !ledger.current(input.hypothesisId)) {
          reject('GROUNDING_HYPOTHESIS_NOT_FOUND', 'requery');
        }
        const worlds = this.#scopedSlices(invocation).map((slice) => slice.world);
        if (unresolvedSupportsAcrossSlices(worlds, input.addedSupports).length > 0) {
          reject('GROUNDING_SUPPORT_UNRESOLVED', 'requery');
        }
        const appended = ledger.append({
          id: this.#handleFactory('grounding-event'),
          episodeId: invocation.episodeId,
          drawingId: invocation.drawingId,
          revision: invocation.revision,
          hypothesisId: input.hypothesisId,
          kind: input.kind,
          evidenceRefs: input.evidenceRefs,
          supportDelta: { added: input.addedSupports, removed: input.removedSupportRefs },
          ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
          reasonCode: input.reasonCode,
          createdAt: this.#now(),
        });
        const current = ledger.current(input.hypothesisId)!;
        const interactionFrame = mergeSpatialFrames(worlds.map((world) => projectGroundingFrame({
          world,
          candidates: [current.hypothesis],
          selectedCandidateIds: [current.hypothesis.id],
        })), { label: current.hypothesis.label });
        return {
          output: {
            cursor: appended.cursor,
            current,
            delta: ledger.deltaSince(appended.cursor - 1),
            interactionFrame,
          },
          revisionAfter: invocation.revision,
          affectedNodeIds: supportsToNodeIds(worlds, current.hypothesis.supports),
        };
      },
    );
  }

  #proposeSpatialActions(): ToolDefinition {
    return define<ProposeSpatialActionsInput, unknown>(
      'propose_spatial_actions', parseProposeSpatialActions,
      async ({ invocation, input }) => {
        const slice = this.#requireSlice(input.sliceHandle, invocation);
        const proposals = proposeSpatialActions({
          goalDescription: input.goalDescription,
          world: slice.world,
          targetRefs: input.targetRefs,
          preserveRefs: input.preserveRefs,
          interfaceRefs: input.interfaceRefs,
          ...(input.methods ? { methods: input.methods } : {}),
        });
        return {
          output: {
            sliceHandle: slice.handle,
            worldKnowledge: slice.world.knowledge,
            proposals,
            interactionFrame: projectActionFrame({
              world: slice.world,
              targetRefs: input.targetRefs,
              preserveRefs: input.preserveRefs,
              interfaceRefs: input.interfaceRefs,
              label: input.goalDescription,
            }),
          },
          revisionAfter: slice.revision,
          affectedNodeIds: unique(proposals.flatMap((proposal) => proposal.affectedNodeIds)).sort(),
        };
      },
    );
  }

  #inspectCounterfactualWorld(): ToolDefinition {
    return define<InspectCounterfactualInput, unknown>(
      'inspect_counterfactual_world', parseInspectCounterfactual,
      async ({ invocation, input }) => {
        let branch;
        try {
          branch = this.#counterfactualWorld.inspectScoped(input.branchId, {
            runId: invocation.runId,
            episodeId: invocation.episodeId,
            drawingId: invocation.drawingId,
            revision: invocation.revision,
          });
        } catch (error) {
          if (error instanceof Error && error.message === 'COUNTERFACTUAL_NOT_FOUND') {
            reject('COUNTERFACTUAL_NOT_FOUND', 'requery');
          }
          reject('COUNTERFACTUAL_SCOPE_MISMATCH', 'requery');
        }
        return {
          output: {
            branchId: branch.id,
            baseRevision: branch.baseRevision,
            transactionDigest: branch.transactionDigest,
            affectedScope: branch.affectedScope,
            delta: branch.delta,
            beforeWorld: summarizeWorld(branch.beforeWorld, false),
            afterWorld: summarizeWorld(branch.afterWorld, false),
          },
          revisionAfter: branch.baseRevision,
          affectedNodeIds: branch.affectedScope.nodeIds,
        };
      },
    );
  }

  #storeSlice(
    invocation: ModelDrawingToolExecutionContext<unknown>['invocation'],
    request: WorldModelCompileRequest,
    world: WorldModelSlice,
  ): StoredSlice {
    const stored: StoredSlice = {
      handle: this.#handleFactory('slice'),
      runId: invocation.runId,
      episodeId: invocation.episodeId,
      drawingId: invocation.drawingId,
      revision: invocation.revision,
      request: structuredClone(request),
      world: structuredClone(world),
    };
    this.#slices.set(stored.handle, stored);
    return stored;
  }

  #requireSlice(
    handle: string,
    invocation: ModelDrawingToolExecutionContext<unknown>['invocation'],
  ): StoredSlice {
    const stored = this.#slices.get(handle);
    if (!stored) reject('WORLD_SLICE_NOT_FOUND', 'requery');
    if (stored.runId !== invocation.runId
      || stored.episodeId !== invocation.episodeId
      || stored.drawingId !== invocation.drawingId
      || stored.revision !== invocation.revision) {
      reject('WORLD_SLICE_SCOPE_MISMATCH', 'requery');
    }
    return stored;
  }

  #ledger(invocation: ModelDrawingToolExecutionContext<unknown>['invocation']): GroundingLedger {
    const key = ledgerKey(invocation);
    let ledger = this.#ledgers.get(key);
    if (!ledger) {
      ledger = new GroundingLedger({
        episodeId: invocation.episodeId,
        drawingId: invocation.drawingId,
        revision: invocation.revision,
      });
      this.#ledgers.set(key, ledger);
    }
    const scopes = this.#runScopes.get(invocation.runId) ?? new Set<string>();
    scopes.add(key);
    this.#runScopes.set(invocation.runId, scopes);
    return ledger;
  }

  #scopedSlices(
    invocation: ModelDrawingToolExecutionContext<unknown>['invocation'],
  ): StoredSlice[] {
    return [...this.#slices.values()].filter((slice) => slice.runId === invocation.runId
      && slice.episodeId === invocation.episodeId
      && slice.drawingId === invocation.drawingId
      && slice.revision === invocation.revision);
  }
}

function define<I, O>(
  name: string,
  parseInput: (value: unknown) => I,
  execute: (context: ModelDrawingToolExecutionContext<I>) => Promise<{
    output: O;
    revisionAfter?: RevisionId;
    affectedNodeIds?: string[];
  }>,
): ModelDrawingToolDefinition<I, O> {
  return {
    name,
    version: '1.0.0',
    access: 'read',
    timeoutMs: 15_000,
    parseInput,
    execute,
  };
}

function ledgerKey(input: {
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
}): string {
  return `${input.episodeId}\0${input.drawingId}\0${input.revision}`;
}

function reject(
  code: string,
  suggestedAction: 'retry' | 'requery' | 'replan' | 'request-human-decision',
): never {
  throw new ModelToolExecutionError({ code, retryable: true, suggestedAction });
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
