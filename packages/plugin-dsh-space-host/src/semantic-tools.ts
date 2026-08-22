// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';
import {
  defineTool,
  type JsonValue,
  type ObjectValueSchemaSpec,
  type ParameterPropertySpec,
  type ParameterSchemaSpec,
  type ValueSchemaSpec,
} from '@deepseek-ai/dsh-tools';
import {
  drawingSelectPartsRequestSchema,
  spatialIntentRequestSchema,
  spatialIntentRevisionSchema,
} from '@vectorai/drawing-edit-protocol';

import type { SemanticEditService } from './semantic-edit-service';
import type { MotionRigService } from './motion-rig-service';

type Questions = Pick<UserQuestionService, 'ask'>;

const string = (description?: string): ParameterPropertySpec => ({
  type: 'string', required: true, ...(description ? { description } : {}),
});
const optionalString = (): ParameterPropertySpec => ({ type: 'string' });
const literal = (value: string): ParameterPropertySpec => ({ type: 'string', const: value, required: true });
const enumeration = (values: string[]): ParameterPropertySpec => ({ type: 'string', enum: values, required: true });
const array = (items: ValueSchemaSpec, required = true): ParameterPropertySpec => ({
  type: 'array', items, ...(required ? { required: true as const } : {}),
});
const object = (properties: ParameterSchemaSpec): ObjectValueSchemaSpec => ({
  type: 'object', properties, additionalProperties: false,
});
const normalizedPoint = {
  type: 'array' as const, items: { type: 'number' as const },
  description: 'Exactly two normalized observation coordinates in [0, 1].',
};

const selectionReference: ValueSchemaSpec = {
  oneOf: [
    object({ kind: literal('current_selection') }),
    object({ kind: literal('observation_point'), normalized: { ...normalizedPoint, required: true } }),
    object({ kind: literal('observation_region'), polygon: array(normalizedPoint) }),
    object({ kind: literal('candidate'), key: string() }),
    object({ kind: literal('semantic_query'), text: string() }),
  ],
};

const selectionExclusion: ValueSchemaSpec = {
  oneOf: [
    object({ kind: literal('candidate'), value: string() }),
    object({ kind: literal('semantic_query'), value: string() }),
  ],
};

const spatialReference: ValueSchemaSpec = {
  oneOf: [
    object({ kind: literal('part'), partKey: string() }),
    object({ kind: literal('drawing_anchor'), anchor: enumeration(['center', 'top', 'bottom', 'left', 'right']) }),
    object({ kind: literal('observation_point'), normalized: { ...normalizedPoint, required: true } }),
    object({ kind: literal('semantic_anchor'), query: string() }),
  ],
};

const magnitude = enumeration(['minimum', 'slight', 'moderate', 'strong']);
const spatialGoal: ValueSchemaSpec = {
  oneOf: [
    object({
      kind: literal('direction'), subject: string(),
      direction: enumeration(['up', 'down', 'left', 'right']), magnitude,
    }),
    object({
      kind: literal('relative_position'), subject: string(),
      reference: { ...spatialReference, required: true },
      relation: enumeration(['above', 'below', 'left_of', 'right_of', 'near', 'far', 'centered']),
      magnitude,
    }),
    object({
      kind: literal('alignment'), subject: string(),
      reference: { ...spatialReference, required: true }, axis: enumeration(['x', 'y', 'both']),
    }),
    object({
      kind: literal('topology'), subject: string(),
      reference: { ...spatialReference, required: true },
      relation: enumeration(['touches', 'crosses', 'does_not_cross', 'inside', 'outside']),
    }),
    object({
      kind: literal('explicit_numeric'), subject: string(),
      quantity: enumeration(['delta_x', 'delta_y', 'distance', 'angle', 'target_x', 'target_y']),
      numericKey: string('Reference a Host-extracted numericKey; never copy a coordinate value.'),
    }),
  ],
};

const preservationGoal: ValueSchemaSpec = {
  oneOf: [
    object({ kind: literal('part_shape'), partKey: string() }),
    object({ kind: literal('connectivity'), partKey: string() }),
    object({ kind: literal('anchor'), reference: { ...spatialReference, required: true } }),
    object({ kind: literal('topology'), partKey: optionalString() }),
    object({ kind: literal('protected_scope') }),
    object({ kind: literal('minimum_deformation') }),
  ],
};

const intentParameters: ParameterSchemaSpec = {
  summary: string('A short semantic description of the desired result.'),
  goals: array(spatialGoal),
  preserve: array(preservationGoal),
};

export function createSemanticEditToolCatalog(
  semantic: SemanticEditService,
  questions?: Questions,
  motionRigs?: MotionRigService,
) {
  return [
    createDrawingObserveTool(semantic),
    createDrawingSelectPartsTool(semantic),
    createDrawingApplySelectionCorrectionTool(semantic),
    createDrawingConfirmSelectionTool(semantic),
    createDrawingPreviewSpatialIntentTool(semantic),
    createDrawingReviseSpatialIntentTool(semantic),
    createDrawingEvaluatePreviewTool(semantic),
    createDrawingFinalizeSemanticTool(semantic, questions),
    createDrawingDiscardSemanticTool(semantic),
    createDrawingGetOperationTool(semantic),
    createDrawingUndoTool(semantic, questions),
    ...(motionRigs ? [createDrawingCreateMotionRigTool(semantic, motionRigs)] : []),
  ];
}

export function createDrawingCreateMotionRigTool(
  semantic: SemanticEditService,
  motionRigs: MotionRigService,
) {
  return defineTool({
    name: 'drawing_create_motion_rig',
    description: 'Create a temporary local movement constraint only after the user explicitly asks to hinge, drag, articulate, or interactively pose part of the active vector Drawing. First identify the intended semantic geometry with drawing_select_parts. This tool never chooses final coordinates and must not be used for ordinary image uploads or image questions.',
    parameters: {
      target: string('Semantic name of the movable assembly requested by the user.'),
      controlRole: optionalString(),
      fixedRole: optionalString(),
      motion: literal('translate'),
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const selectedParts = semantic.currentSelectedParts(sessionId);
      const semanticNodeIds = [...new Set(Object.values(selectedParts)
        .flatMap(({ targetNodeIds }) => targetNodeIds))];
      const projected = semanticNodeIds.length === 0
        ? semantic.currentSelectionProjection(sessionId)?.nodeIds ?? []
        : semanticNodeIds;
      return motionRigs.create(sessionId, projected) as unknown as JsonValue;
    },
  });
}

export function createDrawingApplySelectionCorrectionTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_apply_selection_correction',
    description: 'Apply the Host-computed correction after a selection validation error. This takes no candidate ids: the Host removes or regroups only the geometry identified by deterministic validation. Inspect the returned highlighted image, then confirm it if exact.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const result = semantic.applyCurrentSelectionCorrection(sessionId);
      const imageAttachment = result.state === 'selected'
        ? await semantic.renderCurrentSelectionObservation(sessionId)
        : null;
      return {
        ...result,
        ...(imageAttachment ? {
          imageAttachment,
          selectionReview: 'Inspect the corrected highlighted geometry. If it is exact, call drawing_confirm_selection; otherwise call drawing_select_parts.',
        } : {}),
        drawingWorkflow: workflow(result.state, result.nextTools),
      } as unknown as JsonValue;
    },
  });
}

export function createDrawingObserveTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_observe',
    description: 'Observe the active Drawing only after the user asks to inspect or edit it. The Host owns task, revision, viewport, and observation lineage, and returns short cN selection candidates alongside the image.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_observe'], async () => {
        const result = await semantic.observeCurrent(sessionId);
        const imageAttachment = semantic.currentObservationAttachment(sessionId);
        return {
          ...result,
          ...(imageAttachment ? { imageAttachment } : {}),
          drawingWorkflow: workflow(result.state, result.nextTools),
        } as unknown as JsonValue;
      });
    },
  });
}

export function createDrawingSelectPartsTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_select_parts',
    description: 'Name the semantic parts to edit. Prefer candidate cN labels shown directly on the drawing_observe image; multiple exact candidate references inside one part are merged even when their contours are disconnected. Otherwise use current canvas selection or observation points/regions. Never use drawing_query node ids. Inspect the returned highlighted image. If it is wrong, call drawing_select_parts again; if it is exact, call drawing_confirm_selection. Preview is blocked until this review step is completed.',
    parameters: {
      parts: array(object({
        partKey: string('Stable semantic name used by later goals.'), label: string(),
        references: array(selectionReference), exclude: array(selectionExclusion, false),
      })),
    },
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(args, exec) {
      const input = drawingSelectPartsRequestSchema.parse(args);
      const sessionId = requireSession(exec.agent?.id);
      const result = semantic.selectCurrentParts(sessionId, input);
      const imageAttachment = result.state === 'selected'
        ? await semantic.renderCurrentSelectionObservation(sessionId)
        : null;
      return {
        ...result,
        ...(imageAttachment ? {
          imageAttachment,
          selectionReview: 'Inspect the highlighted geometry now. If any unrelated geometry is highlighted or any intended geometry is missing, call drawing_select_parts again with corrected cN references. Only when it is exact, call drawing_confirm_selection.',
        } : {}),
        drawingWorkflow: workflow(result.state, result.nextTools),
      } as unknown as JsonValue;
    },
  });
}

export function createDrawingConfirmSelectionTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_confirm_selection',
    description: 'Confirm that the most recent highlighted selection image exactly matches the requested semantic parts. Call this only after inspecting that image. If the highlight is wrong or incomplete, call drawing_select_parts again instead.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_select_parts'], () => {
        const result = semantic.confirmCurrentSelection(sessionId);
        return {
          ...result,
          drawingWorkflow: workflow(result.state, result.nextTools),
        } as unknown as JsonValue;
      });
    },
  });
}

export function createDrawingPreviewSpatialIntentTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_preview_spatial_intent',
    description: 'Describe the desired spatial relationship qualitatively. Do not calculate coordinates, rotations, pivots, or transforms; the deterministic Host solver does that.',
    parameters: intentParameters,
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = spatialIntentRequestSchema.parse(args);
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_apply_selection_correction', 'drawing_select_parts', 'drawing_confirm_selection'], () => {
        semantic.previewCurrentIntent(sessionId, input);
        return semantic.currentPreviewPresentation(sessionId) as unknown as JsonValue;
      });
    },
  });
}

export function createDrawingReviseSpatialIntentTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_revise_spatial_intent',
    description: 'Replace the current candidate by revising semantic goals or preservation requirements. The Host recomputes all coordinates.',
    parameters: {
      goalDelta: array(spatialGoal),
      preserveDelta: array(preservationGoal, false),
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const input = spatialIntentRevisionSchema.parse(args);
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_observe'], () => {
        semantic.reviseCurrentIntent(sessionId, input);
        return semantic.currentPreviewPresentation(sessionId) as unknown as JsonValue;
      });
    },
  });
}

export function createDrawingEvaluatePreviewTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_evaluate_preview',
    description: 'Run deterministic validators and visual review on the current Host-owned Preview.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderObservation },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_observe'], async () => {
        const { evaluation, assessment, imageAttachment } = await semantic.evaluateCurrentPreview(sessionId, exec.signal);
        const revisionRequired = evaluation.review.outcome !== 'satisfied'
          || assessment.disposition === 'blocked';
        const nextTools = assessment.disposition === 'blocked'
          ? ['drawing_revise_spatial_intent', 'drawing_discard_preview']
          : revisionRequired
            ? ['drawing_revise_spatial_intent', 'drawing_finalize_preview', 'drawing_discard_preview']
            : ['drawing_finalize_preview'];
        return {
          review: {
            outcome: evaluation.review.outcome,
            defects: evaluation.review.defects.map(({ code, reason }) => ({ code, reason })),
          },
          diagnostics: evaluation.diagnostics.map(({ code, severity, message, hard }) => ({
            code, severity, message, ...(hard === undefined ? {} : { hard }),
          })),
          assessment: { disposition: assessment.disposition, reasons: assessment.reasons },
          ...(imageAttachment ? { imageAttachment } : {}),
          drawingWorkflow: workflow(revisionRequired ? 'needs_revision' : 'evaluated', nextTools),
        } as unknown as JsonValue;
      });
    },
  });
}

export function createDrawingFinalizeSemanticTool(
  semantic: SemanticEditService,
  questions?: Questions,
) {
  const pending = new Map<string, Promise<JsonValue>>();
  return defineTool({
    name: 'drawing_finalize_preview',
    description: 'Finalize the current evaluated Preview. The Host resolves all hidden lineage, commits auto-safe edits, and asks for exact human confirmation when required.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const inFlight = pending.get(sessionId);
      if (inFlight) return await inFlight;
      const decision = (async (): Promise<JsonValue> => recover(['drawing_observe'], async () => {
        const initial = semantic.finalizeCurrentPreview(sessionId);
        if (initial.status !== 'rejected' || initial.disposition !== 'confirmation_required') {
          return presentFinalize(initial);
        }
        if (!questions || !exec.agent) return {
          status: 'rejected', code: 'FINALIZE_HUMAN_AUTHORITY_REQUIRED',
          message: 'This Preview requires a direct user decision.',
          drawingWorkflow: workflow('confirmation_required', ['drawing_finalize_preview', 'drawing_discard_preview']),
        } as JsonValue;
        const questionId = 'drawing-confirm-current';
        const answer = await questions.ask({
          agent: exec.agent, signal: exec.signal,
          questions: [{
            id: questionId, header: '图纸修改确认', question: '是否应用当前预览中的图纸修改？',
            options: [
              { label: '应用修改', description: '提交一个可撤销的新版本。' },
              { label: '继续修改', description: '保留预览并继续调整。' },
              { label: '取消', description: '丢弃预览，不修改图纸。' },
            ],
          }],
        });
        const selected = answer.answers.find(({ id }) => id === questionId);
        if (selected?.selected.length === 1 && selected.selected[0] === '应用修改' && !selected.custom) {
          return presentFinalize(semantic.finalizeCurrentPreview(sessionId, true));
        }
        if (selected?.selected.length === 1 && selected.selected[0] === '取消' && !selected.custom) {
          return presentDiscard(semantic.discardCurrentPreview(sessionId));
        }
        return {
          status: 'needs-revision', reason: selected?.custom?.trim() || 'User requested another candidate.',
          drawingWorkflow: workflow('needs_revision', ['drawing_revise_spatial_intent', 'drawing_discard_preview']),
        } as JsonValue;
      }))();
      pending.set(sessionId, decision);
      try { return await decision; } finally {
        if (pending.get(sessionId) === decision) pending.delete(sessionId);
      }
    },
  });
}

export function createDrawingDiscardSemanticTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_discard_preview',
    description: 'Discard the current Host-owned Preview without changing the formal Drawing.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(_args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      return recover(['drawing_observe'], () => presentDiscard(semantic.discardCurrentPreview(sessionId)));
    },
  });
}

export function createDrawingGetOperationTool(semantic: SemanticEditService) {
  return defineTool({
    name: 'drawing_get_operation',
    description: 'Resolve the current Drawing write outcome after a transport, cancellation, or persistence result was uncertain.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(_args, exec) {
      const result = semantic.getCurrentOperation(requireSession(exec.agent?.id));
      if (result.status === 'committed' || result.status === 'no-effect') {
        const receipt = result.receipt;
        const ref = receipt.status === 'no-effect' ? receipt.ref : receipt.resultingRef;
        return { status: result.status, revision: ref.revision } as JsonValue;
      }
      return { status: result.status } as JsonValue;
    },
  });
}

export function createDrawingUndoTool(semantic: SemanticEditService, questions?: Questions) {
  const pending = new Map<string, Promise<JsonValue>>();
  return defineTool({
    name: 'drawing_undo_commit',
    description: 'Request an explicit user-authorized Undo of the exact current Drawing commit.',
    parameters: {
      targetCommitId: string(),
      expectedCurrentRef: {
        ...object({ drawingId: string(), revision: { type: 'integer', required: true } }), required: true,
      },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args, exec) {
      const sessionId = requireSession(exec.agent?.id);
      const input = args as unknown as {
        targetCommitId: string;
        expectedCurrentRef: { drawingId: string; revision: number };
      };
      if (!questions || !exec.agent) return {
        status: 'rejected', code: 'UNDO_HUMAN_AUTHORITY_REQUIRED',
        message: 'Undo requires a direct user decision.',
      } as JsonValue;
      const key = `${sessionId}\0${input.targetCommitId}\0${JSON.stringify(input.expectedCurrentRef)}`;
      const inFlight = pending.get(key);
      if (inFlight) return await inFlight;
      const decision = (async (): Promise<JsonValue> => {
        const questionId = `drawing-undo-${input.targetCommitId}`;
        const answer = await questions.ask({
          agent: exec.agent!, signal: exec.signal,
          questions: [{
            id: questionId, header: '撤销图纸修改', question: '撤销这个图纸版本并创建恢复版本？',
            options: [{ label: '撤销此提交' }, { label: '取消' }],
          }],
        });
        const selected = answer.answers.find(({ id }) => id === questionId);
        if (selected?.selected.length !== 1 || selected.selected[0] !== '撤销此提交' || selected.custom) {
          return { status: 'discarded', revision: input.expectedCurrentRef.revision } as JsonValue;
        }
        const result = semantic.undoAuthorized(sessionId, input);
        return {
          status: result.status,
          ...('resultingRef' in result ? { revision: result.resultingRef.revision } : {}),
        } as JsonValue;
      })();
      pending.set(key, decision);
      try { return await decision; } finally {
        if (pending.get(key) === decision) pending.delete(key);
      }
    },
  });
}

function requireSession(id: unknown): string {
  if (id === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
  return String(id);
}

function workflow(state: string, nextTools: string[]) {
  return { state, nextTools };
}

async function recover(nextTools: string[], operation: () => JsonValue | Promise<JsonValue>): Promise<JsonValue> {
  try { return await operation(); } catch (error) {
    const code = error instanceof Error ? error.message : 'EDIT_INVALID_STATE';
    const correction = error && typeof error === 'object' && 'correction' in error
      ? (error as { correction?: JsonValue }).correction
      : undefined;
    const message = code === 'EDIT_ARTICULATED_COMPANION_PART_INVALID'
      ? 'The articulated moving part includes separate non-articulated companion parts. Call drawing_apply_selection_correction to remove them without rewriting candidate ids, then inspect and confirm the corrected highlight.'
      : code === 'EDIT_ARTICULATED_SELECTION_FRAGMENTED'
        ? 'The articulated selection was split into primitive-sized parts. Call drawing_apply_selection_correction to regroup it without rewriting candidate ids, then inspect and confirm the corrected highlight.'
      : code === 'EDIT_ARTICULATED_SELECTION_INVALID'
        ? 'The articulated selection contains unrelated geometry. Call drawing_apply_selection_correction to remove it without rewriting candidate ids, then inspect and confirm the corrected highlight.'
      : code === 'EDIT_SELECTED_PART_UNUSED'
        ? 'One or more selected parts are not used by any goal or spatial reference. Call drawing_apply_selection_correction to remove them, then inspect and confirm the corrected highlight.'
        : undefined;
    return {
      ...(message ? { message } : {}),
      ...(correction ? { correction } : {}),
      drawingWorkflow: { state: 'invalid_state', code, nextTools },
    } as JsonValue;
  }
}

function presentFinalize(result: ReturnType<SemanticEditService['finalizeCurrentPreview']>): JsonValue {
  if (result.status === 'committed') return {
    status: 'committed', mode: result.mode, revision: result.ref.revision,
    drawingWorkflow: workflow('committed', []),
  } as JsonValue;
  if (result.status === 'already-satisfied') return {
    status: 'already-satisfied', revision: result.ref.revision,
    drawingWorkflow: workflow('committed', []),
  } as JsonValue;
  if (result.status === 'rejected' && 'disposition' in result) return {
    status: 'rejected', disposition: result.disposition, code: result.code, message: result.message,
    drawingWorkflow: workflow(result.disposition === 'blocked' ? 'blocked' : 'confirmation_required',
      result.disposition === 'blocked'
        ? ['drawing_revise_spatial_intent', 'drawing_discard_preview']
        : ['drawing_finalize_preview', 'drawing_discard_preview']),
  } as JsonValue;
  return {
    status: result.status,
    ...('message' in result ? { message: result.message } : {}),
    drawingWorkflow: workflow('invalid_state', ['drawing_get_operation', 'drawing_observe']),
  } as JsonValue;
}

function presentDiscard(result: ReturnType<SemanticEditService['discardCurrentPreview']>): JsonValue {
  return {
    status: result.status,
    ...('ref' in result ? { revision: result.ref.revision } : {}),
    drawingWorkflow: workflow('discarded', ['drawing_observe']),
  } as JsonValue;
}

function renderJson(_args: unknown, value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) }];
}

function renderObservation(_args: unknown, value: unknown) {
  const content: Array<{ type: 'text'; text: string } | { type: 'image'; attachment: ImageAttachmentRef }> = [
    { type: 'text', text: JSON.stringify(value) },
  ];
  if (value && typeof value === 'object' && 'imageAttachment' in value) {
    const attachment = (value as { imageAttachment?: unknown }).imageAttachment;
    if (attachment && typeof attachment === 'object' && 'attachmentId' in attachment) {
      content.push({ type: 'image', attachment: attachment as ImageAttachmentRef });
    }
  }
  return content;
}
