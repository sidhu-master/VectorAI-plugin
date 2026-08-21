// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export interface ReviewRenderManifest {
  rendererVersion: 'vectorai-review-svg-v1';
  width: 1280;
  height: 720;
  comparisonLayout: 'before | after';
  worldToImage: [number, number, number, number, number, number];
  overlays: ['changed-nodes', 'motion-vectors'];
}

export interface ObservationRenderManifest {
  rendererVersion: 'vectorai-observation-svg-v1';
  width: 960;
  height: 720;
  worldToImage: [number, number, number, number, number, number];
  viewport: { minX: number; minY: number; maxX: number; maxY: number };
  overlays: ['selection'];
}

export async function renderDrawingObservation(input: {
  document: DrawingDocument;
  viewport: { minX: number; minY: number; maxX: number; maxY: number };
  selectedNodeIds?: string[];
}): Promise<{ png: Uint8Array; contentDigest: string; manifest: ObservationRenderManifest }> {
  const width = 960 as const;
  const height = 720 as const;
  const padding = 36;
  const worldWidth = Math.max(input.viewport.maxX - input.viewport.minX, 1e-6);
  const worldHeight = Math.max(input.viewport.maxY - input.viewport.minY, 1e-6);
  const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
  const offsetX = padding + (width - padding * 2 - worldWidth * scale) / 2 - input.viewport.minX * scale;
  const offsetY = height - padding - (height - padding * 2 - worldHeight * scale) / 2 + input.viewport.minY * scale;
  const transform: ObservationRenderManifest['worldToImage'] = [scale, 0, 0, -scale, offsetX, offsetY];
  const selected = new Set(input.selectedNodeIds ?? []);
  const normal = renderDocument(input.document, new Set(), '#d7e0ea');
  const highlight = selected.size === 0 ? '' : renderDocument(input.document, selected, '#ffad42', true);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#101419"/>
    <g transform="matrix(${transform.join(' ')})">${normal}${highlight}</g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    contentDigest: `sha256:${createHash('sha256').update(png).digest('hex')}`,
    manifest: {
      rendererVersion: 'vectorai-observation-svg-v1', width, height, worldToImage: transform,
      viewport: structuredClone(input.viewport), overlays: ['selection'],
    },
  };
}

export async function renderReviewComparison(input: {
  before: DrawingDocument;
  after: DrawingDocument;
  viewport: { minX: number; minY: number; maxX: number; maxY: number };
  changedNodeIds: string[];
}): Promise<{ png: Uint8Array; contentDigest: string; manifest: ReviewRenderManifest }> {
  const width = 1280 as const;
  const height = 720 as const;
  const panelWidth = width / 2;
  const padding = 36;
  const worldWidth = Math.max(input.viewport.maxX - input.viewport.minX, 1e-6);
  const worldHeight = Math.max(input.viewport.maxY - input.viewport.minY, 1e-6);
  const scale = Math.min((panelWidth - padding * 2) / worldWidth, (height - padding * 2 - 28) / worldHeight);
  const offsetX = padding + (panelWidth - padding * 2 - worldWidth * scale) / 2 - input.viewport.minX * scale;
  const offsetY = height - padding - (height - padding * 2 - 28 - worldHeight * scale) / 2 + input.viewport.minY * scale;
  const transform: ReviewRenderManifest['worldToImage'] = [scale, 0, 0, -scale, offsetX, offsetY];
  const changed = new Set(input.changedNodeIds);
  const before = renderDocument(input.before, changed, '#f5a65b');
  const after = renderDocument(input.after, changed, '#54b9ff');
  const motion = motionVectors(input.before, input.after, changed).map(({ id, from, to }) => (
    `<line data-node="${escapeXml(id)}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="#54b9ff" stroke-width="2" vector-effect="non-scaling-stroke" marker-end="url(#arrow)"/>`
  )).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#101419"/>
    <line x1="${panelWidth}" y1="0" x2="${panelWidth}" y2="${height}" stroke="#35404b"/>
    <text x="20" y="25" fill="#9aa8b5" font-family="sans-serif" font-size="14">BEFORE</text>
    <text x="${panelWidth + 20}" y="25" fill="#9aa8b5" font-family="sans-serif" font-size="14">AFTER</text>
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#54b9ff"/></marker></defs>
    <g transform="matrix(${transform.join(' ')})">${before}</g>
    <g transform="translate(${panelWidth} 0) matrix(${transform.join(' ')})">${after}${motion}</g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    contentDigest: `sha256:${createHash('sha256').update(png).digest('hex')}`,
    manifest: {
      rendererVersion: 'vectorai-review-svg-v1', width, height,
      comparisonLayout: 'before | after', worldToImage: transform,
      overlays: ['changed-nodes', 'motion-vectors'],
    },
  };
}

function renderDocument(
  document: DrawingDocument,
  changed: Set<string>,
  changedColor: string,
  selectedOnly = false,
): string {
  return [...document.geometry, ...document.annotations]
    .filter((node) => node.visible && (!selectedOnly || changed.has(String(node.id))))
    .map((node) => renderNode(node, changed.has(String(node.id)) ? changedColor : '#d7e0ea'))
    .join('');
}

function renderNode(node: GeometryNode | AnnotationNode, color: string): string {
  const style = `fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"`;
  switch (node.type) {
    case 'point': return `<circle cx="${node.x}" cy="${node.y}" r="2" ${style}/>`;
    case 'line': return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}" ${style}/>`;
    case 'ray':
    case 'xline': return `<line x1="${node.origin[0]}" y1="${node.origin[1]}" x2="${node.origin[0] + node.direction[0] * 1000}" y2="${node.origin[1] + node.direction[1] * 1000}" ${style}/>`;
    case 'circle': return `<circle cx="${node.center[0]}" cy="${node.center[1]}" r="${node.radius}" ${style}/>`;
    case 'arc': {
      const start = polar(node.center, node.radius, node.startAngle);
      const end = polar(node.center, node.radius, node.endAngle);
      const span = Math.abs(node.endAngle - node.startAngle) % 360;
      return `<path d="M ${start[0]} ${start[1]} A ${node.radius} ${node.radius} 0 ${span > 180 ? 1 : 0} ${node.counterClockwise ? 1 : 0} ${end[0]} ${end[1]}" ${style}/>`;
    }
    case 'ellipse': {
      const rx = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
      return `<ellipse cx="${node.center[0]}" cy="${node.center[1]}" rx="${rx}" ry="${rx * node.ratio}" transform="rotate(${rotation} ${node.center[0]} ${node.center[1]})" ${style}/>`;
    }
    case 'polyline': return `<polyline points="${node.vertices.map(({ point }) => point.join(',')).join(' ')}" ${node.closed ? 'data-closed="true"' : ''} ${style}/>`;
    case 'spline': return `<polyline points="${node.controlPoints.map((point) => point.join(',')).join(' ')}" ${style}/>`;
    case 'text': return textBox(node.position, node.height, node.content, color);
    case 'dimension': return `${node.definitionPoints.length > 1 ? `<polyline points="${node.definitionPoints.map((point) => point.join(',')).join(' ')}" ${style}/>` : ''}${textBox(node.textPosition, 4, node.displayText ?? 'DIM', color)}`;
    case 'leader': return `<polyline points="${node.points.map((point) => point.join(',')).join(' ')}" ${style}/>${textBox(node.points.at(-1) ?? [0, 0], node.textHeight, node.content, color)}`;
    case 'centerline': return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}" stroke-dasharray="8 4" ${style}/>`;
    case 'section-hatch': return node.segments.map(({ start, end }) => `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" ${style}/>`).join('');
  }
}

function textBox(position: Vec2, height: number, text: string, color: string): string {
  return `<g transform="translate(${position[0]} ${position[1]}) scale(1 -1)"><text fill="${color}" font-size="${height}" font-family="sans-serif">${escapeXml(text)}</text></g>`;
}

function motionVectors(before: DrawingDocument, after: DrawingDocument, changed: Set<string>) {
  const first = new Map([...before.geometry, ...before.annotations].map((node) => [String(node.id), node]));
  const second = new Map([...after.geometry, ...after.annotations].map((node) => [String(node.id), node]));
  return [...changed].flatMap((id) => {
    const from = center(first.get(id));
    const to = center(second.get(id));
    return from && to && Math.hypot(from[0] - to[0], from[1] - to[1]) > 1e-9 ? [{ id, from, to }] : [];
  });
}

function center(node: GeometryNode | AnnotationNode | undefined): Vec2 | null {
  if (!node) return null;
  switch (node.type) {
    case 'point': return [node.x, node.y];
    case 'line': return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case 'ray':
    case 'xline': return [...node.origin];
    case 'circle':
    case 'arc':
    case 'ellipse': return [...node.center];
    case 'polyline': return average(node.vertices.map(({ point }) => point));
    case 'spline': return average(node.controlPoints);
    case 'text': return [...node.position];
    case 'dimension': return [...node.textPosition];
    case 'leader': return [...(node.points.at(-1) ?? [0, 0])];
    case 'centerline': return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case 'section-hatch': return average(node.segments.flatMap(({ start, end }) => [start, end]));
  }
}

function average(points: readonly Vec2[]): Vec2 | null {
  if (points.length === 0) return null;
  return [points.reduce((sum, [x]) => sum + x, 0) / points.length, points.reduce((sum, [, y]) => sum + y, 0) / points.length];
}

function polar(center: Vec2, radius: number, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character);
}
