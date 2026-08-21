// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { extractNumericConstraints } from './numeric-instruction';

describe('extractNumericConstraints', () => {
  it('extracts exact distance and angle evidence in instruction order', () => {
    expect(extractNumericConstraints('向上移动 80 mm，再旋转 30°', 'mm')).toEqual([
      {
        numericKey: 'n1',
        kind: 'distance',
        value: 80,
        unit: 'mm',
        userEvidenceSpan: { start: 5, end: 10, text: '80 mm' },
      },
      {
        numericKey: 'n2',
        kind: 'angle',
        value: 30,
        unit: 'deg',
        userEvidenceSpan: { start: 15, end: 18, text: '30°' },
      },
    ]);
  });

  it('uses the Drawing unit only for a unitless value in an explicit motion phrase', () => {
    expect(extractNumericConstraints('移动 80', 'cm')).toEqual([{
      numericKey: 'n1',
      kind: 'distance',
      value: 80,
      unit: 'cm',
      userEvidenceSpan: { start: 3, end: 5, text: '80' },
    }]);
    expect(extractNumericConstraints('把手抬高一点', 'mm')).toEqual([]);
    expect(extractNumericConstraints('选择第 2 个部件', 'mm')).toEqual([]);
  });

  it('normalizes supported Chinese and ASCII units without changing the stated value', () => {
    expect(extractNumericConstraints('移动 2厘米，旋转 0.5 rad', 'mm')).toMatchObject([
      { numericKey: 'n1', kind: 'distance', value: 2, unit: 'cm' },
      { numericKey: 'n2', kind: 'angle', value: 0.5, unit: 'rad' },
    ]);
    expect(extractNumericConstraints('move 4 millimeters, rotate 12 deg', 'cm')).toMatchObject([
      { numericKey: 'n1', kind: 'distance', value: 4, unit: 'mm' },
      { numericKey: 'n2', kind: 'angle', value: 12, unit: 'deg' },
    ]);
  });

  it('extracts an explicit coordinate pair as one bounded constraint', () => {
    expect(extractNumericConstraints('把中心放到坐标 (10, -20) mm', 'cm')).toEqual([{
      numericKey: 'n1',
      kind: 'coordinate',
      value: [10, -20],
      unit: 'mm',
      userEvidenceSpan: { start: 8, end: 20, text: '(10, -20) mm' },
    }]);
  });

  it('rejects non-finite explicit values and caps evidence at sixteen constraints', () => {
    expect(() => extractNumericConstraints('移动 1e999 mm', 'mm')).toThrow('EDIT_NUMERIC_VALUE_INVALID');
    const many = Array.from({ length: 17 }, () => '移动 1 mm').join('，');
    const result = extractNumericConstraints(many, 'mm');
    expect(result).toHaveLength(16);
    expect(result.at(-1)?.numericKey).toBe('n16');
  });
});
