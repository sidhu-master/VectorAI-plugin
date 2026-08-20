import type { AgentUiStatus } from '@/hooks/useStore';
import type { AgentProgressEvent } from '@/services/agent-client';

export interface PresentedAgentTask {
  heading: string;
  detail: string | null;
  elapsed: string;
  attemptLabel: string | null;
  tone: 'active' | 'paused' | 'success' | 'danger' | 'neutral';
}

interface PresentAgentTaskInput {
  status: AgentUiStatus;
  error: string | null;
  events: AgentProgressEvent[];
  nowMs: number;
}

const GENERIC_EVENT_TYPES = new Set<AgentProgressEvent['type']>([
  'model_started',
  'model_finished',
  'heartbeat',
]);

const STATUS_HEADINGS: Record<AgentUiStatus, string> = {
  idle: '任务待命',
  planning: '正在准备任务',
  running: '正在执行任务',
  waiting_for_user: '等待你的确认',
  pause_requested: '正在安全暂停',
  paused: '任务已暂停',
  stopping: '正在停止任务',
  stopped: '任务已停止',
  complete: '任务已完成',
  error: '任务执行失败',
};

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function isActive(status: AgentUiStatus): boolean {
  return status === 'planning' || status === 'running'
    || status === 'pause_requested' || status === 'stopping';
}

function isTerminal(status: AgentUiStatus): boolean {
  return status === 'complete' || status === 'error' || status === 'stopped';
}

function terminalEventMatches(status: AgentUiStatus, event: AgentProgressEvent): boolean {
  if (status === 'error') return event.type === 'failed';
  if (status === 'complete') return event.type === 'completed';
  if (status === 'stopped') return event.type === 'stopped';
  if (status === 'paused') return event.type === 'paused';
  return true;
}

function presentationTone(
  status: AgentUiStatus,
  event?: AgentProgressEvent,
): PresentedAgentTask['tone'] {
  if (status === 'error') return 'danger';
  if (status === 'complete') return 'success';
  if (event?.type === 'protocol_recovered') return 'success';
  if (status === 'paused') return 'paused';
  if (status === 'waiting_for_user') return 'paused';
  if (status === 'stopped' || status === 'idle') return 'neutral';
  return 'active';
}

export function presentAgentTask(input: PresentAgentTaskInput): PresentedAgentTask {
  const latestEvent = input.events.at(-1);
  const latestMeaningful = [...input.events].reverse().find((event) => (
    !GENERIC_EVENT_TYPES.has(event.type)
  )) ?? latestEvent;
  const displayedEvent = latestMeaningful && terminalEventMatches(input.status, latestMeaningful)
    ? latestMeaningful
    : undefined;
  const attemptEvent = isTerminal(input.status)
    ? undefined
    : [...input.events].reverse().find((event) => (
      event.candidateAttempt !== undefined && event.maxCandidateAttempts !== undefined
    ));
  const startedAt = input.events.length > 0
    ? input.events[0].timestamp - input.events[0].elapsedMs
    : input.nowMs;
  const elapsedMs = isActive(input.status)
    ? Math.max(latestEvent?.elapsedMs ?? 0, input.nowMs - startedAt)
    : latestEvent?.elapsedMs ?? 0;
  const heading = displayedEvent?.title.trim() || STATUS_HEADINGS[input.status];
  const detail = input.status === 'error'
    ? input.error?.trim() || displayedEvent?.detail?.trim() || null
    : displayedEvent?.detail?.trim() || null;

  return {
    heading,
    detail,
    elapsed: formatElapsed(elapsedMs),
    attemptLabel: attemptEvent
      ? `第 ${attemptEvent.candidateAttempt}/${attemptEvent.maxCandidateAttempts} 次尝试`
      : null,
    tone: presentationTone(input.status, displayedEvent),
  };
}
