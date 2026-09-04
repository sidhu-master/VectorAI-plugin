// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { EngineeringAnnotationDraft } from '@vectorai/engineering-annotation';
import type {
  DimensionPlanSessionSnapshot,
  DrawingRef,
  DrawingSpaceExtensionHost,
  GeometricToleranceEditCommand,
} from '@vectorai/plugin-space-contracts';
import type { DimensionPlanStore } from './dimension-plan-store';
import { groundGdtRecommendation, type GdtRecommendation } from './gdt-grounding';
import type { AutomaticGdtReviewer } from './gdt-reviewer';
import type { PartitionDraft, PartitionRevision } from '@vectorai/engineering-annotation';

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot'>;

export class GdtService {
  constructor(
    private readonly space: SpacePort,
    private readonly plans: DimensionPlanStore,
    private readonly automaticReviewer?: AutomaticGdtReviewer,
  ) {}

  async startAutomatic(
    agent: Agent,
    partition: PartitionDraft | PartitionRevision,
    signal?: AbortSignal,
  ): Promise<DimensionPlanSessionSnapshot> {
    if (!this.automaticReviewer) throw new Error('AI_GDT_REVIEW_UNAVAILABLE');
    const recommendation = await this.automaticReviewer({ agent, partition, signal });
    return this.start(agent, recommendation, {
      // An unresolved review is not a replacement set. Keeping the current
      // annotations prevents a clarification-only result from deleting work.
      replaceExistingGdt: recommendation.coverage?.status !== 'needs-user-input',
    });
  }

  start(
    agent: Agent,
    recommendation: GdtRecommendation,
    options: { replaceExistingGdt?: boolean } = {},
  ): DimensionPlanSessionSnapshot {
    const sessionId = String(agent.id);
    const drawing = this.space.getSnapshot(agent);
    if (!drawing) throw new Error('DRAWING_REQUIRED');
    const current = this.plans.get(sessionId);
    const base = editableBase(current, drawing.ref);
    const grounded = groundGdtRecommendation(drawing, recommendation);
    const coverageDiagnostics = recommendation.coverage === undefined ? [] : [{
      id: 'diagnostic:gdt:coverage',
      severity: recommendation.coverage.complete ? 'info' as const : recommendation.coverage.status === 'needs-user-input' ? 'warning' as const : 'error' as const,
      code: recommendation.coverage.complete ? 'GDT_COVERAGE_COMPLETE'
        : recommendation.coverage.status === 'needs-user-input' ? 'GDT_USER_INPUT_REQUIRED' : 'GDT_COVERAGE_INCOMPLETE',
      message: recommendation.coverage.complete
        ? `GD&T coverage verified: ${recommendation.coverage.requiredDatumCount} datums and ${recommendation.coverage.requiredControlCount} controls`
        : recommendation.coverage.status === 'needs-user-input'
          ? 'GD&T rule resolution requires user clarification before the automatic set can be completed'
          : `GD&T coverage incomplete: expected ${recommendation.coverage.requiredDatumCount} datums and ${recommendation.coverage.requiredControlCount} controls`,
    }, ...(recommendation.coverage.questions ?? []).map((question, index) => ({
      id: `diagnostic:gdt:clarification:${index}`,
      severity: 'warning' as const,
      code: question.code,
      message: question.prompt,
      ...(question.segmentIds.length === 0 ? {} : { segmentIds: [...question.segmentIds] }),
    }))];
    this.plans.begin(sessionId, drawing.ref);
    return this.plans.setDraft(sessionId, {
      ...base,
      drawingRef: drawing.ref,
      datums: mergeById(options.replaceExistingGdt ? [] : base.datums, grounded.datums),
      geometricTolerances: mergeById(options.replaceExistingGdt ? [] : base.geometricTolerances, grounded.geometricTolerances),
      surfaceTextures: mergeById(options.replaceExistingGdt ? [] : (base.surfaceTextures ?? []), grounded.surfaceTextures ?? []),
      diagnostics: mergeById(base.diagnostics, coverageDiagnostics),
    });
  }

  edit(agent: Agent, command: GeometricToleranceEditCommand): DimensionPlanSessionSnapshot {
    return this.plans.editGeometricTolerance(String(agent.id), command);
  }
}

function editableBase(snapshot: DimensionPlanSessionSnapshot, drawingRef: DrawingRef): EngineeringAnnotationDraft {
  const value = snapshot.draft ?? snapshot.confirmed;
  if (!value || value.drawingRef.drawingId !== drawingRef.drawingId || value.drawingRef.revision !== drawingRef.revision) {
    return { version: 1, drawingRef, datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [] };
  }
  return {
    version: 1,
    drawingRef,
    datums: structuredClone(value.datums), intents: structuredClone(value.intents),
    tolerances: structuredClone(value.tolerances), fitAssignments: structuredClone(value.fitAssignments),
    geometricTolerances: structuredClone(value.geometricTolerances),
    surfaceTextures: structuredClone(value.surfaceTextures ?? []),
    chains: structuredClone(value.chains), dependencies: structuredClone(value.dependencies), diagnostics: structuredClone(value.diagnostics),
    ...(value.axialScheme === undefined ? {} : { axialScheme: structuredClone(value.axialScheme) }),
    ...('id' in value ? { baseRevisionId: value.id } : value.baseRevisionId === undefined ? {} : { baseRevisionId: value.baseRevisionId }),
  } as unknown as EngineeringAnnotationDraft;
}

function mergeById<T extends { id: string }>(previous: readonly T[], next: readonly T[]): T[] {
  const values = new Map(previous.map((item) => [item.id, structuredClone(item)]));
  for (const item of next) values.set(item.id, structuredClone(item));
  return [...values.values()];
}
