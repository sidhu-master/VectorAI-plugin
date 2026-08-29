// SPDX-License-Identifier: Apache-2.0

import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { calculateWorkspaceLayout, type WorkspaceLayout } from './workspace-layout';

export interface DrawingPresence {
  hasDrawing(sessionId: string): Promise<boolean>;
  subscribe(sessionId: string, listener: () => void): () => void;
}

interface SessionsSnapshot {
  current?: string;
}

export interface VectorAIWorkspaceOverlayProps {
  useSessions<T>(selector: (snapshot: SessionsSnapshot) => T): T;
  renderSlot(name: string, props: Record<string, never>): ReactNode;
  SessionProvider: ComponentType<{ children?: ReactNode }>;
  drawingPresence: DrawingPresence;
}

export function VectorAIWorkspaceOverlay({
  useSessions,
  renderSlot,
  SessionProvider,
  drawingPresence,
}: VectorAIWorkspaceOverlayProps) {
  const sessionId = useSessions((snapshot) => snapshot.current);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [layout, setLayout] = useState<WorkspaceLayout | null>(null);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (sessionId === undefined) {
        setHasDrawing(false);
        return;
      }
      void drawingPresence.hasDrawing(sessionId).then((present) => {
        if (live) setHasDrawing(present);
      }, () => {
        if (live) setHasDrawing(false);
      });
    };
    refresh();
    if (sessionId === undefined) return () => { live = false; };
    const dispose = drawingPresence.subscribe(sessionId, refresh);
    return () => {
      live = false;
      dispose();
    };
  }, [drawingPresence, sessionId]);

  useLayoutEffect(() => {
    if (!hasDrawing || typeof document === 'undefined') {
      setLayout(null);
      return;
    }
    const conversationSlot = document.querySelector<HTMLElement>('[data-slot="conversation"]');
    const centerColumn = conversationSlot?.parentElement;
    if (conversationSlot === null || centerColumn === null) return;

    let animationFrame: number | null = null;
    const update = () => {
      animationFrame = null;
      const renderedRect = centerColumn.getBoundingClientRect();
      const currentInset = Number.parseFloat(centerColumn.style.marginLeft) || 0;
      const next = calculateWorkspaceLayout({
        left: renderedRect.left - currentInset,
        top: renderedRect.top,
        width: renderedRect.width + currentInset,
        height: renderedRect.height,
      });
      centerColumn.style.marginLeft = `${next.width}px`;
      centerColumn.dataset.vectoraiDrawingInset = '';
      setLayout((current) => current !== null
        && current.left === next.left
        && current.top === next.top
        && current.width === next.width
        && current.height === next.height
        ? current
        : next);
    };
    const schedule = () => {
      if (animationFrame === null) animationFrame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(centerColumn);
    observer.observe(document.documentElement);
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      centerColumn.style.marginLeft = '';
      delete centerColumn.dataset.vectoraiDrawingInset;
      setLayout(null);
    };
  }, [hasDrawing, sessionId]);

  if (!hasDrawing || layout === null) return null;
  const style: CSSProperties = {
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
  return <section className="vai-dsh-workspace-overlay" style={style} data-vectorai-workspace-overlay="">
    <SessionProvider>{renderSlot('vectorai.drawing.workspace', {})}</SessionProvider>
  </section>;
}
