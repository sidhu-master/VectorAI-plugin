// SPDX-License-Identifier: Apache-2.0

import type { SessionEvent } from '@deepseek-ai/dsh-session';

export const AUTO_ANNOTATION_CONFLICTING_TOOLS = [
  'drawing_observe',
  'drawing_query',
  'drawing_select_parts',
  'drawing_confirm_selection',
  'drawing_preview_spatial_intent',
  'drawing_revise_spatial_intent',
  'drawing_evaluate_preview',
  'drawing_finalize_preview',
  'drawing_discard_preview',
  'drawing_partition_start',
  'drawing_partition_status',
  'drawing_dimension_chain_start',
  'drawing_gdt_start',
  'drawing_opening_angle_annotate',
  'drawing_diameter_annotate',
] as const;

export function isGenericAutoAnnotationEvent(event: SessionEvent): boolean {
  if (event.type !== 'user/message' || event.data.source.kind !== 'user') return false;
  return isGenericAutoAnnotationText(event.data.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(({ text }) => text)
    .join('\n'));
}

export function isGenericAutoAnnotationText(text: string): boolean {
  const objective = text
    .trim()
    .replace(/[\s，。！？,.!?、]/gu, '');
  if (!objective) return false;
  return /^(请|帮我|给我|麻烦)?(进行|执行|做|生成|完成)?(全部|全套|完整)?(工程图|图纸)?(的)?自动标注(任务|流程)?$/u.test(objective)
    || /^(请|帮我|给我|麻烦)?(进行|执行|做|生成|完成)?(全部|全套|完整)(工程图|图纸)?标注(任务|流程)?$/u.test(objective);
}
