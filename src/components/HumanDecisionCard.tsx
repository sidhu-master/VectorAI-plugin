import { useState } from 'react';
import { Check, Loader2, ShieldAlert } from 'lucide-react';

import type { HumanDecisionRequest } from '@/contracts/drawing-agent';

export default function HumanDecisionCard({
  request,
  submitting,
  onRespond,
}: {
  request: HumanDecisionRequest;
  submitting: boolean;
  onRespond: (optionId: string, additionalInstruction?: string) => void;
}) {
  const [instruction, setInstruction] = useState('');
  return (
    <section
      className="mb-2 rounded-xl border border-amber-300/15 bg-amber-200/[0.035] p-3 shadow-lg shadow-black/10"
      aria-label="需要用户决定"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
          <ShieldAlert size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] font-medium leading-5 text-slate-100">{request.question}</h3>
          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">{request.reason}</p>
        </div>
      </div>

      {request.affectedResources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {request.affectedResources.slice(0, 6).map((resource, index) => (
            <span
              key={`${resource.plane ?? 'external'}:${index}`}
              className="rounded-md border border-white/[0.06] bg-black/15 px-1.5 py-1 font-mono text-[8px] text-slate-500"
            >
              {[resource.plane, resource.action, ...(resource.ids ?? []).slice(0, 2)]
                .filter(Boolean).join(' · ')}
            </span>
          ))}
        </div>
      )}

      <textarea
        className="mt-2 block w-full resize-none rounded-lg border border-white/[0.07] bg-black/15 px-2 py-1.5 text-[10px] leading-4 text-slate-300 outline-none placeholder:text-slate-700 focus:border-amber-300/25"
        rows={2}
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="补充说明（可选）"
        disabled={submitting}
      />

      <div className="mt-2 grid gap-1.5">
        {request.options.map((option) => {
          const recommended = option.id === request.recommendedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              className={`flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-wait disabled:opacity-50 ${
                recommended
                  ? 'border-amber-300/20 bg-amber-300/[0.06] text-slate-200 hover:bg-amber-300/[0.1]'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
              }`}
              disabled={submitting}
              onClick={() => onRespond(option.id, instruction.trim() || undefined)}
            >
              {submitting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              <span className="min-w-0 flex-1">
                <span className="block text-[10px]">{option.label}</span>
                {option.description && (
                  <span className="block truncate text-[8px] text-slate-600">{option.description}</span>
                )}
              </span>
              {recommended && <span className="text-[8px] text-amber-300/80">推荐</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
