// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import {
  mergeAxialDimensionProjection,
  type AxialInferencePolicy,
  type EngineeringAnnotationDraft,
  type EngineeringAnnotationRevision,
  type PartitionDraft,
  type PartitionRevision,
} from '@vectorai/engineering-annotation';
import type {
  DimensionPlanSessionSnapshot,
  DimensionSchemeEditCommand,
  DrawingRef,
  DrawingSpaceExtensionHost,
  PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import type { DimensionPlanStore } from './dimension-plan-store';
import type { AxialDimensionInference } from './axial-dimension-pipeline';

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot'>;
type PartitionPort = { get(sessionId: string): PartitionSessionSnapshot };
type DocumentPort = { getStagedEngineeringText(agent: Agent): string | undefined };

export class DimensionInferenceService {
  constructor(
    private readonly space: SpacePort,
    private readonly partitions: PartitionPort,
    private readonly documents: DocumentPort,
    private readonly plans: DimensionPlanStore,
    private readonly infer: AxialDimensionInference,
  ) {}

  async start(
    agent: Agent,
    policyId: AxialInferencePolicy['id'] = 'shaft-hierarchical-dimensioning-v1',
    signal?: AbortSignal,
  ): Promise<DimensionPlanSessionSnapshot> {
    const sessionId = String(agent.id);
    const drawing = this.space.getSnapshot(agent);
    if (!drawing) throw new Error('DRAWING_REQUIRED');
    const partition = this.partitions.get(sessionId);
    const partitionValue = partition.draft ?? partition.confirmed;
    if (!partitionValue) throw new Error('DIMENSION_PARTITION_REQUIRED');
    const domainPartition = {
      ...partitionValue,
      drawingRef: drawing.ref,
    } as unknown as PartitionDraft | PartitionRevision;
    const projection = await this.infer({
      drawing,
      partition: domainPartition,
      engineeringText: this.documents.getStagedEngineeringText(agent) ?? '',
      policyId,
    }, signal);
    const current = this.plans.get(sessionId);
    const base = current.draft ?? current.confirmed;
    this.plans.begin(sessionId, drawing.ref);
    return this.plans.setDraft(sessionId, mergeAxialDimensionProjection(
      base as unknown as EngineeringAnnotationDraft | EngineeringAnnotationRevision | undefined,
      projection,
    ));
  }

  getState(agent: Agent): DimensionPlanSessionSnapshot {
    return this.plans.get(String(agent.id));
  }

  edit(agent: Agent, command: DimensionSchemeEditCommand): DimensionPlanSessionSnapshot {
    return this.plans.editScheme(String(agent.id), command);
  }

  confirm(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.plans.confirm(String(agent.id), expected);
  }

  cancel(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.plans.cancel(String(agent.id), expected);
  }

  undo(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.plans.undo(String(agent.id), expected);
  }

  redo(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.plans.redo(String(agent.id), expected);
  }

  markStale(agent: Agent, currentRef: DrawingRef): DimensionPlanSessionSnapshot {
    return this.markStaleSession(String(agent.id), currentRef);
  }

  markStaleSession(sessionId: string, currentRef: DrawingRef): DimensionPlanSessionSnapshot {
    const current = this.plans.get(sessionId);
    return current.draft?.axialScheme
      ? this.plans.markPartitionChanged(sessionId, currentRef)
      : current;
  }
}
