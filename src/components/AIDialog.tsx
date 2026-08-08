/**
 * AIDialog - 右侧 AI 对话面板
 * 支持文字输入 + 图片上传/粘贴（先预览，发送时才分析）
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { ChatMessage } from '@/hooks/useStore';
import ConstructionTimeline from './ConstructionTimeline';

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
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-base-600 text-slate-200'
            : 'border border-white/5 bg-base-800 text-slate-200'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>

        {!isUser && msg.confidence !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] text-slate-500">置信度</span>
            <span className={`font-mono text-[10px] ${confidenceColor(msg.confidence)}`}>
              {Math.round(msg.confidence * 100)}%
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded bg-base-600">
              <span
                className="block h-full rounded bg-current"
                style={{ width: `${Math.round(msg.confidence * 100)}%` }}
              />
            </span>
          </div>
        )}

        {!isUser && msg.intent && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">
              Spatial Intent JSON
            </summary>
            <pre className="mt-1 overflow-x-auto rounded bg-base-900 p-2 font-mono text-[10px] text-slate-400">
              {JSON.stringify(msg.intent, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function AIDialog() {
  const aiMessages = useStore((s) => s.aiMessages);
  const submitAgentInput = useStore((s) => s.submitAgentInput);
  const taskPlan = useStore((s) => s.taskPlan);
  const agentStatus = useStore((s) => s.agentStatus);
  const agentRunId = useStore((s) => s.agentRunId);
  const agentEvents = useStore((s) => s.agentEvents);
  const agentError = useStore((s) => s.agentError);

  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [aiMessages, agentEvents]);

  const agentActive = !!agentRunId && !['stopped', 'complete', 'error'].includes(agentStatus);
  const starting = agentStatus === 'planning' && !agentRunId;

  const handleSend = () => {
    const text = input.trim();

    if ((!text && !pendingImage) || starting) return;
    void submitAgentInput(text || undefined, pendingImage?.base64, pendingImage?.mimeType);
    setPendingImage(null);
    setInput('');
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
    <aside className="flex w-80 flex-col border-l border-white/5 bg-base-700">
      <div className="border-b border-white/5 p-3">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
          AI 对话
        </span>
      </div>

      {(agentRunId || taskPlan) && <ConstructionTimeline />}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {aiMessages.length === 0 && !pendingImage && (
          <p className="py-8 text-center text-xs text-slate-600">
            描述你想要的图形，或粘贴/上传图纸
          </p>
        )}
        {aiMessages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
        {agentError && (
          <p className="text-xs text-danger">{agentError}</p>
        )}
      </div>

      <div className="border-t border-white/5 p-3">
        {/* 图片预览 */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/20 bg-base-800 p-2">
            {pendingImage.mimeType === 'application/pdf' ? (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-danger/10 font-mono text-[10px] text-danger">
                PDF
              </div>
            ) : (
              <img
                src={pendingImage.dataUrl}
                alt="preview"
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <div className="flex-1 truncate">
              <p className="text-xs text-slate-300">{pendingImage.name}</p>
              <p className="text-[10px] text-accent">等待发送</p>
            </div>
            <button
              className="text-slate-500 hover:text-danger"
              onClick={() => setPendingImage(null)}
              title="移除图片"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            className="w-full resize-none rounded-lg border border-white/10 bg-base-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/50"
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
          <div className="flex shrink-0 flex-col gap-1">
            <button
              className="flex items-center justify-center rounded-lg border border-white/10 bg-base-800 px-2 py-1.5 text-slate-400 hover:text-accent disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || agentActive || !!pendingImage}
              title={agentActive ? '当前任务结束后可上传新图纸' : '上传图纸'}
            >
              <Paperclip size={14} />
            </button>
          </div>
          <button
            className="flex shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-base-900 hover:bg-accent-light disabled:opacity-40"
            onClick={handleSend}
            disabled={starting || (!input.trim() && !pendingImage)}
            title={pendingImage ? '发送并分析图片' : '发送'}
          >
            {starting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
