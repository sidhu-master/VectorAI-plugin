// SPDX-License-Identifier: Apache-2.0

import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { planEngineeringAnnotations } from '@vectorai/engineering-annotation';
import type {
  DrawingExtensionProgramWorkflow,
  DrawingSpaceExtensionHost,
  PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import type { AnnotationSessionStateStore } from './session-state';
import type { PartitionSessionStore } from './partition-store';

export function createEngineeringAnnotationTool(
  host: Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'runExtensionProgram'>,
  sessions: AnnotationSessionStateStore,
  partitions?: Pick<PartitionSessionStore, 'get'>,
) {
  return defineTool({
    name: 'drawing_auto_annotate',
    description: 'Create engineering dimensions only after smart shaft partitioning has been confirmed. This tool never creates or edits partition boundaries; use drawing_partition_status for partition requests.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const sessionId = String(agent.id);
      const partition = partitions?.get(sessionId);
      if (partition?.phase === 'analyzing' || partition?.phase === 'editing') {
        throw new Error('PARTITION_WORKFLOW_ACTIVE: finish the editable partition in the engineering workspace before automatic dimensioning');
      }
      const snapshot = host.getSnapshot(agent);
      if (!snapshot) throw new Error('DRAWING_REQUIRED');
      const plan = planEngineeringAnnotations({
        document: snapshot.document,
        ref: snapshot.ref,
        objective: '工程图纸自动标注',
      });
      const workflowId = `annotation_${sessionId}_${Date.now()}`;
      sessions.start(sessionId, workflowId);
      if (!plan.program) {
        sessions.finish(sessionId, 'completed');
        return {
          status: 'no-effect',
          pending: plan.pending,
          suppressed: plan.suppressed,
        } as unknown as JsonValue;
      }
      try {
        const workflow = await host.runExtensionProgram(agent, {
          targetNodeIds: plan.targetNodeIds,
          program: plan.program,
        }, exec.signal);
        sessions.finish(sessionId, terminalStatus(workflow.result.status));
        return {
          status: workflow.result.status,
          annotations: plan.annotations.map(({ id }) => id),
          pending: plan.pending,
          suppressed: plan.suppressed,
          result: workflow.result,
        } as unknown as JsonValue;
      } catch (error) {
        sessions.finish(sessionId, 'failed', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  });
}

export function createPartitionStatusTool(
  partitions: Pick<PartitionSessionStore, 'get'>,
) {
  return defineTool({
    name: 'drawing_partition_status',
    description: 'Inspect the dedicated smart shaft-partition workflow after an explicit engineering DXF import. Use this for requests about partitioning or axis segments; do not create partition lines with generic drawing edit tools. Partition boundaries are calculated locally and edited in the engineering workspace.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const snapshot = partitions.get(String(agent.id));
      return {
        phase: snapshot.phase,
        ...(snapshot.drawingRef === undefined ? {} : { drawingRef: snapshot.drawingRef }),
        segmentCount: snapshot.draft?.segments.length ?? snapshot.confirmed?.segments.length ?? 0,
        diagnostics: (snapshot.draft?.diagnostics ?? snapshot.confirmed?.diagnostics ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === 'analyzing'
          ? 'wait-for-analysis'
          : snapshot.phase === 'editing'
            ? 'edit-or-confirm-in-engineering-workspace'
            : snapshot.phase === 'confirmed'
              ? 'ready-for-automatic-annotation'
              : 'import-engineering-dxf',
      } as unknown as JsonValue;
    },
  });
}

export function createPartitionStartTool(workflow: {
  start(agent: Agent, engineeringContext: string | undefined, signal?: AbortSignal): Promise<PartitionSessionSnapshot>;
}) {
  return defineTool({
    name: 'drawing_partition_start',
    description: 'Start or refresh smart shaft partitioning for the active DXF only when the user explicitly asks to partition, segment, or identify functional shaft regions. A document attachment alone is never intent. If the user supplied relevant engineering documentation, pass only its concise partition-related text in engineeringContext; local geometry computes and snaps every boundary.',
    parameters: {
      engineeringContext: { type: 'string', description: 'Optional concise, verbatim partition-related evidence from the user-provided document. Omit when none is relevant.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const engineeringContext = typeof args.engineeringContext === 'string' ? args.engineeringContext.trim() : undefined;
      if (Buffer.byteLength(engineeringContext ?? '', 'utf8') > 32 * 1024) throw new Error('PARTITION_CONTEXT_SIZE_LIMIT');
      const snapshot = await workflow.start(agent, engineeringContext || undefined, exec.signal);
      return {
        status: snapshot.phase,
        segmentCount: snapshot.draft?.segments.length ?? snapshot.confirmed?.segments.length ?? 0,
        semanticGroupCount: snapshot.draft?.semanticGroups.length ?? snapshot.confirmed?.semanticGroups.length ?? 0,
        diagnostics: (snapshot.draft?.diagnostics ?? snapshot.confirmed?.diagnostics ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === 'editing' ? 'review-and-confirm-in-engineering-workspace' : snapshot.phase,
      } as unknown as JsonValue;
    },
  });
}

function terminalStatus(
  status: DrawingExtensionProgramWorkflow['result']['status'],
): 'completed' | 'canceled' | 'failed' | 'needs-rebase' {
  if (status === 'committed' || status === 'already-satisfied') return 'completed';
  if (status === 'discarded') return 'canceled';
  if (status === 'needs-rebase') return 'needs-rebase';
  return 'failed';
}
