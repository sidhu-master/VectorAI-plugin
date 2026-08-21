// SPDX-License-Identifier: Apache-2.0

import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools';
import {
  finalizePreviewRequestSchema,
  spatialEditProgramSchema,
} from '@vectorai/drawing-edit-protocol';

import type { SemanticEditService } from './semantic-edit-service';

type Questions = Pick<UserQuestionService, 'ask'>;

export function createSemanticEditToolCatalog(
  semantic: SemanticEditService,
  questions?: Questions,
) {
  return [
    createDrawingObserveTool(semantic),
    createDrawingBuildContextTool(semantic),
    createDrawingGroundTool(semantic),
    createDrawingPreviewGroundedTransformTool(semantic),
    createDrawingReviseGroundedTransformTool(semantic),
    createDrawingPreviewProgramTool(semantic),
    createDrawingRevisePreviewTool(semantic),
    createDrawingEvaluatePreviewTool(semantic),
    createDrawingFinalizeSemanticTool(semantic, questions),
    createDrawingDiscardSemanticTool(semantic),
    createDrawingGetOperationTool(semantic),
    createDrawingUndoTool(semantic, questions),
  ];
}

export function createDrawingPreviewGroundedTransformTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_preview_grounded_transform',
    description: 'Preview a rigid or articulated transform for an exact grounded target. Pass a displacement; for a connected closed carrier omit rotation so the Host chooses the minimum-deformation orientation from its actual interfaces. Positive Y moves visually up.',
    parameters: {
      taskId: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      translation: {
        type: 'array', items: { type: 'number' }, required: true,
        description: 'Exactly two numbers [dx, dy] in Drawing units. Positive dy moves the target visually up.',
      },
      rotationDegrees: {
        type: 'number',
        description: 'Optional explicit orientation change. Omit for Host minimum-deformation orientation on connected closed carriers.',
      },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.previewGroundedTransform(requireSession(exec.agent?.id), args as never) as unknown as JsonValue;
    },
  });
}

export function createDrawingReviseGroundedTransformTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_revise_grounded_transform',
    description: 'Replace the current transform Preview after visual evaluation requests a revision. Keep the same task; optionally call drawing_ground again with the existing context to narrow the moving target. Never call drawing_observe twice in one user turn.',
    parameters: {
      taskId: { type: 'string', required: true },
      currentPreviewHandle: { type: 'string', required: true },
      currentCandidateDigest: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      translation: {
        type: 'array', items: { type: 'number' }, required: true,
        description: 'Exactly two numbers [dx, dy]. Positive dy moves visually up.',
      },
      rotationDegrees: { type: 'number', description: 'Optional explicit orientation; omit for Host minimum deformation.' },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.reviseGroundedTransform(requireSession(exec.agent?.id), args as never) as unknown as JsonValue;
    },
  });
}

export function createDrawingObserveTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_observe',
    description: 'Start a revision-bound semantic edit task from the current direct user instruction and create an observation of the active local Drawing. Call before grounding or editing.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const task = semantic.startBoundTask(sessionId);
      const observation = await semantic.observe(sessionId, { taskId: task.taskId });
      const imageAttachment = semantic.observationAttachment(observation.observationId);
      return { task, observation, ...(imageAttachment ? { imageAttachment } : {}) } as unknown as JsonValue;
    },
  });
}

export function createDrawingBuildContextTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_build_context',
    description: 'Build bounded drawing context for an exact task and observation before selecting an edit target.',
    parameters: {
      taskId: { type: 'string', required: true },
      observationId: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.buildContext(requireSession(exec.agent?.id), args) as unknown as JsonValue;
    },
  });
}

export function createDrawingGroundTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_ground',
    description: 'Ground a semantic target to exact node ids and topology interfaces. Choose only the semantic carrier being transformed; pass empty interfaces so the Host derives true contacted endpoint slots. When the user refers to a Host selection, pass its selectionProjectionId with empty targetNodeIds.',
    parameters: {
      taskId: { type: 'string', required: true },
      contextId: { type: 'string', required: true },
      selectionProjectionId: {
        type: 'string',
        description: 'Optional Host selection handle. Omit this field entirely when drawing_observe did not return one; never send an empty string.',
      },
      targetNodeIds: { type: 'array', items: { type: 'string' }, required: true },
      interfaces: { type: 'array', items: { type: 'json' }, required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.ground(requireSession(exec.agent?.id), args as never) as unknown as JsonValue;
    },
  });
}

export function createDrawingPreviewProgramTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_preview_program',
    description: 'Advanced tool for non-transform spatial operations. For moving, rotating, raising, lowering, or posing a part, use drawing_preview_grounded_transform instead. Compiles a complete Spatial Edit Program against an exact grounding and never accepts raw Drawing transaction commands.',
    parameters: {
      taskId: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      program: { type: 'json', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const program = spatialEditProgramSchema.parse(args.program);
      return semantic.previewProgram(requireSession(exec.agent?.id), {
        taskId: args.taskId,
        groundingId: args.groundingId,
        program: program as never,
      }) as unknown as JsonValue;
    },
  });
}

export function createDrawingEvaluatePreviewTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_evaluate_preview',
    description: 'Run mandatory deterministic validation and the local reviewer over an exact Drawing Preview. The Host computes policy; caller-provided auto-safe claims are not accepted.',
    parameters: {
      taskId: { type: 'string', required: true },
      previewHandle: { type: 'string', required: true },
      candidateDigest: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return await semantic.evaluatePreview(requireSession(exec.agent?.id), args) as unknown as JsonValue;
    },
  });
}

export function createDrawingRevisePreviewTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_revise_preview',
    description: 'Replace the exact current Preview with another candidate in the same task. The former Preview remains current if compilation fails; a task allows at most three candidates.',
    parameters: {
      taskId: { type: 'string', required: true },
      currentPreviewHandle: { type: 'string', required: true },
      currentCandidateDigest: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      program: { type: 'json', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const program = spatialEditProgramSchema.parse(args.program);
      return semantic.revisePreview(requireSession(exec.agent?.id), {
        taskId: args.taskId,
        currentPreviewHandle: args.currentPreviewHandle,
        currentCandidateDigest: args.currentCandidateDigest,
        groundingId: args.groundingId,
        program: program as never,
      }) as unknown as JsonValue;
    },
  });
}

export function createDrawingFinalizeSemanticTool(
  semantic: SemanticEditService,
  questions?: Questions,
) {
  const pendingDecisions = new Map<string, Promise<JsonValue>>();
  return defineTool({
    name: 'drawing_finalize_preview',
    description: 'Finalize an evaluated semantic Preview. Exact auto-safe candidates commit locally; risk-qualified candidates ask the runtime-root user; blocked candidates never commit.',
    parameters: {
      previewHandle: { type: 'string', required: true },
      previewDigest: { type: 'string', required: true },
      finalizeOperationId: { type: 'string', required: true },
      finalizeOperationBindingDigest: { type: 'string', required: true },
      evaluationId: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const request = finalizePreviewRequestSchema.parse(args);
      const result = semantic.finalizePreview(sessionId, request);
      if (result.status !== 'rejected' || result.disposition !== 'confirmation_required') {
        return result as unknown as JsonValue;
      }
      if (!questions || !exec.agent) return {
        status: 'root-required',
        message: 'This candidate requires a direct runtime-root user decision.',
      } as JsonValue;
      const decisionKey = `${sessionId}\0${request.finalizeOperationId}\0${request.finalizeOperationBindingDigest}`;
      const existing = pendingDecisions.get(decisionKey);
      if (existing) return await existing;
      const decision = (async (): Promise<JsonValue> => {
        const answer = await questions.ask({
          agent: exec.agent!,
          signal: exec.signal,
          questions: [{
            id: `drawing-confirm-${request.finalizeOperationId}`,
            header: '图纸修改确认',
            question: '这个候选修改包含需要你确认的风险，是否应用？',
            options: [
              { label: '应用修改', description: '按当前预览提交一个可撤销的新版本。' },
              { label: '继续修改', description: '保留正式图纸不变并让 AI 重新生成候选。' },
              { label: '取消', description: '丢弃当前候选，不修改图纸。' },
            ],
          }],
        });
        const selected = answer.answers.find(({ id }) => id === `drawing-confirm-${request.finalizeOperationId}`);
        if (selected?.selected.length === 1 && selected.selected[0] === '应用修改' && !selected.custom) {
          return semantic.confirmFinalize(sessionId, request) as unknown as JsonValue;
        }
        if (selected?.selected.length === 1 && selected.selected[0] === '取消' && !selected.custom) {
          return semantic.discardPreview(sessionId, request.previewHandle) as unknown as JsonValue;
        }
        return {
          status: 'needs-revision', evaluationId: request.evaluationId,
          reasons: [selected?.custom?.trim() || 'The user requested another candidate.'],
        } as JsonValue;
      })();
      pendingDecisions.set(decisionKey, decision);
      try { return await decision; } finally {
        if (pendingDecisions.get(decisionKey) === decision) pendingDecisions.delete(decisionKey);
      }
    },
  });
}

export function createDrawingDiscardSemanticTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_discard_preview',
    description: 'Discard the current semantic Preview without changing the formal Drawing.',
    parameters: { previewHandle: { type: 'string', required: true } },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.discardPreview(requireSession(exec.agent?.id), args.previewHandle) as unknown as JsonValue;
    },
  });
}

export function createDrawingGetOperationTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_get_operation',
    description: 'Resolve the durable outcome of a local Drawing write after a response, transport, cancellation, or fsync outcome was uncertain.',
    parameters: {
      operationId: { type: 'string', required: true },
      operationBindingDigest: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      return semantic.getOperation(
        requireSession(exec.agent?.id), args.operationId, args.operationBindingDigest,
      ) as unknown as JsonValue;
    },
  });
}

export function createDrawingUndoTool(semantic: SemanticEditService, questions?: Questions) {
  const pendingDecisions = new Map<string, Promise<JsonValue>>();
  return defineTool({
    name: 'drawing_undo_commit',
    description: 'Request an explicit user-authorized Undo of the exact current Drawing commit. Undo creates a new compensating revision and never rewrites history.',
    parameters: {
      targetCommitId: { type: 'string', required: true },
      expectedCurrentRef: {
        type: 'object',
        properties: {
          drawingId: { type: 'string', required: true },
          revision: { type: 'integer', required: true },
        },
        additionalProperties: false,
        required: true,
      },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      if (!questions || !exec.agent) return { status: 'root-required', message: 'Undo requires a direct runtime-root user decision.' } as JsonValue;
      const decisionKey = `${sessionId}\0${args.targetCommitId}\0${JSON.stringify(args.expectedCurrentRef)}`;
      const existing = pendingDecisions.get(decisionKey);
      if (existing) return await existing;
      const decision = (async (): Promise<JsonValue> => {
        const answer = await questions.ask({
          agent: exec.agent!, signal: exec.signal,
          questions: [{
            id: `drawing-undo-${args.targetCommitId}`,
            header: '撤销图纸修改', question: '撤销这个图纸版本并创建一个恢复版本？',
            options: [{ label: '撤销此提交' }, { label: '取消' }],
          }],
        });
        const selected = answer.answers.find(({ id }) => id === `drawing-undo-${args.targetCommitId}`);
        if (selected?.selected.length !== 1 || selected.selected[0] !== '撤销此提交' || selected.custom) {
          return { status: 'discarded', ref: args.expectedCurrentRef } as JsonValue;
        }
        return semantic.undoAuthorized(sessionId, args) as unknown as JsonValue;
      })();
      pendingDecisions.set(decisionKey, decision);
      try { return await decision; } finally {
        if (pendingDecisions.get(decisionKey) === decision) pendingDecisions.delete(decisionKey);
      }
    },
  });
}

function requireSession(id: unknown): string {
  if (id === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
  return String(id);
}

function renderJson(_args: unknown, value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) }];
}

function renderObservation(_args: unknown, value: unknown) {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; attachment: NonNullable<ReturnType<SemanticEditService['observationAttachment']>> }
  > = [{ type: 'text', text: JSON.stringify(value) }];
  if (value && typeof value === 'object' && 'imageAttachment' in value) {
    const attachment = (value as { imageAttachment?: unknown }).imageAttachment;
    if (attachment && typeof attachment === 'object' && 'attachmentId' in attachment) {
      content.push({
        type: 'image',
        attachment: attachment as NonNullable<ReturnType<SemanticEditService['observationAttachment']>>,
      });
    }
  }
  return content;
}
