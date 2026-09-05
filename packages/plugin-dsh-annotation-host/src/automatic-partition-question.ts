// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';

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
