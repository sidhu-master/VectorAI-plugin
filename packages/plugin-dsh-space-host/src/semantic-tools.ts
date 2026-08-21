// SPDX-License-Identifier: Apache-2.0

import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools';
import {
  finalizePreviewRequestSchema,
  multiPartTransformRequestSchema,
  multiPartTransformRevisionRequestSchema,
  spatialEditProgramSchema,
} from '@vectorai/drawing-edit-protocol';

import type { SemanticEditService } from './semantic-edit-service';

type Questions = Pick<UserQuestionService, 'ask'>;

const vec2ToolSchema = {
  type: 'array', items: { type: 'number' },
  description: 'Exactly two finite Drawing coordinates [x, y].',
} as const;

const drawingRefToolSchema = {
  type: 'object',
  properties: {
    drawingId: { type: 'string', required: true },
    revision: { type: 'integer', required: true },
  },
  additionalProperties: false,
} as const;

const effectScopeToolSchema = {
  oneOf: [
    objectSchema({
      kind: literalSchema('node-field'), nodeId: requiredString(),
      fields: requiredArray({ type: 'string' }),
    }),
    objectSchema({
      kind: literalSchema('source-span'), nodeId: requiredString(),
      start: requiredInteger(), end: requiredInteger(),
    }),
    objectSchema({ kind: literalSchema('half-edge'), nodeId: requiredString(), halfEdgeId: requiredString() }),
    objectSchema({ kind: literalSchema('interface'), interfaceId: requiredString() }),
    objectSchema({
      kind: literalSchema('endpoint-slot'), nodeId: requiredString(),
      endpoint: { type: 'string', enum: ['start', 'end'], required: true },
    }),
    objectSchema({
      kind: literalSchema('creation'),
      plane: { type: 'string', enum: ['geometry', 'annotation', 'relation', 'feature'], required: true },
      nodeType: requiredString(), containerId: { type: 'string' }, maxCount: requiredInteger(),
    }),
    objectSchema({ kind: literalSchema('deletion'), nodeIds: requiredArray({ type: 'string' }) }),
  ],
} as const;

const spatialOperationToolSchema = {
  oneOf: [
    objectSchema({
      kind: literalSchema('rigid_transform'), translation: { ...vec2ToolSchema, required: true },
      rotationRadians: requiredNumber(), pivot: { ...vec2ToolSchema, required: true },
    }),
    objectSchema({
      kind: literalSchema('connected_transform'), translation: { ...vec2ToolSchema, required: true },
      rotationRadians: { type: 'number' }, pivot: vec2ToolSchema,
      interfaceIds: requiredArray({ type: 'string' }),
    }),
    objectSchema({
      kind: literalSchema('set_endpoint'), nodeId: requiredString(),
      endpoint: { type: 'string', enum: ['start', 'end'], required: true },
      point: { ...vec2ToolSchema, required: true },
    }),
    objectSchema({
      kind: literalSchema('create_path'), nodeId: requiredString(),
      points: requiredArray(vec2ToolSchema), closed: { type: 'boolean', required: true },
    }),
    objectSchema({ kind: literalSchema('delete_nodes'), nodeIds: requiredArray({ type: 'string' }) }),
    objectSchema({
      kind: literalSchema('create_annotation_batch'),
      annotations: requiredArray({
        type: 'object', properties: { id: requiredString(), type: requiredString() }, additionalProperties: true,
      }),
      associations: requiredArray({
        type: 'object',
        properties: { id: requiredString(), type: { type: 'string', const: 'association', required: true } },
        additionalProperties: true,
      }),
    }),
  ],
} as const;

const spatialPostconditionToolSchema = {
  oneOf: [
    objectSchema({ kind: literalSchema('preserve_connectivity'), nodeIds: requiredArray({ type: 'string' }) }),
    objectSchema({
      kind: literalSchema('within_bounds'),
      bounds: {
        type: 'object', required: true, additionalProperties: false,
        properties: {
          minX: requiredNumber(), minY: requiredNumber(), maxX: requiredNumber(), maxY: requiredNumber(),
        },
      },
    }),
    objectSchema({
      kind: literalSchema('target_position'), targetHandle: requiredString(),
      point: { ...vec2ToolSchema, required: true }, tolerance: requiredNumber(),
    }),
  ],
} as const;

const spatialEditProgramToolSchema = {
  type: 'object',
  properties: {
    baseRef: { ...drawingRefToolSchema, required: true },
    targetHandle: requiredString(),
    summary: requiredString(),
    objective: requiredString(),
    operations: requiredArray(spatialOperationToolSchema),
    preserveScopes: requiredArray(effectScopeToolSchema),
    postconditions: requiredArray(spatialPostconditionToolSchema),
    evidenceRefs: requiredArray({ type: 'string' }),
  },
  additionalProperties: false,
} as const;

const multiPartTransformPartToolSchema = {
  type: 'object',
  properties: {
    groundingId: { type: 'string', required: true },
    translation: { ...vec2ToolSchema, required: true },
    rotationRadians: {
      type: 'number',
      description: 'Optional exact rotation in radians. When present, pivot is also required.',
    },
    pivot: vec2ToolSchema,
  },
  additionalProperties: false,
} as const;

function withDrawingWorkflow(
  result: object,
  state: string,
  nextTools: string[],
  instruction: string,
): JsonValue {
  return {
    ...result,
    drawingWorkflow: { state, nextTools, instruction },
  } as unknown as JsonValue;
}

export function createSemanticEditToolCatalog(
  semantic: SemanticEditService,
  questions?: Questions,
) {
  return [
    createDrawingObserveTool(semantic),
    createDrawingBuildContextTool(semantic),
    createDrawingGroundTool(semantic),
    createDrawingPreviewGroundedTransformTool(semantic),
    createDrawingPreviewMultiPartTransformTool(semantic),
    createDrawingReviseGroundedTransformTool(semantic),
    createDrawingReviseMultiPartTransformTool(semantic),
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
    description: 'Preview a pose transform for an exact grounded target. Pass only the intended displacement; the Host derives the minimum-deformation orientation from actual topology and interfaces. Positive Y moves visually up. Use the advanced program tool only when the user explicitly specifies an exact rotation.',
    parameters: {
      taskId: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      translation: {
        type: 'array', items: { type: 'number' }, required: true,
        description: 'Exactly two numbers [dx, dy] in Drawing units. Positive dy moves the target visually up.',
      },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = args as {
        taskId: string;
        groundingId: string;
        translation: [number, number];
        summary: string;
      };
      const preview = semantic.previewGroundedTransform(requireSession(exec.agent?.id), {
        taskId: input.taskId,
        groundingId: input.groundingId,
        translation: input.translation,
        summary: input.summary,
      });
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate this exact Preview before attempting to finalize it.',
      );
    },
  });
}

export function createDrawingPreviewMultiPartTransformTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_preview_multi_part_transform',
    description: 'Create one atomic Preview for 2-16 independently moving grounded parts. Ground each semantic carrier separately with a stable partKey and label, then give every grounding its own translation and optional exact rotation/pivot. Use this for coordinated poses; never split one user intent into sequential commits.',
    parameters: {
      taskId: { type: 'string', required: true },
      parts: {
        type: 'array', required: true,
        description: 'Two to sixteen exact Groundings. Each groundingId may appear once.',
        items: multiPartTransformPartToolSchema,
      },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = multiPartTransformRequestSchema.parse(args);
      const preview = semantic.previewMultiPartTransform(requireSession(exec.agent?.id), input);
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate the complete multi-part Preview before attempting to finalize it.',
      );
    },
  });
}

export function createDrawingReviseMultiPartTransformTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_revise_multi_part_transform',
    description: 'Atomically replace the exact current multi-part Preview after visual feedback. Keep the same task and Groundings, adjust any part transforms, and bind the replacement to the current Preview handle and candidate digest.',
    parameters: {
      taskId: { type: 'string', required: true },
      currentPreviewHandle: { type: 'string', required: true },
      currentCandidateDigest: { type: 'string', required: true },
      parts: {
        type: 'array', required: true,
        description: 'Two to sixteen exact Groundings with revised transforms.',
        items: multiPartTransformPartToolSchema,
      },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = multiPartTransformRevisionRequestSchema.parse(args);
      const preview = semantic.reviseMultiPartTransform(requireSession(exec.agent?.id), input);
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate the replacement multi-part Preview; the previous handle is no longer current.',
      );
    },
  });
}

export function createDrawingReviseGroundedTransformTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_revise_grounded_transform',
    description: 'Replace the current pose Preview after visual evaluation requests a revision. Keep the same task; optionally call drawing_ground again with the existing context to narrow the moving target. The Host derives orientation from topology. Never call drawing_observe twice in one user turn.',
    parameters: {
      taskId: { type: 'string', required: true },
      currentPreviewHandle: { type: 'string', required: true },
      currentCandidateDigest: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      translation: {
        type: 'array', items: { type: 'number' }, required: true,
        description: 'Exactly two numbers [dx, dy]. Positive dy moves visually up.',
      },
      summary: { type: 'string', required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = args as {
        taskId: string;
        currentPreviewHandle: string;
        currentCandidateDigest: string;
        groundingId: string;
        translation: [number, number];
        summary: string;
      };
      const preview = semantic.reviseGroundedTransform(requireSession(exec.agent?.id), {
        taskId: input.taskId,
        currentPreviewHandle: input.currentPreviewHandle,
        currentCandidateDigest: input.currentCandidateDigest,
        groundingId: input.groundingId,
        translation: input.translation,
        summary: input.summary,
      });
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate the replacement Preview; the previous Preview handle is no longer current.',
      );
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
      return {
        task,
        observation,
        ...(imageAttachment ? { imageAttachment } : {}),
        drawingWorkflow: {
          state: 'observed',
          nextTools: ['drawing_build_context'],
          instruction: 'Build bounded context with this taskId and observationId. Follow the next drawing tool descriptions; all returned handles are task- and revision-bound.',
        },
      } as unknown as JsonValue;
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
      const context = semantic.buildContext(requireSession(exec.agent?.id), args);
      return withDrawingWorkflow(
        context,
        'context_ready',
        ['drawing_ground'],
        'Ground the exact semantic target against this bounded context before creating a Preview.',
      );
    },
  });
}

export function createDrawingGroundTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_ground',
    description: 'Ground one exact semantic carrier to node ids and topology interfaces. For a coordinated multi-part edit, call once per independently moving part with a stable partKey and user-facing label. Pass empty interfaces so the Host derives true contacted endpoint slots. When the user refers to a Host selection, pass its selectionProjectionId with empty targetNodeIds.',
    parameters: {
      taskId: { type: 'string', required: true },
      contextId: { type: 'string', required: true },
      selectionProjectionId: {
        type: 'string',
        description: 'Optional Host selection handle. Omit this field entirely when drawing_observe did not return one; never send an empty string.',
      },
      partKey: {
        type: 'string',
        description: 'Stable per-task key for one independently moving part. Provide together with label for multi-part edits.',
      },
      label: {
        type: 'string',
        description: 'Short user-facing canvas label for this part. Provide together with partKey.',
      },
      targetNodeIds: { type: 'array', items: { type: 'string' }, required: true },
      interfaces: {
        type: 'array', required: true,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            interfaceId: { type: 'string', required: true },
            nodeId: { type: 'string', required: true },
            endpoint: { type: 'string', enum: ['start', 'end'], required: true },
          },
        },
      },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const grounding = semantic.ground(requireSession(exec.agent?.id), args as never);
      return withDrawingWorkflow(
        grounding,
        'grounded',
        ['drawing_preview_grounded_transform', 'drawing_preview_multi_part_transform', 'drawing_preview_program'],
        'Use grounded transform for one part, multi-part transform after grounding every independent part, or the advanced program only for other explicit spatial operations.',
      );
    },
  });
}

export function createDrawingPreviewProgramTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_preview_program',
    description: 'Advanced tool for non-pose spatial operations and exact numeric rotations explicitly requested by the user. For ordinary moving, raising, lowering, or posing, use drawing_preview_grounded_transform so the Host derives minimum-deformation orientation. Compiles a complete Spatial Edit Program against an exact grounding and never accepts raw Drawing transaction commands.',
    parameters: {
      taskId: { type: 'string', required: true },
      groundingId: { type: 'string', required: true },
      program: { ...spatialEditProgramToolSchema, required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const program = spatialEditProgramSchema.parse(args.program);
      const input = args as { taskId: string; groundingId: string };
      const preview = semantic.previewProgram(requireSession(exec.agent?.id), {
        taskId: input.taskId,
        groundingId: input.groundingId,
        program: program as never,
      });
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate this exact Preview before attempting to finalize it.',
      );
    },
  });
}

function requiredString() {
  return { type: 'string', required: true } as const;
}

function requiredNumber() {
  return { type: 'number', required: true } as const;
}

function requiredInteger() {
  return { type: 'integer', required: true } as const;
}

function requiredArray<const T extends object>(items: T) {
  return { type: 'array', items, required: true } as const;
}

function literalSchema<const Value extends string>(value: Value) {
  return { type: 'string', const: value, required: true } as const;
}

function objectSchema<const Properties extends Record<string, object>>(properties: Properties) {
  return { type: 'object', properties, additionalProperties: false } as const;
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
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(args, exec) {
      const result = await semantic.evaluatePreview(requireSession(exec.agent?.id), args);
      const revisionRequired = result.evaluation.review.outcome === 'needs_revision'
        || result.assessment.disposition === 'blocked';
      return withDrawingWorkflow(
        result,
        revisionRequired ? 'revision_required' : 'evaluated',
        revisionRequired
          ? [
              'drawing_revise_grounded_transform',
              'drawing_revise_multi_part_transform',
              'drawing_revise_preview',
              'drawing_discard_preview',
            ]
          : ['drawing_finalize_preview'],
        revisionRequired
          ? 'Do not finalize this candidate. Revise it from the reported evidence or discard it.'
          : 'Finalize this exact evaluated Preview; the Host will apply auto-safe or request the required user decision.',
      );
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
      program: { ...spatialEditProgramToolSchema, required: true },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const program = spatialEditProgramSchema.parse(args.program);
      const preview = semantic.revisePreview(requireSession(exec.agent?.id), {
        taskId: args.taskId,
        currentPreviewHandle: args.currentPreviewHandle,
        currentCandidateDigest: args.currentCandidateDigest,
        groundingId: args.groundingId,
        program: program as never,
      });
      return withDrawingWorkflow(
        preview,
        'preview_ready',
        ['drawing_evaluate_preview'],
        'Evaluate the replacement Preview; the previous Preview handle is no longer current.',
      );
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
