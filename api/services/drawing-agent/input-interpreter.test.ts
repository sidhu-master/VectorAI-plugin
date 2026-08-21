import { describe, expect, it } from 'vitest';
import { interpretDrawingInput, referencesCurrentSelection } from './input-interpreter';

describe('Drawing Agent combined-input interpreter', () => {
  const cases: Array<[
    { goal: string; hasSource: boolean; attachmentPurpose: 'reference' | 'drawing-source' },
    { mode: 'text_only' | 'analyze_only' | 'reconstruct' | 'reconstruct_then_modify'; modificationGoal: string | null },
  ]> = [
    [{ goal: '创建一个圆', hasSource: false, attachmentPurpose: 'reference' }, { mode: 'text_only', modificationGoal: '创建一个圆' }],
    [{ goal: '', hasSource: true, attachmentPurpose: 'reference' }, { mode: 'text_only', modificationGoal: '' }],
    [{ goal: '把右手抬起来', hasSource: true, attachmentPurpose: 'reference' }, { mode: 'text_only', modificationGoal: '把右手抬起来' }],
    [{ goal: '', hasSource: true, attachmentPurpose: 'drawing-source' }, { mode: 'reconstruct', modificationGoal: null }],
    [{ goal: '分析这张图纸的结构', hasSource: true, attachmentPurpose: 'drawing-source' }, { mode: 'analyze_only', modificationGoal: null }],
    [{ goal: '先分析图纸，再把所有圆孔改成半径 8mm', hasSource: true, attachmentPurpose: 'drawing-source' }, {
      mode: 'reconstruct_then_modify', modificationGoal: '把所有圆孔改成半径 8mm',
    }],
    [{ goal: '根据这张图创建可编辑图纸', hasSource: true, attachmentPurpose: 'drawing-source' }, {
      mode: 'reconstruct', modificationGoal: null,
    }],
  ];
  it.each(cases)('uses the structured attachment purpose for %#', (input, expected) => {
    expect(interpretDrawingInput(input)).toEqual(expected);
  });
});

describe('Drawing Agent selection reference', () => {
  it.each([
    ['把右手抬起来打招呼', false],
    ['修改选中的对象', true],
    ['把所选图元向右移动 10mm', true],
    ['rotate the selected geometry', true],
  ])('classifies %s as explicit=%s', (goal, expected) => {
    expect(referencesCurrentSelection(goal)).toBe(expected);
  });
});
