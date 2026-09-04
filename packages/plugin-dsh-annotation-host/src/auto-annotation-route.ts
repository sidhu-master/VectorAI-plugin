// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';

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

export function classifyPartitionDecisionEvent(event: SessionEvent): 'confirm' | 'skip' | null {
  if (event.type !== 'user/message' || event.data.source.kind !== 'user') return null;
  const text = event.data.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(({ text: value }) => value)
    .join('\n')
    .trim()
    .replace(/[\s，。！？,.!?、]/gu, '');
  if (/^(不使用|不用|跳过|取消|否|不要)(这个|该)?分区(继续)?$/u.test(text)) return 'skip';
  if (/^(确认|确定|可以|同意|好的|好|是|使用|采用)(这个|该)?分区(并)?(继续|开始)?(自动标注)?$/u.test(text)
    || /^(确认|确定|可以|同意|好的|好|继续)$/u.test(text)) return 'confirm';
  return null;
}

export function classifyPartitionQuestionResult(value: unknown): 'confirm' | 'skip' | null {
  if (typeof value !== 'object' || value === null || !('answers' in value) || !Array.isArray(value.answers)) return null;
  const answerText = value.answers
    .filter((candidate): candidate is { selected: string[]; custom?: string } => (
      typeof candidate === 'object' && candidate !== null
      && 'selected' in candidate && Array.isArray(candidate.selected)
      && candidate.selected.every((entry) => typeof entry === 'string')
      && (!('custom' in candidate) || candidate.custom === undefined || typeof candidate.custom === 'string')
    ))
    .flatMap((answer) => [...answer.selected, ...(answer.custom ? [answer.custom] : [])])
    .join(' ')
    .replace(/[\s，。！？,.!?、]/gu, '');
  if (!answerText) return null;
  if (/(不使用|不用|跳过|取消|不要)分区?/u.test(answerText)) return 'skip';
  if (/(确认|确定|同意|使用分区|采用分区|继续)/u.test(answerText)) return 'confirm';
  return null;
}

export async function requestAutomaticPartitionDecision(
  questions: Pick<UserQuestionService, 'ask'>,
  agent: Agent,
  signal: AbortSignal | undefined,
  segmentCount: number,
): Promise<'confirm' | 'skip'> {
  const answer = await questions.ask({
    agent,
    signal,
    questions: [{
      id: 'vectorai-automatic-partition-confirmation',
      header: '确认分区',
      question: `已生成智能分区预览（${segmentCount} 个轴段），是否采用该分区并继续自动标注？`,
      options: [
        { label: '使用分区（推荐）', description: '采用当前分区并继续完成尺寸链、基准及形位公差等标注。' },
        { label: '不使用分区', description: '仅继续不依赖分区的基础标注。' },
      ],
      multiSelect: false,
    }],
  });
  const decision = classifyPartitionQuestionResult(answer);
  if (decision === null) throw new Error('PARTITION_DECISION_UNRECOGNIZED');
  return decision;
}
