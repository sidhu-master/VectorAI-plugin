/**
 * AIDialog - 右侧 AI 对话面板
 * 支持文字输入 + 图片上传/粘贴（先预览，发送时才分析）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Paperclip, Pause, Play, RotateCcw, Send, Sparkles, X,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { ChatMessage } from '@/hooks/useStore';
import ComposerTaskStatus from './ComposerTaskStatus';
import HumanDecisionCard from './HumanDecisionCard';
import { composerPrimaryAction } from './agent/composer-primary-action';
import PartitionStageBar, { type PartitionStage } from './agent/partition-stage-bar';
import { readDrawingPartitions } from '@/contracts/drawing-partition';

interface PendingFile {
  base64: string;
  mimeType: string;
  dataUrl?: string;
  name: string;
  kind: 'image' | 'pdf' | 'dxf' | 'text';
  /** TXT 补充文档的文本内容（发送时拼入补充信息） */
  text?: string;
}

function readPendingFile(file: File): Promise<PendingFile> {
  const kind = pendingFileKind(file.name || 'drawing', file.type);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`无法读取 ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const name = file.name || 'drawing';
      const mimeType = file.type
        || (kind === 'dxf' ? 'application/dxf'
          : kind === 'text' ? 'text/plain'
            : kind === 'pdf' ? 'application/pdf' : 'image/png');
      resolve({
        base64: kind === 'text' ? '' : result.slice(result.indexOf(',') + 1),
        mimeType,
        name,
        kind,
        ...(kind === 'image' ? { dataUrl: result } : {}),
        ...(kind === 'text' ? { text: result } : {}),
      });
    };
    if (kind === 'text') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

function pendingFileKind(name: string, mimeType: string): PendingFile['kind'] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.dxf') || /dxf/i.test(mimeType)) return 'dxf';
  if (lower.endsWith('.txt') || mimeType === 'text/plain') return 'text';
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf';
  return 'image';
}

function fileLabel(name: string, mimeType: string): string {
  const kind = pendingFileKind(name, mimeType);
  if (kind === 'dxf') return 'DXF';
  if (kind === 'text') return 'TXT';
  if (kind === 'pdf') return 'PDF';
  return 'IMG';
}

function confidenceColor(c?: number) {
  if (c === undefined) return 'text-slate-500';
  if (c > 0.8) return 'text-green-400';
  if (c > 0.6) return 'text-amber-400';
  return 'text-danger';
}

export function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-xl px-3 py-2.5 text-[12px] leading-5 ${
          isUser
            ? 'bg-white/[0.075] text-slate-200'
            : 'border border-white/[0.06] bg-base-800/70 text-slate-300'
        }`}
      >
        {msg.files && msg.files.length > 0 && (
          <div className="space-y-1.5">
            {msg.files.map((file) => (
              <div
                key={`${file.name}:${file.mimeType}`}
                className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/10 px-2 py-1.5"
              >
                <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded bg-white/[0.045] font-mono text-[9px] text-slate-400">
                  {fileLabel(file.name, file.mimeType)}
                </span>
                <span className="min-w-0 truncate text-[10px] text-slate-300">{file.name}</span>
              </div>
            ))}
          </div>
        )}
        {msg.image && (
          msg.mimeType === 'application/pdf' ? (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-white/[0.08] bg-black/15 font-mono text-[10px] text-slate-400">
              PDF
            </div>
          ) : (
            <img
              src={`data:${msg.mimeType || 'image/png'};base64,${msg.image}`}
              alt="用户上传的图片"
              className="max-h-48 w-full rounded-lg object-contain"
            />
          )
        )}
        {msg.content && (
          <p className={`${msg.image || msg.files?.length ? 'mt-2' : ''} whitespace-pre-wrap break-words`}>
            {msg.content}
          </p>
        )}

        {!isUser && msg.confidence !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] text-slate-600">置信度</span>
            <span className={`font-mono text-[10px] ${confidenceColor(msg.confidence)}`}>
              {Math.round(msg.confidence * 100)}%
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded bg-white/[0.06]">
              <span
                className="block h-full rounded bg-current"
                style={{ width: `${Math.round(msg.confidence * 100)}%` }}
              />
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

export default function AIDialog() {
  const aiMessages = useStore((s) => s.aiMessages);
  const submitAgentInput = useStore((s) => s.submitAgentInput);
  const importDxf = useStore((s) => s.importDxf);
  const agentStatus = useStore((s) => s.agentStatus);
  const agentRunId = useStore((s) => s.agentRunId);
  const agentEvents = useStore((s) => s.agentEvents);
  const pauseAgent = useStore((s) => s.pauseAgent);
  const resumeAgent = useStore((s) => s.resumeAgent);
  const retryAgent = useStore((s) => s.retryAgent);
  const pendingDecision = useStore((s) => s.pendingAgentDecision);
  const decisionSubmitting = useStore((s) => s.decisionSubmitting);
  const respondToAgentDecision = useStore((s) => s.respondToAgentDecision);
  const document = useStore((s) => s.document);

  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [aiMessages, agentEvents]);

  const agentActive = !!agentRunId && !['stopped', 'complete', 'error'].includes(agentStatus);
  const starting = agentStatus === 'planning' && !agentRunId;
  const hasContent = Boolean(input.trim() || pendingFiles.length > 0);
  const primaryAction = composerPrimaryAction({
    status: agentStatus,
    hasRun: Boolean(agentRunId),
    hasContent,
  });

  const partitionStage: PartitionStage = useMemo(() => {
    const geometryCount = document?.geometry.length ?? 0;
    const partitionCount = document ? readDrawingPartitions(document).length : 0;
    const hasAutoAnnotations = !!document?.annotations.some(
      (node) => node.id.startsWith('annotation_auto_'),
    );
    if (geometryCount === 0 || hasAutoAnnotations) return 'idle';
    return partitionCount > 0 ? 'partitioned' : 'awaiting-supplement';
  }, [document]);

  const handleSend = () => {
    const text = input.trim();

    const dxf = pendingFiles.find((file) => file.kind === 'dxf');
    const companion = pendingFiles.find((file) => file.kind === 'text');
    const media = pendingFiles.find((file) => file.kind === 'image' || file.kind === 'pdf');
    if ((!text && !dxf && !media && companion === undefined && pendingFiles.length === 0)
      || starting) return;
    if (dxf) {
      void importDxf(
        { fileName: dxf.name, data: dxf.base64, mimeType: 'application/dxf' },
        companion
          ? { fileName: companion.name, data: companion.base64, mimeType: 'text/plain' }
          : undefined,
        text || undefined,
      );
    } else {
      const supplementDocs = pendingFiles.filter(
        (file) => file.kind === 'text' && file.text && file.text.trim(),
      );
      if (supplementDocs.length > 0) {
        // 记录分区补充文档：后续重新分区/修改意见时自动携带
        const existing = useStore.getState().partitionSupplementDocs;
        useStore.getState().setPartitionSupplementDocs([
          ...existing.filter((doc) => !supplementDocs.some((item) => item.name === doc.name)),
          ...supplementDocs.map((file) => ({ name: file.name, text: file.text ?? '' })),
        ]);
      }
      const goal = [
        text,
        ...supplementDocs.map((file) => (
          `[补充文档 ${file.name}]\n${(file.text ?? '').slice(0, 6000)}`
        )),
      ].filter(Boolean).join('\n\n');
      const displayText = [
        text,
        ...supplementDocs.map((file) => `（附文档 ${file.name}）`),
      ].filter(Boolean).join(' ');
      const partitionFlow = partitionStage === 'awaiting-supplement' || partitionStage === 'partitioned';
      void submitAgentInput(
        goal || undefined,
        media?.base64,
        media?.mimeType,
        partitionFlow ? 'partition' : undefined,
        displayText || undefined,
      );
    }
    setPendingFiles([]);
    setFileError(null);
    setInput('');
  };

  const handlePrimaryAction = () => {
    if (primaryAction === 'send') handleSend();
    if (primaryAction === 'pause') void pauseAgent();
    if (primaryAction === 'resume') void resumeAgent();
    if (primaryAction === 'retry') void retryAgent();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadFiles = async (files: File[]) => {
    const loaded = await Promise.all(files.map(readPendingFile));
    setPendingFiles((current) => {
      const incomingDxf = loaded.find((file) => file.kind === 'dxf');
      const existingDxf = current.find((file) => file.kind === 'dxf');
      const dxf = incomingDxf ?? existingDxf;
      if (dxf) {
        const companion = loaded.find((file) => file.kind === 'text')
          ?? current.find((file) => file.kind === 'text');
        setFileError(null);
        return [dxf, ...(companion ? [companion] : [])];
      }
      // 非 DXF 场景：一个图纸附件（图片/PDF）+ 多个 TXT 补充文档
      const media = loaded.find((file) => file.kind === 'image' || file.kind === 'pdf')
        ?? current.find((file) => file.kind === 'image' || file.kind === 'pdf');
      const texts = [
        ...current.filter((file) => file.kind === 'text'),
        ...loaded.filter((file) => file.kind === 'text'),
      ];
      if (media || texts.length > 0) {
        setFileError(null);
        return [...(media ? [media] : []), ...texts];
      }
      return current;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void loadFiles(files);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 已有待发图片时不覆盖
    if (pendingFiles.length > 0) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          void loadFiles([file]);
          break;
        }
      }
    }
  };

  const hasPendingDxf = pendingFiles.some((file) => file.kind === 'dxf');
  const attachmentFull = pendingFiles.some((file) => file.kind === 'image' || file.kind === 'pdf')
    || (hasPendingDxf && pendingFiles.some((file) => file.kind === 'text'));
  const placeholder = hasPendingDxf
    ? '可附带修改指令；DXF 将先完成确定性导入...'
    : partitionStage === 'awaiting-supplement'
      ? '补充分区信息（台阶说明、区域用途等，可附 TXT/PDF），发送后 AI 将分区...'
      : partitionStage === 'partitioned'
        ? '回复修改意见可调整分区；确认分区后将自动标注...'
        : pendingFiles.length > 0
          ? '输入分析指令（可选），按发送开始分析图片...'
          : agentActive
            ? '追加指令，将在安全点生效...'
            : '描述任务，AI 将自动分阶段构建...';

  return (
    <aside data-panel="assistant" className="flex w-[360px] shrink-0 flex-col border-l border-white/[0.07] bg-base-700 max-lg:w-[320px]">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/[0.08] text-accent">
          <Sparkles size={14} />
        </span>
        <div className="leading-tight">
          <span className="block text-[12px] font-medium text-slate-200">AI 助手</span>
          <span className="block text-[9px] text-slate-600">可暂停 · 可随时追加指令</span>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {aiMessages.length === 0 && pendingFiles.length === 0 && (
          <div className="flex h-full min-h-44 flex-col items-center justify-center px-7 text-center">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-slate-600">
              <Sparkles size={15} />
            </span>
            <p className="text-[11px] text-slate-400">从图纸或文字开始</p>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-600">上传工程图，或描述需要创建和修改的二维几何</p>
          </div>
        )}
        {aiMessages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-base-700 p-3">
        <ComposerTaskStatus />
        <PartitionStageBar stage={partitionStage} agentActive={agentActive} />
        {pendingDecision && (
          <HumanDecisionCard
            request={pendingDecision}
            submitting={decisionSubmitting}
            onRespond={(optionId, instruction) => {
              void respondToAgentDecision(optionId, instruction);
            }}
          />
        )}

        {pendingFiles.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {pendingFiles.map((file) => (
              <div key={`${file.kind}:${file.name}`} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-base-800 p-2">
                {file.kind === 'image' ? (
                  <img src={file.dataUrl} alt="preview" className="h-11 w-11 rounded-md object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.04] font-mono text-[9px] text-slate-400">
                    {fileLabel(file.name, file.mimeType)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] text-slate-300">{file.name}</p>
                  <p className="text-[9px] text-slate-600">
                    {file.kind === 'dxf' ? '确定性导入'
                      : file.kind === 'text' ? (hasPendingDxf ? '配套工程数据' : '分区补充文档')
                      : '等待发送'}
                  </p>
                </div>
                <button
                  className="rounded-md p-1 text-slate-600 transition hover:bg-danger/[0.06] hover:text-danger"
                  onClick={() => setPendingFiles((current) => current.filter((item) => item !== file))}
                  title={`移除 ${file.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {fileError && <p className="mb-2 px-1 text-[9px] text-danger">{fileError}</p>}

        <div className="rounded-xl border border-white/[0.09] bg-base-800 p-2 shadow-lg shadow-black/10 transition focus-within:border-accent/35">
          <textarea
            className="block w-full resize-none bg-transparent px-1.5 py-1 text-[12px] leading-5 text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
            rows={2}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={starting}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.dxf,application/dxf,.txt,text/plain"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="mt-1 flex items-center justify-between">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || agentActive || attachmentFull}
              title={agentActive ? '当前任务结束后可上传新图纸' : '上传图纸'}
            >
              <Paperclip size={14} />
            </button>
            <button
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-700 ${
                primaryAction === 'pause'
                  ? 'bg-white/[0.09] text-slate-200 hover:bg-white/[0.14]'
                  : 'bg-accent text-base-900 hover:bg-accent-light'
              }`}
              onClick={handlePrimaryAction}
              disabled={primaryAction === 'waiting' || primaryAction === 'disabled'}
              title={primaryAction === 'pause'
                ? '暂停任务'
                : primaryAction === 'resume'
                  ? '继续任务'
                  : primaryAction === 'retry'
                    ? '重试任务'
                    : primaryAction === 'waiting'
                      ? '等待当前操作完成'
                      : hasPendingDxf ? '导入 DXF' : pendingFiles.length > 0 ? '发送并分析图片' : '发送'}
            >
              {primaryAction === 'waiting' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : primaryAction === 'pause' ? (
                <Pause size={13} />
              ) : primaryAction === 'resume' ? (
                <Play size={13} />
              ) : primaryAction === 'retry' ? (
                <RotateCcw size={13} />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
