// SPDX-License-Identifier: Apache-2.0

import * as annotation from '../index';
import { describe, expect, it } from 'vitest';

describe('GB/T 1184 general geometric tolerance catalog', () => {
  it('exposes a catalog lookup through the engineering annotation boundary', () => {
    expect((annotation as Record<string, unknown>).lookupGbt1184GeneralTolerance).toBeTypeOf('function');
  });

  it('returns the H K L row for the controlled characteristic and evaluation length', () => {
    const lookup = annotation.lookupGbt1184GeneralTolerance;
    expect(lookup('straightness', 55).map(({ toleranceClass, value }) => [toleranceClass, value])).toEqual([
      ['H', 0.1], ['K', 0.2], ['L', 0.4],
    ]);
    expect(lookup('perpendicularity', 105).map(({ toleranceClass, value }) => [toleranceClass, value])).toEqual([
      ['H', 0.3], ['K', 0.6], ['L', 1],
    ]);
  });

  it('returns size-independent circular-runout classes and refuses unsupported direct-table claims', () => {
    const lookup = annotation.lookupGbt1184GeneralTolerance;
    expect(lookup('circular-runout').map(({ toleranceClass, value }) => [toleranceClass, value])).toEqual([
      ['H', 0.1], ['K', 0.2], ['L', 0.5],
    ]);
    expect(lookup('position', 55)).toEqual([]);
    expect(lookup('circularity', 55)).toEqual([]);
  });

  it('looks up Appendix B specified-tolerance grades in millimetres', () => {
    const lookup = (annotation as typeof annotation & {
      lookupGbt1184SpecifiedTolerance(characteristic: string, nominalLength?: number): Array<{ grade: number; value: number }>;
    }).lookupGbt1184SpecifiedTolerance;
    expect(lookup).toBeTypeOf('function');
    expect(lookup('straightness', 55).filter(({ grade }) => grade === 1 || grade === 7)).toEqual([
      { grade: 1, value: 0.0005 }, { grade: 7, value: 0.012 },
    ]);
    expect(lookup('circularity', 55).filter(({ grade }) => grade === 0 || grade === 8)).toEqual([
      { grade: 0, value: 0.0003 }, { grade: 8, value: 0.013 },
    ]);
    expect(lookup('perpendicularity', 55).filter(({ grade }) => grade === 1 || grade === 8)).toEqual([
      { grade: 1, value: 0.001 }, { grade: 8, value: 0.05 },
    ]);
    expect(lookup('coaxiality', 55).filter(({ grade }) => grade === 1 || grade === 8)).toEqual([
      { grade: 1, value: 0.0015 }, { grade: 8, value: 0.04 },
    ]);
  });

  it('exposes the Appendix B position-tolerance preferred-number series', () => {
    expect(annotation.listGbt1184PositionToleranceSeries({ min: 0.001, max: 0.01 })).toEqual([
      0.001, 0.0012, 0.0015, 0.002, 0.0025, 0.003, 0.004, 0.005, 0.006, 0.008, 0.01,
    ]);
  });
});
