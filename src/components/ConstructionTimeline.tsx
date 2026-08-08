/** Agent Workflow 的结构化、可审计进度面板。 */
import { useState } from 'react';
import {
  AlertTriangle, Check, Circle, Loader2, Pause, Play, RotateCcw, Send, Square, X,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { TaskStep } from '@/core/agent';
import type { AgentProgressEvent } from '@/services/agent-client';

function formatEventDetail(event: AgentProgressEvent): string | undefined {
  if (!event.detail) return undefined;
  if (typeof event.detail === 'string') return event.detail.slice(0, 120);
  const duration = event.detail.durationMs === undefined
    ? undefined
    : event.detail.durationMs < 1_000
      ? `${event.detail.durationMs}ms`
      : `${(event.detail.durationMs / 1_000).toFixed(1)}s`;
  return [
    event.detail.role,
    event.detail.model,
    `#${event.detail.attempt}`,
    duration,
    event.detail.status,
  ].filter(Boolean).join(' · ');
}

function stepIcon(status: string) {
  switch (status) {
    case 'completed': return <Check size={12} className="text-green-400" />;
    case 'executing': return <Loader2 size={12} className="animate-spin text-accent" />;
    case 'failed': return <X size={12} className="text-danger" />;
    default: return <Circle size={8} className="text-slate-600" />;
  }
}

function eventTone(type: AgentProgressEvent['type']): string {
  if (type === 'failed' || type === 'validation') return 'text-danger';
  if (type === 'completed' || type === 'commit') return 'text-green-400';
  if (type === 'paused' || type === 'heartbeat') return 'text-amber-400';
  return 'text-slate-400';
}

export default function ConstructionTimeline() {
  const taskPlan = useStore((state) => state.taskPlan);
  const currentStepIndex = useStore((state) => state.currentStepIndex);
  const agentRunId = useStore((state) => state.agentRunId);
  const agentEvents = useStore((state) => state.agentEvents);
  const agentStatus = useStore((state) => state.agentStatus);
  const agentError = useStore((state) => state.agentError);
  const history = useStore((state) => state.history);
  const pauseAgent = useStore((state) => state.pauseAgent);
  const resumeAgent = useStore((state) => state.resumeAgent);
  const stopAgent = useStore((state) => state.stopAgent);
  const addAgentInstruction = useStore((state) => state.addAgentInstruction);
  const resetAgent = useStore((state) => state.resetAgent);
  const [instruction, setInstruction] = useState('');

  if (!agentRunId && !taskPlan) return null;

  const active = !['stopped', 'complete', 'error'].includes(agentStatus);
  const canPause = agentStatus === 'planning' || agentStatus === 'running';
  const canResume = agentStatus === 'paused';
  const lastCommit = history.commits.at(-1);
  const lowConfidence = lastCommit?.runId === agentRunId
    && lastCommit.source === 'AI'
    && lastCommit.confidence !== undefined
    && lastCommit.confidence < 0.6;
  const visibleEvents = agentEvents.slice(-8);

  const submitInstruction = () => {
    const value = instruction.trim();
    if (!value) return;
    setInstruction('');
    void addAgentInstruction(value);
  };

  return (
    <div className="border-b border-accent/20 bg-base-800 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
            Agent 执行记录
          </span>
          <span className="ml-2 text-[10px] text-slate-500">{agentStatus}</span>
        </div>
        <button className="text-slate-500 hover:text-danger" onClick={resetAgent} title="清除任务">
          <RotateCcw size={12} />
        </button>
      </div>

      {taskPlan ? (
        <>
          <p className="mb-2 text-[10px] text-slate-500">{taskPlan.summary.slice(0, 80)}</p>
          <div className="space-y-1">
            {taskPlan.steps.map((step: TaskStep, index: number) => {
              const isPast = index < currentStepIndex;
              const isCurrent = index === currentStepIndex && active;
              return (
                <div key={step.id} className={`flex items-center gap-2 rounded px-1 py-0.5 ${isCurrent ? 'bg-base-700' : ''}`}>
                  <span className="flex w-3 justify-center">
                    {stepIcon(isPast ? 'completed' : isCurrent ? 'executing' : 'pending')}
                  </span>
                  <span className={`text-[11px] ${isPast ? 'text-slate-400' : isCurrent ? 'text-accent' : 'text-slate-600'}`}>
                    {step.description}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 py-1 text-[11px] text-accent">
          <Loader2 size={11} className="animate-spin" /> 正在生成执行计划
        </div>
      )}

      {lowConfidence && (
        <div className="mt-2 flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[10px] text-danger">
          <AlertTriangle size={11} /> 本次增量修改置信度较低，请重点检查红色提示
        </div>
      )}

      {visibleEvents.length > 0 && (
        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto border-l border-white/10 pl-2">
          {visibleEvents.map((event) => (
            <div key={event.id} className="text-[10px]">
              <span className={eventTone(event.type)}>{event.title}</span>
              <span className="ml-1 text-slate-600">{Math.round(event.elapsedMs / 1000)}s</span>
              {event.detail && (
                <p className={`break-words ${typeof event.detail === 'string'
                  ? event.type === 'failed' || event.type === 'validation' ? 'text-danger/80' : 'text-slate-500'
                  : 'font-mono text-slate-500'}`}>
                  {formatEventDetail(event)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {agentError && <p className="mt-2 text-[10px] text-danger">{agentError}</p>}

      {active && (
        <>
          <div className="mt-2 flex gap-1">
            <button
              className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 py-1 text-[10px] text-slate-300 disabled:opacity-30"
              onClick={() => void (canResume ? resumeAgent() : pauseAgent())}
              disabled={!canPause && !canResume}
            >
              {canResume ? <Play size={10} /> : <Pause size={10} />}
              {canResume ? '继续' : agentStatus === 'pause_requested' ? '等待暂停' : '暂停'}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1 rounded border border-danger/20 py-1 text-[10px] text-danger"
              onClick={() => void stopAgent()}
            >
              <Square size={9} /> 停止
            </button>
          </div>
          <div className="mt-2 flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-white/10 bg-base-900 px-2 py-1 text-[10px] text-slate-200 placeholder:text-slate-600"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitInstruction();
              }}
              placeholder="追加指令（在安全点生效）"
            />
            <button className="rounded bg-accent/10 px-2 text-accent disabled:opacity-30" onClick={submitInstruction} disabled={!instruction.trim()}>
              <Send size={11} />
            </button>
          </div>
        </>
      )}

      {agentStatus === 'complete' && (
        <div className="mt-2 flex items-center gap-1 rounded bg-green-500/10 py-1 text-[11px] text-green-400">
          <Check size={11} className="ml-2" /> 构建完成
        </div>
      )}
    </div>
  );
}
