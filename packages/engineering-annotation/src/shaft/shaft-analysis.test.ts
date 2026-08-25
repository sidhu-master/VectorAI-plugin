// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { analyzeShaftPartition, detectShaftSteps, extractShaftProfile, resolveShaftAxis } from '../index';

function stepped(mirrored = false) {
  const document = createEmptyDrawing({ idFactory: { next: () => 'shaft' }, now: () => 1 });
  const point = (x: number, y: number): [number, number] => [mirrored ? 40 - x : x, y];
  const lines: Array<[[number, number], [number, number]]> = [
    [[0, 5], [10, 5]], [[10, 8], [25, 8]], [[25, 4], [40, 4]],
    [[0, -5], [10, -5]], [[10, -8], [25, -8]], [[25, -4], [40, -4]],
    [[0, -5], [0, 5]], [[10, 5], [10, 8]], [[10, -5], [10, -8]],
    [[25, 8], [25, 4]], [[25, -8], [25, -4]], [[40, -4], [40, 4]],
    [[14, -1], [15, 1]],
  ];
  document.geometry = lines.map(([start, end], index) => ({
    id: `line:${index}` as GeometryId, type: 'line' as const, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] }, start: point(...start), end: point(...end),
  }));
  return document;
}

describe('shaft axis and persistent step analysis', () => {
  it.each([false, true])('finds the complete outer-profile partition (mirrored=%s)', (mirrored) => {
    const axis = resolveShaftAxis(stepped(mirrored), { axisOrigin: 'left_end', orientation: 'auto', regions: [] });
    expect(axis).not.toBeNull();
    const profile = extractShaftProfile(stepped(mirrored), axis!);
    const steps = detectShaftSteps(profile);
    expect(axis!.direction[0]).toBeGreaterThan(0);
    expect(steps.filter(({ accepted }) => accepted).map(({ z }) => z)).toEqual(mirrored ? [0, 15, 30, 40] : [0, 10, 25, 40]);
  });

  it('isolates the shaft view and resolves a rotated axis', () => {
    const document = stepped();
    const angle = Math.PI / 6;
    const rotate = ([x, y]: readonly [number, number]): [number, number] => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
    document.geometry = document.geometry.map((node) => node.type === 'line' ? { ...node, start: rotate(node.start), end: rotate(node.end) } : node);
    document.geometry.push({
      id: 'detached-detail' as GeometryId, type: 'circle', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, center: [150, 150], radius: 4,
    });
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [] });
    expect(axis).not.toBeNull();
    expect(axis!.direction[0]).toBeCloseTo(Math.cos(angle), 6);
    expect(axis!.direction[1]).toBeCloseTo(Math.sin(angle), 6);
    expect(axis!.zMax).toBeCloseTo(40, 6);
    expect(axis!.geometryNodeIds).not.toContain('detached-detail');
  });

  it('normalizes document units and matches only real geometric boundaries', () => {
    const result = analyzeShaftPartition({
      document: stepped(), drawingRef: { drawingId: 'shaft', revision: 1 },
      engineeringText: '[drawing]\nunit=cm\n[region:seat:middle]\nname=中间轴段\ncenter_z=1.75\nwidth=1.5\nouter_diameter=1.6',
    });
    expect(result.status).toBe('drafted');
    if (result.status !== 'drafted') return;
    expect(result.draft.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 10], [10, 25], [25, 40]]);
    expect(result.draft.semanticGroups[0]).toMatchObject({ name: '中间轴段', segmentIds: ['segment:10-25'] });
  });

  it('uses document diameter evidence to choose among detached shaft views', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'multi' }, now: () => 1 });
    const rectangle = (x: number, length: number, radius: number) => [
      [[x, radius], [x + length, radius]], [[x, -radius], [x + length, -radius]],
      [[x, -radius], [x, radius]], [[x + length, -radius], [x + length, radius]],
    ] as Array<[[number, number], [number, number]]>;
    document.geometry = [...rectangle(0, 40, 5), ...rectangle(100, 100, 10)].map(([start, end], index) => ({
      id: `view:${index}` as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, start, end,
    }));
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [{ id: 'seat', type: 'seat', outerDiameter: 10, sourceLines: [] }] });
    expect(axis?.zMax).toBeCloseTo(40, 6);
  });

  it('does not turn an internal construction cross-line into a physical step', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'uniform' }, now: () => 1 });
    const lines: Array<[[number, number], [number, number]]> = [
      [[0, 5], [40, 5]], [[0, -5], [40, -5]], [[0, -5], [0, 5]], [[40, -5], [40, 5]],
      [[20, -5], [20, 5]],
    ];
    document.geometry = lines.map(([start, end], index) => ({
      id: `uniform:${index}` as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, start, end,
    }));
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [] })!;
    expect(detectShaftSteps(extractShaftProfile(document, axis)).filter(({ accepted }) => accepted).map(({ z }) => z)).toEqual([0, 40]);
  });
});
