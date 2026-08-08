export type DrawingInputMode =
  | 'text_only'
  | 'analyze_only'
  | 'reconstruct'
  | 'reconstruct_then_modify';

export interface DrawingInputInterpretation {
  mode: DrawingInputMode;
  modificationGoal: string | null;
}

const ANALYSIS_PATTERN = /分析|识别|检查|看看|说明|理解|analy[sz]e|inspect|explain/i;
const MODIFY_PATTERN = /修改|改成|改为|改到|删除|移除|添加|新增|移动|调整|替换|放大|缩小|旋转|对齐|modify|change|delete|remove|add|move|adjust|replace|resize|rotate|align/i;

export function interpretDrawingInput(input: {
  goal: string;
  hasSource: boolean;
}): DrawingInputInterpretation {
  const goal = input.goal.trim();
  if (!input.hasSource) return { mode: 'text_only', modificationGoal: goal };
  if (!goal) return { mode: 'reconstruct', modificationGoal: null };
  if (MODIFY_PATTERN.test(goal)) {
    const clauses = goal.split(/(?:然后|再|之后|then)/i).map((item) => item.trim()).filter(Boolean);
    return {
      mode: 'reconstruct_then_modify',
      modificationGoal: clauses.at(-1) ?? goal,
    };
  }
  if (ANALYSIS_PATTERN.test(goal)) return { mode: 'analyze_only', modificationGoal: null };
  return { mode: 'reconstruct', modificationGoal: null };
}
