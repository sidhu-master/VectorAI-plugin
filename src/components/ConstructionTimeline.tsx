/** Agent Workflow 的阶段式、可审计任务卡。 */
import {
  AlertTriangle, Check, ChevronDown, Circle, Loader2, Pause, Play, RotateCcw, Square, X,
} from 'lucide-react';
import { useStore, type AgentUiStatus } from '@/hooks/useStore';
import {
  presentAgentTask,
  type PresentedAgentDetail,
  type PresentedAgentStage,
  type PresentedAgentTask,
} from './agent/task-presentation';
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
  onReset: () => void;
}

function StageIcon({ stage }: { stage: PresentedAgentStage }) {
  if (stage.status === 'completed') {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.07] text-slate-300"><Check size={11} /></span>;
  }
  if (stage.status === 'current') {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent"><Loader2 size={11} className="animate-spin" /></span>;
  }
  if (stage.status === 'failed') {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger/10 text-danger"><X size={11} /></span>;
  }
  return <span className="flex h-5 w-5 items-center justify-center text-slate-700"><Circle size={7} /></span>;
}

function detailTone(detail: PresentedAgentDetail): string {
  if (detail.tone === 'danger') return 'text-danger';
  if (detail.tone === 'warning') return 'text-amber-400';
  if (detail.tone === 'success') return 'text-emerald-400';
  return 'text-slate-400';
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
  onReset,
}: ConstructionTimelineViewProps) {
  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-base-800 shadow-lg shadow-black/10" aria-label="AI 任务进度">
      <div className="flex items-start justify-between gap-3 px-3.5 pb-3 pt-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {active && status !== 'paused' ? <Loader2 size={13} className="shrink-0 animate-spin text-accent" /> : <Check size={13} className="shrink-0 text-slate-500" />}
            <h2 className="truncate text-[13px] font-medium text-slate-100">{presentation.heading}</h2>
          </div>
          <p className="mt-1 pl-5 text-[11px] text-slate-500">{presentation.summary}</p>
        </div>
        <button type="button" className="rounded-md p-1 text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300" onClick={onReset} title="清除任务">
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="space-y-0.5 border-y border-white/[0.06] bg-black/10 px-3 py-2.5">
        {presentation.stages.map((stage) => (
          <div key={stage.id} className={`flex items-center gap-2.5 rounded-lg px-1 py-1.5 ${stage.status === 'current' ? 'bg-white/[0.035]' : ''}`}>
            <StageIcon stage={stage} />
            <span className={`text-[11px] ${
              stage.status === 'current' ? 'font-medium text-slate-100'
                : stage.status === 'failed' ? 'text-danger'
                  : stage.status === 'completed' ? 'text-slate-400' : 'text-slate-600'
            }`}>{stage.label}</span>
          </div>
        ))}
      </div>

      {lowConfidence && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/[0.06] px-2.5 py-2 text-[11px] leading-4 text-red-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
          发现低置信度图元，已在画布中标红，请重点检查。
        </div>
      )}

      {error && (
        <div className="mx-3 mt-3 rounded-lg border border-danger/20 bg-danger/[0.06] px-2.5 py-2 text-[11px] leading-4 text-red-300">
          任务执行未完成。可重试，详细原因已保存在本地审计记录中。
        </div>
      )}

      {presentation.details.length > 0 && (
        <details className="group px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] text-slate-500 transition hover:text-slate-300">
            <span>执行详情</span>
            <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 max-h-36 space-y-2 overflow-y-auto border-l border-white/[0.08] pl-2.5">
            {presentation.details.map((detail) => (
              <div key={detail.id} className="flex items-baseline justify-between gap-3 text-[10px]">
                <span className={detailTone(detail)}>{detail.title}</span>
                <span className="shrink-0 font-mono text-slate-600">
                  {detail.duration ?? detail.elapsed}
                </span>
              </div>
            ))}
          </div>
        </details>
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

export default function ConstructionTimeline() {
  const taskPlan = useStore((state) => state.taskPlan);
  const currentStepIndex = useStore((state) => state.currentStepIndex);
  const agentRunId = useStore((state) => state.agentRunId);
  const agentEvents = useStore((state) => state.agentEvents);
  const agentStatus = useStore((state) => state.agentStatus);
  const agentError = useStore((state) => state.agentError);
  const document = useStore((state) => state.document);
  const commits = useStore((state) => state.commits);
  const pauseAgent = useStore((state) => state.pauseAgent);
  const resumeAgent = useStore((state) => state.resumeAgent);
  const stopAgent = useStore((state) => state.stopAgent);
  const resetAgent = useStore((state) => state.resetAgent);

  if (!agentRunId && !taskPlan) return null;

  const active = !['stopped', 'complete', 'error'].includes(agentStatus);
  const canPause = agentStatus === 'planning' || agentStatus === 'running';
  const canResume = agentStatus === 'paused';
  const runCommits = commitsForAgentRun(commits, agentRunId);
  const lastCommit = runCommits.at(-1);
  const lowConfidence = (lastCommit?.confidence !== undefined && lastCommit.confidence < 0.6)
    || Boolean(document && [...document.geometry, ...document.annotations]
      .some((node) => node.quality.status === 'candidate'));
  const presentation = presentAgentTask({
    plan: taskPlan,
    status: agentStatus,
    currentStepIndex,
    events: agentEvents,
    commitCount: runCommits.length,
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
      onReset={resetAgent}
    />
  );
}
