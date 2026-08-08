import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface CanvasErrorBoundaryState {
  error: Error | null;
}

interface CanvasErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

export function CanvasErrorFallback({ onRetry }: CanvasErrorFallbackProps) {
  return (
    <section className="flex min-w-0 flex-1 items-center justify-center bg-base-800" aria-label="画布恢复面板">
      <div className="max-w-sm rounded-xl border border-white/10 bg-base-700/80 p-6 text-center shadow-2xl shadow-black/20">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle size={18} />
        </span>
        <h2 className="text-sm font-medium text-slate-100">画布暂时无法显示</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          任务和图纸数据仍然保留。你可以重新加载画布后继续操作。
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-base-600 px-3 py-2 text-xs text-slate-200 hover:border-accent/40 hover:text-white"
        >
          <RefreshCw size={13} />
          重新加载画布
        </button>
      </div>
    </section>
  );
}

export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Canvas render failed', { error, componentStack: info.componentStack });
  }

  componentDidUpdate(previousProps: CanvasErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <CanvasErrorFallback error={this.state.error} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
