/** Agent Workflow 的实时状态卡：只显示当前真实动作，完整事件保留在审计记录。 */
import { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, Loader2, Pause, Play, RotateCcw, Square, X,
} from 'lucide-react';
import { useStore, type AgentUiStatus } from '@/hooks/useStore';
import { presentAgentTask, type PresentedAgentTask } from './agent/task-presentation';
import { commitsForAgentRun } from './agent/run-commits';

interface ConstructionTimelineViewProps {
  presentation: PresentedAgentTask;
  status: AgentUiStatus;
  active: boolean;
  canPause: boolean;
  canResume: boolean;
  lowConfidence: boolean;
  error: string | null;
  onPauseOrResume: () => void;
  onStop: () => void;
  onRetry: () => void;
  onReset: () => void;
}

function StatusIcon({ presentation, status }: {
  presentation: PresentedAgentTask;
  status: AgentUiStatus;
}) {
  if (presentation.tone === 'danger') return <AlertTriangle size={14} className="text-danger" />;
  if (presentation.tone === 'success') return <Check size={14} className="text-emerald-400" />;
  if (status === 'paused') return <Pause size={13} className="text-amber-400" />;
  if (status === 'stopped') return <Square size={11} className="text-slate-500" />;
  return <Loader2 size={14} className="animate-spin text-accent" />;
}

export function ConstructionTimelineView({
  presentation,
  status,
  active,
  canPause,
  canResume,
  lowConfidence,
  error,
  onPauseOrResume,
  onStop,
  onRetry,
  onReset,
}: ConstructionTimelineViewProps) {
  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-base-800 shadow-lg shadow-black/10" aria-label="AI 任务进度">
      <div className="flex items-start justify-between gap-3 px-3.5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon presentation={presentation} status={status} />
            <h2 className="truncate text-[13px] font-medium text-slate-100">
              {presentation.heading}
            </h2>
          </div>
          <div className="mt-1.5 flex items-center gap-2 pl-[22px] text-[10px] text-slate-500">
            <span>已运行 {presentation.elapsed}</span>
            {presentation.attemptLabel && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-slate-600" />
                <span>{presentation.attemptLabel}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
          onClick={onReset}
          title="清除任务"
        >
          <X size={13} />
        </button>
      </div>

      {presentation.detail && (
        <div className={`border-t px-3.5 py-2.5 text-[11px] leading-[17px] ${
          presentation.tone === 'danger'
            ? 'border-danger/15 bg-danger/[0.05] text-red-300'
            : 'border-white/[0.06] bg-black/10 text-slate-400'
        }`}>
          {presentation.detail}
        </div>
      )}

      {lowConfidence && (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/[0.06] px-2.5 py-2 text-[11px] leading-4 text-red-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
          发现低置信度图元，已在画布中标红，请重点检查。
        </div>
      )}

      {status === 'error' && error && (
        <div className="flex gap-2 border-t border-white/[0.06] p-3">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-[11px] font-medium text-white transition hover:bg-accent/90"
            onClick={onRetry}
          >
            <RotateCcw size={11} />
            重试
          </button>
        </div>
      )}

      {active && (
        <div className="flex gap-2 border-t border-white/[0.06] p-3">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] py-2 text-[11px] text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onPauseOrResume}
            disabled={!canPause && !canResume}
          >
            {canResume ? <Play size={11} /> : <Pause size={11} />}
            {canResume ? '继续' : status === 'pause_requested' ? '等待暂停' : '暂停'}
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-2 text-[11px] text-slate-400 transition hover:border-danger/30 hover:bg-danger/[0.05] hover:text-red-300"
            onClick={onStop}
          >
            <Square size={10} />
            停止
          </button>
        </div>
      )}
    </section>
  );
}

function useLiveNow(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return nowMs;
}

export default function ConstructionTimeline() {
  const taskPlan = useStore((state) => state.taskPlan);
  const agentRunId = useStore((state) => state.agentRunId);
  const agentEvents = useStore((state) => state.agentEvents);
  const agentStatus = useStore((state) => state.agentStatus);
  const agentError = useStore((state) => state.agentError);
  const document = useStore((state) => state.document);
  const commits = useStore((state) => state.commits);
  const pauseAgent = useStore((state) => state.pauseAgent);
  const resumeAgent = useStore((state) => state.resumeAgent);
  const stopAgent = useStore((state) => state.stopAgent);
  const retryAgent = useStore((state) => state.retryAgent);
  const resetAgent = useStore((state) => state.resetAgent);
  const active = !['stopped', 'complete', 'error'].includes(agentStatus);
  const liveElapsed = ['planning', 'running', 'pause_requested', 'stopping'].includes(agentStatus);
  const nowMs = useLiveNow(liveElapsed);

  if (!agentRunId && !taskPlan) return null;

  const canPause = agentStatus === 'planning' || agentStatus === 'running';
  const canResume = agentStatus === 'paused';
  const runCommits = commitsForAgentRun(commits, agentRunId);
  const lastCommit = runCommits.at(-1);
  const lowConfidence = (lastCommit?.confidence !== undefined && lastCommit.confidence < 0.6)
    || Boolean(document && [...document.geometry, ...document.annotations]
      .some((node) => node.quality.status === 'candidate'));
  const presentation = presentAgentTask({
    status: agentStatus,
    events: agentEvents,
    error: agentError,
    nowMs,
  });

  return (
    <ConstructionTimelineView
      presentation={presentation}
      status={agentStatus}
      active={active}
      canPause={canPause}
      canResume={canResume}
      lowConfidence={lowConfidence}
      error={agentError}
      onPauseOrResume={() => void (canResume ? resumeAgent() : pauseAgent())}
      onStop={() => void stopAgent()}
      onRetry={() => void retryAgent()}
      onReset={resetAgent}
    />
  );
}
