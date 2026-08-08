import { describe, expect, it } from 'vitest';
import type { AnnotationId, GeometryId } from '@/drawing';
import { entityBounds, entityCenter, modelBounds, type DrawingRenderable } from './geometry';

const visible = {
  visible: true,
  quality: { status: 'confirmed' as const, evidenceRefs: [] },
};
const gid = (id: string) => id as GeometryId;
const aid = (id: string) => id as AnnotationId;

describe('CAD entity geometry', () => {
  it.each<[string, DrawingRenderable, [number, number, number, number]]>([
    ['point', { ...visible, id: gid('p'), type: 'point', x: 2, y: 3 }, [2, 3, 2, 3]],
    ['line', { ...visible, id: gid('l'), type: 'line', start: [-2, 5], end: [4, -1] }, [-2, -1, 4, 5]],
    ['circle', { ...visible, id: gid('c'), type: 'circle', center: [2, -3], radius: 5 }, [-3, -8, 7, 2]],
    ['polyline', {
      ...visible, id: gid('pl'), type: 'polyline', closed: true,
      vertices: [{ point: [-4, 1] }, { point: [3, 8] }, { point: [6, -2] }],
    }, [-4, -2, 6, 8]],
    ['spline', {
      ...visible, id: gid('sp'), type: 'spline', degree: 2, closed: false, periodic: false,
      controlPoints: [[-3, 2], [5, 9], [8, -4]], knots: [0, 0, 0, 1, 1, 1],
    }, [-3, -4, 8, 9]],
    ['text', {
      ...visible, id: aid('t'), type: 'text', content: 'AB', position: [10, 20], height: 5,
      rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
    }, [10, 15, 16, 20]],
    ['dimension', {
      ...visible, id: aid('d'), type: 'dimension', dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], textPosition: [5, 3],
      definitionPoints: [[0, 0], [10, 0]], displayText: '10',
    }, [0, 0, 10, 3]],
  ])('returns finite bounds for %s', (_name, entity, expected) => {
    const bounds = entityBounds(entity);

    expect(bounds).toEqual({
      minX: expected[0], minY: expected[1], maxX: expected[2], maxY: expected[3],
    });
  });

  it('includes arc quadrant extremes using degree angles', () => {
    const bounds = entityBounds({
      ...visible, id: gid('a'), type: 'arc', center: [0, 0], radius: 10,
      startAngle: 315, endAngle: 45, counterClockwise: true,
    });

    expect(bounds?.minX).toBeCloseTo(7.0710678);
    expect(bounds?.minY).toBeCloseTo(-7.0710678);
    expect(bounds?.maxX).toBe(10);
    expect(bounds?.maxY).toBeCloseTo(7.0710678);
  });

  it('uses rotated major and minor axes for ellipse bounds', () => {
    const bounds = entityBounds({
      ...visible, id: gid('e'), type: 'ellipse', center: [10, -2], majorAxis: [3, 4], ratio: 0.5,
    });

    expect(bounds?.minX).toBeCloseTo(6.3944487);
    expect(bounds?.maxX).toBeCloseTo(13.6055513);
    expect(bounds?.minY).toBeCloseTo(-6.2720019);
    expect(bounds?.maxY).toBeCloseTo(2.2720019);
  });

  it('excludes infinite and malformed geometry from auto-fit', () => {
    const ray: DrawingRenderable = {
      ...visible, id: gid('ray'), type: 'ray', origin: [0, 0], direction: [1, 0],
    };
    const xline: DrawingRenderable = {
      ...visible, id: gid('xline'), type: 'xline', origin: [0, 0], direction: [0, 1],
    };
    const malformed = {
      ...visible, id: gid('bad'), type: 'circle', center: [0, Number.NaN], radius: 5,
    } as DrawingRenderable;

    expect(entityBounds(ray)).toBeNull();
    expect(entityBounds(xline)).toBeNull();
    expect(entityBounds(malformed)).toBeNull();
    expect(modelBounds([ray, xline, malformed])).toBeNull();
  });

  it('combines only visible finite bounds and provides safe centers', () => {
    const point: DrawingRenderable = { ...visible, id: gid('p'), type: 'point', x: 2, y: 3 };
    const hidden: DrawingRenderable = { ...visible, visible: false, id: gid('h'), type: 'point', x: -100, y: -100 };
    const circle: DrawingRenderable = { ...visible, id: gid('c'), type: 'circle', center: [8, 9], radius: 2 };

    expect(modelBounds([point, hidden, circle])).toEqual({ minX: 2, minY: 3, maxX: 10, maxY: 11 });
    expect(entityCenter(circle)).toEqual([8, 9]);
  });
});
