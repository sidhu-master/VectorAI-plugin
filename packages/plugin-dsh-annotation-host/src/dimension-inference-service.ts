// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import {
  buildAxialTopology,
  generateAxialDimensionCandidates,
  inferAxialDimensionScheme,
  parseEngineeringDocument,
  policyById,
  projectAxialDimensionScheme,
  type AxialInferencePolicy,
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

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot'>;
type PartitionPort = { get(sessionId: string): PartitionSessionSnapshot };
type DocumentPort = { getStagedEngineeringText(agent: Agent): string | undefined };

export class DimensionInferenceService {
  constructor(
    private readonly space: SpacePort,
    private readonly partitions: PartitionPort,
    private readonly documents: DocumentPort,
    private readonly plans: DimensionPlanStore,
  ) {}

  start(
    agent: Agent,
    policyId: AxialInferencePolicy['id'] = 'shaft-reference-terminal-closure-v1',
  ): DimensionPlanSessionSnapshot {
    const sessionId = String(agent.id);
    const drawing = this.space.getSnapshot(agent);
    if (!drawing) throw new Error('DRAWING_REQUIRED');
    const partition = this.partitions.get(sessionId);
    const partitionValue = partition.draft ?? partition.confirmed;
    if (!partitionValue) throw new Error('DIMENSION_PARTITION_REQUIRED');
    assertSameRef(drawing.ref, partitionValue.drawingRef);
    const document = parseEngineeringDocument(this.documents.getStagedEngineeringText(agent) ?? '');
    const domainPartition = partitionValue as unknown as PartitionDraft | PartitionRevision;
    const topology = buildAxialTopology({
      partition: domainPartition,
      unit: document.drawing.unit ?? drawing.document.unitSystem.length,
    });
    const candidateSet = generateAxialDimensionCandidates({ topology, partition: domainPartition, document });
    const scheme = inferAxialDimensionScheme({
      topology,
      candidateSet,
      policy: policyById(policyId),
      ...(partition.confirmed?.id === undefined ? {} : { partitionRevisionId: partition.confirmed.id }),
    });
    this.plans.begin(sessionId, drawing.ref);
    return this.plans.setDraft(sessionId, projectAxialDimensionScheme({ scheme }));
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
      ? this.plans.markNeedsRebase(sessionId, currentRef)
      : current;
  }
}

function assertSameRef(left: DrawingRef, right: DrawingRef): void {
  if (left.drawingId !== right.drawingId || left.revision !== right.revision) {
    throw new Error('DIMENSION_PARTITION_STALE');
  }
}
