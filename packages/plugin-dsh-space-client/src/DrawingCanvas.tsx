// SPDX-License-Identifier: Apache-2.0

import type { DrawingCanvasProjection } from '@vectorai/plugin-space-contracts';
import type { CSSProperties } from 'react';

export interface DrawingCanvasProps {
  projection: DrawingCanvasProjection | null;
  loading?: boolean;
  error?: string | null;
}

const shellStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--dsw-alias-label-primary, #1f2329)',
  background: 'var(--dsw-alias-bg-base, #f5f6f8)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 48,
  padding: '0 16px',
  borderBottom: '1px solid var(--dsw-alias-border-l1, #dde1e7)',
  background: 'var(--dsw-alias-bg-elevated, #fff)',
  fontSize: 13,
};

export function DrawingCanvas({ projection, loading = false, error = null }: DrawingCanvasProps) {
  if (projection === null) {
    return (
      <section style={shellStyle} aria-label="图纸画布">
        <div style={{ margin: 'auto', textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>还没有已导入的图纸</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65 }}>
            {loading ? '正在读取本地图纸…' : '在聊天中发送一张图纸图片开始。'}
          </div>
          {error === null ? null : <div role="alert" style={{ marginTop: 12, color: '#c62828' }}>{error}</div>}
        </div>
      </section>
    );
  }

  const { bounds } = projection;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  return (
    <section style={shellStyle} aria-label="图纸画布">
      <header style={headerStyle}>
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{projection.ref.drawingId}</strong>
        <span style={{ opacity: 0.65 }}>Revision {projection.ref.revision}</span>
        {projection.provisional ? (
          <span style={{ borderRadius: 999, padding: '3px 8px', color: '#8a5100', background: '#fff1cf' }}>
            候选几何
          </span>
        ) : null}
        {loading ? <span style={{ marginLeft: 'auto', opacity: 0.65 }}>更新中…</span> : null}
      </header>
      {error === null ? null : (
        <div role="alert" style={{ padding: '8px 16px', color: '#c62828', background: '#fff1f0', fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'hidden' }}>
        <svg
          viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', background: '#fff', boxShadow: '0 4px 18px rgba(31,35,41,.12)' }}
          aria-label={projection.source.name ?? '导入图纸'}
        >
          <image
            href={projection.source.dataUrl}
            x={bounds.minX}
            y={bounds.minY}
            width={width}
            height={height}
            preserveAspectRatio="none"
          />
          {projection.geometry.map((line) => (
            <line
              key={line.id}
              x1={line.start[0]}
              y1={line.start[1]}
              x2={line.end[0]}
              y2={line.end[1]}
              stroke={line.status === 'candidate' ? '#ff8a00' : '#1677ff'}
              strokeWidth={2}
              strokeDasharray={line.status === 'candidate' ? '7 5' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
