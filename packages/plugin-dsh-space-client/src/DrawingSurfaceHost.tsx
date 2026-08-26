// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingSurfaceObservable,
  DrawingSurfaceRegistry,
  DrawingWorkspaceContribution,
} from '@vectorai/drawing-surface-api';
import type { DrawingSurfaceRuntime } from '@vectorai/drawing-workspace';
import {
  Component,
  useCallback,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';

export interface DrawingSurfaceHostProps {
  sessionId: string;
  registry: DrawingSurfaceRegistry;
  runtime: DrawingSurfaceRuntime;
  fallback: ReactNode;
}

export function DrawingSurfaceHost({
  sessionId,
  registry,
  runtime,
  fallback,
}: DrawingSurfaceHostProps) {
  const subscribeRegistry = useCallback(
    (listener: () => void) => registry.subscribe(sessionId, listener),
    [registry, sessionId],
  );
  const readElectedId = useCallback(
    () => registry.getWorkspaceSnapshot(sessionId).electedId,
    [registry, sessionId],
  );
  const electedId = useSyncExternalStore(subscribeRegistry, readElectedId, readElectedId);
  const snapshot = useSurfaceObservable(runtime.snapshot);
  const contribution = electedId === null ? null : registry.getWorkspaceContribution(electedId);

  if (contribution !== null) {
    const SpecializedWorkspace = contribution.Component as ComponentType<{
      sessionId: string;
      namespace: string;
      runtime: DrawingSurfaceRuntime;
    }>;
    return <ContributionErrorBoundary key={contribution.id} contribution={contribution}>
      <div
        data-drawing-surface-contribution={contribution.id}
        data-drawing-surface-namespace={contribution.id}
        data-conversation-workspace-active=""
        style={{ display: 'flex', flex: '1 1 auto', minWidth: 0, minHeight: 0 }}
      >
        <SpecializedWorkspace
          sessionId={sessionId}
          namespace={contribution.id}
          runtime={runtime}
        />
      </div>
    </ContributionErrorBoundary>;
  }

  return snapshot === null ? null : fallback;
}

function useSurfaceObservable<T>(observable: DrawingSurfaceObservable<T>): T {
  return useSyncExternalStore(observable.subscribe, observable.getSnapshot, observable.getSnapshot);
}

interface ContributionErrorBoundaryProps {
  contribution: DrawingWorkspaceContribution;
  children: ReactNode;
}

interface ContributionErrorBoundaryState {
  error: Error | null;
}

class ContributionErrorBoundary extends Component<
  ContributionErrorBoundaryProps,
  ContributionErrorBoundaryState
> {
  state: ContributionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ContributionErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch() {
    // React reports the original component stack. The owned diagnostic surface remains mounted.
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return <div
      role="alert"
      data-drawing-contribution-error={this.props.contribution.id}
      data-drawing-surface-namespace={this.props.contribution.id}
    >
      <p>扩展工作区暂时无法渲染。</p>
      <button type="button" onClick={() => this.setState({ error: null })}>重试</button>
    </div>;
  }
}
