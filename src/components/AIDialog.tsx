/**
 * AIDialog - 右侧 AI 对话面板
 * 支持文字输入 + 图片上传/粘贴（先预览，发送时才分析）
 */
import { useEffect, useRef, useState } from 'react';
import {
  Loader2, Paperclip, Pause, Play, RotateCcw, Send, Sparkles, X,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { ChatMessage } from '@/hooks/useStore';
import ComposerTaskStatus from './ComposerTaskStatus';
import { composerPrimaryAction } from './agent/composer-primary-action';

interface PendingImage {
  base64: string;
  mimeType: string;
  dataUrl: string;
  name: string;
}

function confidenceColor(c?: number) {
  if (c === undefined) return 'text-slate-500';
  if (c > 0.8) return 'text-green-400';
  if (c > 0.6) return 'text-amber-400';
  return 'text-danger';
}

function Message({ msg }: { msg: ChatMessage }) {
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
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>

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
  const agentStatus = useStore((s) => s.agentStatus);
  const agentRunId = useStore((s) => s.agentRunId);
  const agentEvents = useStore((s) => s.agentEvents);
  const pauseAgent = useStore((s) => s.pauseAgent);
  const resumeAgent = useStore((s) => s.resumeAgent);
  const retryAgent = useStore((s) => s.retryAgent);

  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [aiMessages, agentEvents]);

  const agentActive = !!agentRunId && !['stopped', 'complete', 'error'].includes(agentStatus);
  const starting = agentStatus === 'planning' && !agentRunId;
  const hasContent = Boolean(input.trim() || pendingImage);
  const primaryAction = composerPrimaryAction({
    status: agentStatus,
    hasRun: Boolean(agentRunId),
    hasContent,
  });

  const handleSend = () => {
    const text = input.trim();

    if ((!text && !pendingImage) || starting) return;
    void submitAgentInput(text || undefined, pendingImage?.base64, pendingImage?.mimeType);
    setPendingImage(null);
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

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setPendingImage({ base64, mimeType: file.type, dataUrl, name: file.name || 'image' });
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 已有待发图片时不覆盖
    if (pendingImage) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          loadFile(file);
          break;
        }
      }
    }
  };

  const placeholder = pendingImage
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
        {aiMessages.length === 0 && !pendingImage && (
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

        {/* 图片预览 */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-base-800 p-2">
            {pendingImage.mimeType === 'application/pdf' ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.04] font-mono text-[9px] text-slate-400">
                PDF
              </div>
            ) : (
              <img
                src={pendingImage.dataUrl}
                alt="preview"
                className="h-11 w-11 rounded-md object-cover"
              />
            )}
            <div className="flex-1 truncate">
              <p className="text-[10px] text-slate-300">{pendingImage.name}</p>
              <p className="text-[9px] text-slate-600">等待发送</p>
            </div>
            <button
              className="rounded-md p-1 text-slate-600 transition hover:bg-danger/[0.06] hover:text-danger"
              onClick={() => setPendingImage(null)}
              title="移除图片"
            >
              <X size={14} />
            </button>
          </div>
        )}

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
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="mt-1 flex items-center justify-between">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || agentActive || !!pendingImage}
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
                      : pendingImage ? '发送并分析图片' : '发送'}
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
