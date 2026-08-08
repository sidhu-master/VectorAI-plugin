import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryEntity } from '@/core/types';
import EntityRenderer from './EntityRenderer';

const common = { visible: true } as const;
const viewport = { minX: -100, minY: -100, maxX: 100, maxY: 100 };

const entities: GeometryEntity[] = [
  { ...common, id: 'point-1', type: 'point', x: 1, y: 2 },
  { ...common, id: 'line-1', type: 'line', start: [0, 0], end: [10, 5] },
  { ...common, id: 'ray-1', type: 'ray', origin: [0, 0], direction: [1, 1] },
  { ...common, id: 'xline-1', type: 'xline', origin: [0, 0], direction: [1, 0] },
  { ...common, id: 'circle-1', type: 'circle', center: [3, 4], radius: 2 },
  {
    ...common, id: 'arc-1', type: 'arc', center: [0, 0], radius: 8,
    startAngle: 0, endAngle: 90, counterClockwise: true,
  },
  { ...common, id: 'ellipse-1', type: 'ellipse', center: [0, 0], majorAxis: [8, 3], ratio: 0.5 },
  {
    ...common, id: 'polyline-1', type: 'polyline', closed: true,
    vertices: [{ point: [0, 0] }, { point: [5, 0] }, { point: [5, 4] }],
  },
  {
    ...common, id: 'spline-1', type: 'spline', degree: 2, closed: false, periodic: false,
    controlPoints: [[0, 0], [3, 5], [8, 2]], knots: [0, 0, 0, 1, 1, 1],
  },
  {
    ...common, id: 'text-1', type: 'text', content: 'ROOM', position: [2, 3], height: 2,
    rotation: 0, alignment: 'center', verticalAlignment: 'middle',
  },
  {
    ...common, id: 'dimension-1', type: 'dimension', dimensionKind: 'linear',
    associationStatus: 'resolved', targets: [], definitionPoints: [[0, 0], [10, 0]],
    textPosition: [5, 2], displayText: '10 mm',
  },
];

describe('EntityRenderer', () => {
  it.each(entities)('renders $type as inspectable SVG without throwing', (entity) => {
    const html = renderToStaticMarkup(
      <svg><EntityRenderer entity={entity} scale={1} viewport={viewport} /></svg>,
    );

    expect(html).toContain(`data-entity-id="${entity.id}"`);
  });

  it('renders construction geometry with a muted dashed stroke', () => {
    const ray = entities.find((entity) => entity.type === 'ray')!;
    const html = renderToStaticMarkup(
      <svg><EntityRenderer entity={ray} scale={1} viewport={viewport} /></svg>,
    );

    expect(html).toContain('stroke-dasharray="7 5"');
    expect(html).toContain('stroke="#64748b"');
  });

  it('renders low-confidence geometry in the danger stroke', () => {
    const lowConfidence: GeometryEntity = {
      ...common, id: 'uncertain', type: 'circle', center: [0, 0], radius: 5, confidence: 0.42,
    };
    const html = renderToStaticMarkup(
      <svg><EntityRenderer entity={lowConfidence} scale={1} viewport={viewport} /></svg>,
    );

    expect(html).toContain('stroke="#f87171"');
  });

  it('uses the single accent stroke for selection', () => {
    const html = renderToStaticMarkup(
      <svg><EntityRenderer entity={entities[1]} scale={1} viewport={viewport} selected /></svg>,
    );

    expect(html).toContain('stroke="#60a5fa"');
  });
});
