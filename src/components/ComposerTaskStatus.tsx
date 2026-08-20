import { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, Loader2, Pause, Square, X,
} from 'lucide-react';

import { useStore, type AgentUiStatus } from '@/hooks/useStore';
import { presentAgentTask, type PresentedAgentTask } from './agent/task-presentation';
import { commitsForAgentRun } from './agent/run-commits';

function StatusIcon({ presentation, status }: {
  presentation: PresentedAgentTask;
  status: AgentUiStatus;
}) {
  if (presentation.tone === 'danger') return <AlertTriangle size={13} className="text-danger" />;
  if (presentation.tone === 'success') return <Check size={13} className="text-emerald-400" />;
  if (status === 'paused' || status === 'waiting_for_user') {
    return <Pause size={12} className="text-amber-400" />;
  }
  if (status === 'stopped') return <Square size={10} className="text-slate-500" />;
  return <Loader2 size={13} className="animate-spin text-accent" />;
}

function isActive(status: AgentUiStatus): boolean {
  return status === 'planning' || status === 'running' || status === 'pause_requested'
    || status === 'waiting_for_user' || status === 'paused' || status === 'stopping';
}

export function ComposerTaskStatusView({
  presentation,
  status,
  lowConfidence,
  onStop,
  onReset,
}: {
  presentation: PresentedAgentTask;
  status: AgentUiStatus;
  lowConfidence: boolean;
  onStop: () => void;
  onReset: () => void;
}) {
  const active = isActive(status);
  return (
    <section
      className="mb-2 px-1"
      aria-label="当前任务状态"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex min-w-0 items-center gap-2 text-[10px]">
        <StatusIcon presentation={presentation} status={status} />
        <span className={`min-w-0 flex-1 truncate ${
          presentation.tone === 'danger' ? 'text-red-300' : 'text-slate-300'
        }`}>
          {presentation.heading}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-slate-600">
          {presentation.elapsed}
        </span>
        {active ? (
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] text-slate-600 transition hover:bg-danger/[0.06] hover:text-red-300"
            onClick={onStop}
            title="停止任务"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-700 transition hover:bg-white/[0.04] hover:text-slate-400"
            onClick={onReset}
            title="清除任务状态"
          >
            <X size={11} />
          </button>
        )}
      </div>
      {(presentation.detail || presentation.attemptLabel) && (
        <div className={`mt-1 truncate pl-5 text-[9px] ${
          presentation.tone === 'danger' ? 'text-red-400/80' : 'text-slate-600'
        }`}>
          {[presentation.detail, presentation.attemptLabel].filter(Boolean).join(' · ')}
        </div>
      )}
      {lowConfidence && (
        <div className="mt-1 flex items-center gap-1.5 pl-5 text-[9px] text-red-400/90">
          <AlertTriangle size={10} />
          低置信度图元已标红，请检查
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

export default function ComposerTaskStatus() {
  const taskPlan = useStore((state) => state.taskPlan);
  const agentRunId = useStore((state) => state.agentRunId);
  const agentEvents = useStore((state) => state.agentEvents);
  const agentStatus = useStore((state) => state.agentStatus);
  const agentError = useStore((state) => state.agentError);
  const document = useStore((state) => state.document);
  const commits = useStore((state) => state.commits);
  const stopAgent = useStore((state) => state.stopAgent);
  const resetAgent = useStore((state) => state.resetAgent);
  const liveElapsed = ['planning', 'running', 'pause_requested', 'stopping']
    .includes(agentStatus);
  const nowMs = useLiveNow(liveElapsed);

  if (!agentRunId && !taskPlan) return null;

  const lastCommit = commitsForAgentRun(commits, agentRunId).at(-1);
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
    <ComposerTaskStatusView
      presentation={presentation}
      status={agentStatus}
      lowConfidence={lowConfidence}
      onStop={() => void stopAgent()}
      onReset={resetAgent}
    />
  );
}
