/**
 * PartitionStageBar - 分区标注流程的阶段状态卡：
 * - awaiting-supplement：引导补充分区信息（可附文档），或直接开始分区；
 * - partitioned：分区预览编辑（重命名）+「确认分区并自动标注」。
 */
import { useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import {
  partitionPaletteColor,
  readDrawingPartitions,
  type DrawingPartition,
} from '@/contracts/drawing-partition';

export type PartitionStage = 'idle' | 'awaiting-supplement' | 'partitioned';

export default function PartitionStageBar({
  stage,
  agentActive,
}: {
  stage: PartitionStage;
  agentActive: boolean;
}) {
  const document = useStore((s) => s.document);
  const updateNode = useStore((s) => s.updateNode);
  const startAgent = useStore((s) => s.startAgent);
  const confirmPartitionAnnotations = useStore((s) => s.confirmPartitionAnnotations);
  const supplementDocs = useStore((s) => s.partitionSupplementDocs);
  const [busy, setBusy] = useState(false);

  if (stage === 'idle' || !document) return null;

  if (stage === 'awaiting-supplement') {
    return (
      <div className="mb-2 rounded-xl border border-accent/20 bg-accent/[0.05] p-2.5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/[0.12] text-accent">
            <Layers size={12} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-4 text-slate-300">
              图纸已就绪。请发送<b className="text-slate-200">分区补充信息</b>
              （台阶说明、区域用途等，可上传 TXT/PDF/图片文档），AI 将结合补充信息按台阶特征分区。
            </p>
            {supplementDocs.length > 0 && (
              <p className="mt-1 text-[9px] leading-3.5 text-slate-500">
                已附带补充文档：{supplementDocs.map((doc) => doc.name).join('、')}（分区与重新分区时自动携带）
              </p>
            )}
            <button
              className="mt-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={agentActive || busy}
              onClick={() => {
                setBusy(true);
                void startAgent('按图纸中的台阶特征对图纸分区', undefined, undefined, 'partition')
                  .finally(() => setBusy(false));
              }}
            >
              {supplementDocs.length > 0
                ? `直接开始分区（自动附带 ${supplementDocs.length} 份文档）`
                : '直接开始分区（无补充信息）'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const partitions = readDrawingPartitions(document);

  const updatePartition = (partition: DrawingPartition, patch: Record<string, unknown>) => {
    const feature = document.features.find((node) => node.id === partition.id);
    if (!feature) return;
    void updateNode(partition.id, {
      properties: { ...feature.properties, ...patch },
    });
  };

  return (
    <div className="mb-2 rounded-xl border border-white/[0.08] bg-base-800/80 p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.05] text-slate-400">
            <Layers size={11} />
          </span>
          <span className="text-[11px] font-medium text-slate-300">
            分区预览（{partitions.length} 个）
          </span>
        </div>
        <button
          className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[10px] font-medium text-base-900 transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-40"
          disabled={agentActive || busy}
          onClick={() => {
            setBusy(true);
            void confirmPartitionAnnotations().finally(() => setBusy(false));
          }}
          title="按当前分区生成自动标注：分区边界尺寸 + 重点分区特征标注"
        >
          <Check size={11} />
          确认分区并自动标注
        </button>
      </div>
      <p className="mt-1 text-[9px] leading-3.5 text-slate-600">
        画布中可拖动分区顶点调整边界；下方可重命名分区；回复修改意见可让 AI 重新分区。
      </p>
      <div className="mt-2 space-y-1">
        {partitions.map((partition) => (
          <div
            key={partition.id}
            className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: partitionPaletteColor(partition.colorIndex) }}
            />
            <input
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-slate-200 outline-none transition hover:border-white/[0.08] focus:border-accent/40 focus:bg-black/20"
              defaultValue={partition.name}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== partition.name) {
                  updatePartition(partition, { name });
                } else {
                  event.target.value = partition.name;
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  event.currentTarget.value = partition.name;
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
