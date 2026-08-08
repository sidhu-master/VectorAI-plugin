import type { TaskPlan } from '@/core/agent';
import type { AgentUiStatus } from '@/hooks/useStore';
import type { AgentProgressEvent } from '@/services/agent-client';

export type AgentStageId = 'understand' | 'perceive' | 'build' | 'modify' | 'verify';
export type AgentStageStatus = 'pending' | 'current' | 'completed' | 'failed';

export interface PresentedAgentStage {
  id: AgentStageId;
  label: string;
  status: AgentStageStatus;
}

export interface PresentedAgentDetail {
  id: string;
  title: string;
  elapsed: string;
  duration?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

export interface PresentedAgentTask {
  heading: string;
  summary: string;
  elapsed: string;
  stages: PresentedAgentStage[];
  details: PresentedAgentDetail[];
}

interface PresentAgentTaskInput {
  plan: TaskPlan | null;
  status: AgentUiStatus;
  currentStepIndex: number;
  events: AgentProgressEvent[];
  commitCount: number;
}

const STAGES: Array<{ id: AgentStageId; label: string }> = [
  { id: 'understand', label: '理解需求' },
  { id: 'perceive', label: '解析图纸' },
  { id: 'build', label: '构建模型' },
  { id: 'modify', label: '应用修改' },
  { id: 'verify', label: '验证完成' },
];

const EVENT_TITLES: Record<AgentProgressEvent['type'], string> = {
  accepted: '任务已接收',
  planning: '正在整理执行步骤',
  model_started: '正在进行推理',
  model_finished: '推理完成',
  tool_started: '正在执行步骤',
  tool_finished: '步骤执行完成',
  validation: '正在验证结果',
  commit: '已保存增量修改',
  heartbeat: '仍在处理',
  paused: '任务已暂停',
  resumed: '任务已继续',
  stopped: '任务已停止',
  completed: '任务执行完成',
  failed: '任务执行失败',
};

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function currentStage(input: PresentAgentTaskInput): AgentStageId {
  if (input.status === 'planning' || !input.plan) return 'understand';
  const step = input.plan.steps[input.currentStepIndex];
  const action = step?.action.toLowerCase() ?? '';
  if (action.includes('verify') || action.includes('validate')) return 'verify';
  if (action.includes('modify') || input.plan.task.includes('modify')) return 'modify';
  if (input.plan.task.includes('inspect')) return 'perceive';
  if (input.plan.task.includes('reconstruct')) return input.commitCount > 0 ? 'build' : 'perceive';
  return 'build';
}

function headingFor(status: AgentUiStatus, stage: AgentStageId): string {
  if (status === 'complete') return '任务已完成';
  if (status === 'error') return '任务遇到问题';
  if (status === 'paused') return '任务已暂停';
  if (status === 'pause_requested') return '正在安全暂停';
  if (status === 'stopping') return '正在停止任务';
  if (status === 'stopped') return '任务已停止';
  const activeHeadings: Record<AgentStageId, string> = {
    understand: '正在理解你的需求',
    perceive: '正在解析图纸',
    build: '正在构建空间模型',
    modify: '正在应用修改',
    verify: '正在验证结果',
  };
  return activeHeadings[stage];
}

function detailTone(type: AgentProgressEvent['type']): PresentedAgentDetail['tone'] {
  if (type === 'failed') return 'danger';
  if (type === 'paused' || type === 'validation') return 'warning';
  if (type === 'completed' || type === 'commit') return 'success';
  return 'neutral';
}

function presentDetail(event: AgentProgressEvent): PresentedAgentDetail {
  const duration = typeof event.detail === 'object' && event.detail.durationMs !== undefined
    ? event.detail.durationMs < 1000
      ? `${event.detail.durationMs}ms`
      : `${(event.detail.durationMs / 1000).toFixed(1)}s`
    : undefined;
  return {
    id: event.id,
    title: EVENT_TITLES[event.type],
    elapsed: formatElapsed(event.elapsedMs),
    duration,
    tone: detailTone(event.type),
  };
}

export function presentAgentTask(input: PresentAgentTaskInput): PresentedAgentTask {
  const activeStage = currentStage(input);
  const activeIndex = STAGES.findIndex((stage) => stage.id === activeStage);
  const terminalComplete = input.status === 'complete';
  const failed = input.status === 'error';
  const elapsedMs = input.events.at(-1)?.elapsedMs ?? 0;
  const elapsed = formatElapsed(elapsedMs);
  const stages = STAGES.map((stage, index): PresentedAgentStage => ({
    ...stage,
    status: terminalComplete
      ? 'completed'
      : index < activeIndex
        ? 'completed'
        : index === activeIndex
          ? failed ? 'failed' : 'current'
          : 'pending',
  }));
  const summary = terminalComplete
    ? `已完成 ${input.commitCount} 次增量修改 · 用时 ${elapsed}`
    : input.commitCount > 0
      ? `已运行 ${elapsed} · 已保存 ${input.commitCount} 次修改`
      : `已运行 ${elapsed}`;

  return {
    heading: headingFor(input.status, activeStage),
    summary,
    elapsed,
    stages,
    details: input.events.slice(-10).map(presentDetail),
  };
}
