import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnnotationId, GeometryId } from '@/drawing';
import EntityRenderer from './EntityRenderer';
import type { DrawingRenderable } from './geometry';

const common = {
  visible: true,
  quality: { status: 'confirmed' as const, evidenceRefs: [] },
};
const viewport = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
const gid = (id: string) => id as GeometryId;
const aid = (id: string) => id as AnnotationId;

const entities: DrawingRenderable[] = [
  { ...common, id: gid('point-1'), type: 'point', x: 1, y: 2 },
  { ...common, id: gid('line-1'), type: 'line', start: [0, 0], end: [10, 5] },
  { ...common, id: gid('ray-1'), type: 'ray', origin: [0, 0], direction: [1, 1] },
  { ...common, id: gid('xline-1'), type: 'xline', origin: [0, 0], direction: [1, 0] },
  { ...common, id: gid('circle-1'), type: 'circle', center: [3, 4], radius: 2 },
  {
    ...common, id: gid('arc-1'), type: 'arc', center: [0, 0], radius: 8,
    startAngle: 0, endAngle: 90, counterClockwise: true,
  },
  { ...common, id: gid('ellipse-1'), type: 'ellipse', center: [0, 0], majorAxis: [8, 3], ratio: 0.5 },
  {
    ...common, id: gid('polyline-1'), type: 'polyline', closed: true,
    vertices: [{ point: [0, 0] }, { point: [5, 0] }, { point: [5, 4] }],
  },
  {
    ...common, id: gid('spline-1'), type: 'spline', degree: 2, closed: false, periodic: false,
    controlPoints: [[0, 0], [3, 5], [8, 2]], knots: [0, 0, 0, 1, 1, 1],
  },
  {
    ...common, id: aid('text-1'), type: 'text', content: 'ROOM', position: [2, 3], height: 2,
    rotation: 0, alignment: 'center', verticalAlignment: 'middle',
  },
  {
    ...common, id: aid('dimension-1'), type: 'dimension', dimensionKind: 'linear',
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
    const lowConfidence: DrawingRenderable = {
      ...common,
      id: gid('uncertain'),
      type: 'circle',
      center: [0, 0],
      radius: 5,
      quality: { status: 'candidate', confidence: 0.42, evidenceRefs: [] },
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

    expect(html).toContain('stroke="#6da9d2"');
  });

  it('renders a non-interactive provisional entity with one treatment and label', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityRenderer
          entity={entities[4]}
          scale={10}
          viewport={viewport}
          provisional
          label="GEO-0001"
        />
      </svg>,
    );

    expect(html).toContain('data-provisional="true"');
    expect(html).toContain('GEO-0001');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).not.toContain('stroke="transparent"');
    expect(html).not.toContain('cursor-pointer');
  });

  it('renders test1-style CAD dimensions with extension lines, arrows, accent text, and center marks', () => {
    const linear: DrawingRenderable = {
      ...common,
      id: aid('dimension-linear'), type: 'dimension', dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], computedValue: 10, displayText: '10',
      definitionPoints: [[0, 0], [10, 0], [0, 4], [10, 4]], textPosition: [5, 5],
    };
    const diameter: DrawingRenderable = {
      ...common,
      id: aid('dimension-diameter'), type: 'dimension', dimensionKind: 'diameter',
      associationStatus: 'resolved', targets: [], computedValue: 10, displayText: 'Ø10',
      definitionPoints: [[0, 0], [10, 0]], textPosition: [5, 2],
    };

    const linearHtml = renderToStaticMarkup(
      <svg><EntityRenderer entity={linear} scale={2} viewport={viewport} /></svg>,
    );
    const diameterHtml = renderToStaticMarkup(
      <svg><EntityRenderer entity={diameter} scale={2} viewport={viewport} /></svg>,
    );

    expect(linearHtml).toContain('data-dimension-role="extension"');
    expect(linearHtml).toContain('data-dimension-role="measure"');
    expect(linearHtml).toContain('data-dimension-role="arrow"');
    expect(linearHtml).toContain('fill="#df78ca"');
    expect(diameterHtml).toContain('data-dimension-role="center-mark"');
    expect(diameterHtml).toContain('stroke="#63c991"');
  });

  it('renders every part of a low-confidence dimension in the danger color', () => {
    const lowConfidence: DrawingRenderable = {
      ...common,
      id: aid('dimension-low-confidence'), type: 'dimension', dimensionKind: 'diameter',
      associationStatus: 'resolved', targets: [], computedValue: 10, displayText: 'Ø10',
      definitionPoints: [[0, 0], [10, 0]], textPosition: [5, 2],
      quality: { status: 'candidate', confidence: 0.4, evidenceRefs: [] },
    };

    const html = renderToStaticMarkup(
      <svg><EntityRenderer entity={lowConfidence} scale={2} viewport={viewport} /></svg>,
    );

    expect(html).toContain('data-dimension-role="center-mark"');
    expect(html).toContain('stroke="#f87171"');
    expect(html).not.toContain('stroke="#63c991"');
  });
});
