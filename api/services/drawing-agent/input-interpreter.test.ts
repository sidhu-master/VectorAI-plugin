import { describe, expect, it } from 'vitest';
import { interpretDrawingInput } from './input-interpreter';

describe('Drawing Agent combined-input interpreter', () => {
  it.each([
    [{ goal: '创建一个圆', hasSource: false }, { mode: 'text_only', modificationGoal: '创建一个圆' }],
    [{ goal: '', hasSource: true }, { mode: 'reconstruct', modificationGoal: null }],
    [{ goal: '分析这张图纸的结构', hasSource: true }, { mode: 'analyze_only', modificationGoal: null }],
    [{ goal: '先分析图纸，再把所有圆孔改成半径 8mm', hasSource: true }, {
      mode: 'reconstruct_then_modify', modificationGoal: '把所有圆孔改成半径 8mm',
    }],
    [{ goal: '根据这张图创建可编辑图纸', hasSource: true }, {
      mode: 'reconstruct', modificationGoal: null,
    }],
  ])('classifies %# without a user-facing switch', (input, expected) => {
    expect(interpretDrawingInput(input)).toEqual(expected);
  });
});
