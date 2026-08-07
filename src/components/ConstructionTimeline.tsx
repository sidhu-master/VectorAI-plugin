/**
 * ConstructionTimeline - 空间智能工作流进度面板
 *
 * 显示 TaskPlan 的分阶段执行进度：
 * ✓ 已完成  ● 执行中  ○ 待执行  ✗ 失败
 */
import { Check, Circle, Loader2, Play, RotateCcw, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { StepResult, TaskStep } from '@/core/agent';

function stepIcon(status: string) {
  switch (status) {
    case 'completed': return <Check size={12} className="text-green-400" />;
    case 'executing': return <Loader2 size={12} className="animate-spin text-accent" />;
    case 'failed': return <X size={12} className="text-danger" />;
    default: return <Circle size={8} className="text-slate-600" />;
  }
}

function StepResultView({ result }: { result: StepResult }) {
  return (
    <div className="ml-5 border-l border-white/10 pl-2">
      {result.success ? (
        <p className="text-[10px] text-green-400">
          +{result.addedEntities} 实体
          {result.modifiedEntities > 0 && ` · 修改 ${result.modifiedEntities}`}
        </p>
      ) : (
        <p className="text-[10px] text-danger">
          失败: {result.errors[0]?.slice(0, 60) || '未知错误'}
        </p>
      )}
      {result.warnings.length > 0 && (
        <p className="text-[10px] text-amber-400">
          {result.warnings[0]?.slice(0, 60)}
        </p>
      )}
      {result.description && (
        <p className="text-[10px] text-slate-500">{result.description.slice(0, 60)}</p>
      )}
    </div>
  );
}

export default function ConstructionTimeline() {
  const taskPlan = useStore((s) => s.taskPlan);
  const currentStepIndex = useStore((s) => s.currentStepIndex);
  const stepResults = useStore((s) => s.stepResults);
  const agentStatus = useStore((s) => s.agentStatus);
  const executeNextStep = useStore((s) => s.executeNextStep);
  const resetAgent = useStore((s) => s.resetAgent);

  if (!taskPlan) return null;

  const isExecuting = agentStatus === 'executing' || agentStatus === 'planning';
  const isComplete = agentStatus === 'complete';
  const hasNext = currentStepIndex < taskPlan.steps.length;

  return (
    <div className="border-b border-accent/20 bg-base-800 p-2">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
          构建进度
        </span>
        <button
          className="text-slate-500 hover:text-danger"
          onClick={resetAgent}
          title="取消"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Task summary */}
      <p className="mb-2 text-[10px] text-slate-500">{taskPlan.summary.slice(0, 80)}</p>

      {/* Steps */}
      <div className="space-y-1.5">
        {taskPlan.steps.map((step: TaskStep, i: number) => {
          const result = stepResults[i];
          const isCurrent = i === currentStepIndex && !isComplete;
          const isPast = i < currentStepIndex || (result && result.success);

          return (
            <div key={step.id}>
              <div
                className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                  isCurrent ? 'bg-base-700' : ''
                }`}
              >
                <span className="flex w-3 justify-center">
                  {stepIcon(
                    result ? (result.success ? 'completed' : 'failed') :
                    isCurrent ? 'executing' : 'pending'
                  )}
                </span>
                <span
                  className={`text-[11px] ${
                    isPast ? 'text-slate-400' : isCurrent ? 'text-accent' : 'text-slate-600'
                  }`}
                >
                  {step.description}
                </span>
              </div>
              {result && <StepResultView result={result} />}
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {!isComplete && (
        <button
          className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-accent/30 bg-accent/10 py-1 text-[11px] text-accent hover:bg-accent/20 disabled:opacity-40"
          onClick={() => executeNextStep()}
          disabled={isExecuting || !hasNext}
        >
          {isExecuting ? (
            <>
              <Loader2 size={11} className="animate-spin" />
              执行中...
            </>
          ) : (
            <>
              <Play size={11} />
              执行下一步 ({currentStepIndex + 1}/{taskPlan.steps.length})
            </>
          )}
        </button>
      )}

      {isComplete && (
        <div className="mt-2 flex items-center gap-1 rounded bg-green-500/10 py-1 text-[11px] text-green-400">
          <Check size={11} className="ml-2" />
          构建完成
        </div>
      )}
    </div>
  );
}
