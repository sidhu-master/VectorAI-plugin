// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import manifest from '../../test/fixtures/golden-shaft-001/manifest.json';
import {
  coreGeometrySignatures,
  loadGoldenDrawing,
  readGoldenAxialLinearIntervals,
  sortIntervals,
} from './golden-fixture-test-support';

describe('golden shaft dimension fixture', () => {
  it('keeps the clean geometry inside the annotated target', async () => {
    const initial = await loadGoldenDrawing('initial.dxf');
    const target = await loadGoldenDrawing('target.dxf');
    const initialGeometry = coreGeometrySignatures(initial);
    const targetGeometry = coreGeometrySignatures(target);

    expect(initialGeometry.every((signature) => targetGeometry.includes(signature))).toBe(true);
  });

  it('records the reviewed axial stations and displayed target intervals', async () => {
    const expected = manifest.displayedIntervals.map(([start, end]) => [start, end] as [number, number]);
    expect(sortIntervals(await readGoldenAxialLinearIntervals('target.dxf'))).toEqual(sortIntervals(expected));
    expect(manifest.stations).toEqual([0, 17, 41.5, 45, 53, 92, 147, 150, 173]);
  });
});
