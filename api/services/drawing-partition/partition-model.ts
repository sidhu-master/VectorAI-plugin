/**
 * 图纸分区的模型适配层：
 * 代码确定性检测台阶面候选（垂直/水平线段位置），模型只做语义判断--
 * 选轴向、为每个分区选起止台阶面锚点、结合文档为分区命名；
 * 分区多边形由代码按锚点确定性计算。
 */
import {
  requestDrawingMultimodalCompletion,
  type DrawingModelCallTelemetry,
} from '../ai-gateway.js';

/** 台阶面候选（两个轴向的归一化位置，由代码从几何图元精确检测） */
export interface StepCandidates {
  x: number[];
  y: number[];
}

/** 模型输出的分区方案（纯语义判断）：每个分区的起止锚点（归一化，start < end）。 */
export interface RawPartitionPlan {
  /** 台阶展开方向：'x' 水平轴向、'y' 垂直轴向 */
  axis: 'x' | 'y';
  /** 分区列表（沿 axis 顺序） */
  regions: Array<{
    name: string;
    basis: string;
    /** 归一化起点（0~1） */
    start: number;
    /** 归一化终点（0~1） */
    end: number;
  }>;
}

/** 已有分区的归一化范围（供模型参考修改意见时保持连续） */
export interface ExistingPartitionSummary {
  name: string;
  basis: string;
  /** 归一化 u 范围（u 向右） */
  uRange: [number, number];
  /** 归一化 v 范围（v 向下） */
  vRange: [number, number];
}

export interface PartitionModelInput {
  /** 图纸渲染图（几何已矢量化后渲染，锚点以它为坐标基准） */
  primaryImage: { id: string; dataUrl: string };
  /** 原始图纸附件（图片/PDF 导入时提供，供模型参考原始台阶细节） */
  sourceImage?: { id: string; dataUrl: string };
  /** 渲染图覆盖的世界范围 */
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** 代码检测的台阶面候选（归一化位置，精确落在几何突变处） */
  stepCandidates: StepCandidates;
  /** 图元统计摘要 */
  geometrySummary: string;
  /** 用户补充信息（文字 + 补充文档文本） */
  supplements: string;
  /** 当前已生效分区（用户提出修改意见时提供） */
  existingPartitions?: ExistingPartitionSummary[];
  /** 用户对现有分区的修改意见 */
  feedback?: string;
  signal: AbortSignal;
  onTelemetry?: (telemetry: DrawingModelCallTelemetry) => void;
}

export interface DrawingPartitionModelAdapter {
  partition(input: PartitionModelInput): Promise<RawPartitionPlan>;
}

export const PARTITION_SYSTEM_PROMPT = [
  '你是工程图纸分区专家。系统已从图纸几何中精确检测出台阶面候选（垂直/水平于分区轴的线段位置，全部落在几何突变处），你只做语义判断：',
  '1. 判断分区轴向 axis："x"（水平左右方向）或 "y"（垂直上下方向）。',
  '2. 为每个分区指定起止台阶面：startEdge 为起始台阶面候选的索引，endEdge 为终止台阶面候选的索引；图纸最边缘用 -1 表示（第一个分区的 startEdge 通常为 -1，最后一个分区的 endEdge 通常为 -1）。相邻分区应首尾衔接（前一分区的 endEdge 等于后一分区的 startEdge）。',
  '3. 按轴向顺序为每个分区给出 name、basis。所选轴向存在候选时必须用 startEdge/endEdge 锚定边界，禁止自行估计坐标；仅当所选轴向无候选时，才用 cuts 给出所有分区边界（含首 0 与尾 1 的完整边界数组，相邻分区共用边界）。',
  '分区方案优先级（必须遵守）：',
  'A. 若补充信息/文档明确定义了分区方案（如区域编号、名称、数量、位置或分区依据），必须严格按该方案分区：一个文档区域对应一个分区，分区数与文档区域数一致，不得自行增加、合并或拆分文档区域；name 优先采用文档中的区域名称/编号（如“左轴承位B01”）；起止锚点选择与文档区域边界最吻合的台阶面候选。',
  'B. 仅当文档未定义分区方案、或图纸存在文档未覆盖的区域时，才按台阶特征自行分区：锚点选在台阶特征突变处，并为每个分区命名（简短中文，如“左轴承台阶区”）。',
  '4. basis 需一句话说明依据，引用文档区域时应写明“对应文档XX区域”。',
  '5. 只输出 JSON：{"axis":"x"或"y","partitions":[{"name":string,"basis":string,"startEdge":int,"endEdge":int},...],"cuts":[number,...]}，分区总数 2~12；使用锚点时 cuts 为空数组。',
  '6. 若提供了已有分区与修改意见，尽量保持分区编号与命名连续，仅按意见调整对应锚点或属性。',
].join('\n');

const PARTITION_RESPONSE_SCHEMA = {
  name: 'drawing_partition_plan',
  schema: {
    type: 'object',
    properties: {
      axis: { type: 'string', enum: ['x', 'y'] },
      partitions: {
        type: 'array',
        minItems: 2,
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 24 },
            basis: { type: 'string', maxLength: 120 },
            startEdge: { type: 'integer', minimum: -1, maximum: 63 },
            endEdge: { type: 'integer', minimum: -1, maximum: 63 },
          },
          required: ['name', 'basis', 'startEdge', 'endEdge'],
        },
      },
      cuts: {
        type: 'array',
        minItems: 0,
        maxItems: 13,
        items: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    required: ['axis', 'partitions'],
  },
};

export class GatewayDrawingPartitionModel implements DrawingPartitionModelAdapter {
  readonly #modelName: string;

  constructor(input: { modelName: string }) {
    this.#modelName = input.modelName;
  }

  async partition(input: PartitionModelInput): Promise<RawPartitionPlan> {
    const images = input.sourceImage
      ? [input.primaryImage, input.sourceImage]
      : [input.primaryImage];
    const userPrompt = buildPartitionPrompt(input);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await requestDrawingMultimodalCompletion({
        role: 'design',
        modelName: this.#modelName,
        systemPrompt: PARTITION_SYSTEM_PROMPT,
        userPrompt,
        images,
        responseSchema: PARTITION_RESPONSE_SCHEMA,
        // 分区只需语义判断：禁用深度思考，避免上万 reasoning token 拖慢响应
        thinkingDisabled: true,
        signal: input.signal,
        onTelemetry: input.onTelemetry,
      });
      const parsed = parsePartitionReply(raw, input.stepCandidates);
      if (parsed !== null) return parsed;
    }
    throw new Error('PARTITION_MODEL_INVALID_RESPONSE');
  }
}

export function buildPartitionPrompt(input: PartitionModelInput): string {
  const lines: string[] = [];
  const width = input.worldBounds.maxX - input.worldBounds.minX;
  const height = input.worldBounds.maxY - input.worldBounds.minY;
  lines.push(`图纸世界范围：宽 ${width.toFixed(2)} × 高 ${height.toFixed(2)}（左下角 (${input.worldBounds.minX.toFixed(2)}, ${input.worldBounds.minY.toFixed(2)})）。`);
  lines.push(`图元概况：${input.geometrySummary}。`);
  lines.push(`图像引用 ${input.primaryImage.id} 为该图纸的几何渲染图（归一化坐标以它为基准，u 向右、v 向下）。`);
  if (input.sourceImage) {
    lines.push(`图像引用 ${input.sourceImage.id} 为用户上传的原始图纸，仅供参考台阶细节，不作为坐标基准。`);
  }
  lines.push('系统检测的台阶面候选（索引:归一化位置，精确落在几何突变处，锚点必须从中选择）：');
  lines.push(`- axis "x"（垂直于 x 轴的台阶面）：${formatCandidates(input.stepCandidates.x)}`);
  lines.push(`- axis "y"（垂直于 y 轴的台阶面）：${formatCandidates(input.stepCandidates.y)}`);
  if (input.existingPartitions?.length) {
    lines.push(`当前已有分区（含归一化范围 uRange/vRange）：${JSON.stringify(input.existingPartitions)}。`);
  }
  if (input.feedback) {
    lines.push(`用户修改意见：${input.feedback}`);
  }
  lines.push(`用户补充信息/文档（若其中定义了区域划分（编号/名称/数量/位置），分区方案必须严格以此为准）：${input.supplements || '（无，请按台阶几何特征分区）'}`);
  lines.push('请输出分区方案 JSON（axis + partitions（含 startEdge/endEdge 锚点））。');
  return lines.join('\n');
}

export function parsePartitionReply(
  raw: string,
  candidates: StepCandidates,
): RawPartitionPlan | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      axis?: unknown;
      partitions?: unknown;
      cuts?: unknown;
    };
    if (parsed.axis !== 'x' && parsed.axis !== 'y') return null;
    if (!Array.isArray(parsed.partitions)) return null;
    const axisCandidates = parsed.axis === 'x' ? candidates.x : candidates.y;
    const regions: RawPartitionPlan['regions'] = [];
    for (const item of parsed.partitions) {
      if (typeof item !== 'object' || item === null) return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim().slice(0, 24) : '';
      const basis = typeof record.basis === 'string' ? record.basis.trim().slice(0, 120) : '';
      if (!name) return null;
      let start: number;
      let end: number;
      if (axisCandidates.length > 0) {
        const startEdge = Number(record.startEdge);
        const endEdge = Number(record.endEdge);
        if (!Number.isInteger(startEdge) || !Number.isInteger(endEdge)) return null;
        const startValue = startEdge < 0 ? 0 : axisCandidates[startEdge];
        const endValue = endEdge < 0 ? 1 : axisCandidates[endEdge];
        if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;
        start = startValue;
        end = endValue;
      } else if (Array.isArray(parsed.cuts) && parsed.cuts.length >= 2) {
        const cuts = parsed.cuts.map((value) => Number(value)).filter(Number.isFinite);
        const index = regions.length;
        if (index >= cuts.length - 1) return null;
        start = cuts[index];
        end = cuts[index + 1];
      } else {
        return null;
      }
      if (end - start < 0.01) return null;
      regions.push({
        name,
        basis,
        start: Math.max(0, Math.min(1, start)),
        end: Math.max(0, Math.min(1, end)),
      });
    }
    if (regions.length < 2 || regions.length > 12) return null;
    return { axis: parsed.axis, regions };
  } catch {
    return null;
  }
}

function formatCandidates(values: number[]): string {
  if (values.length === 0) return '（无候选，改用 cuts 给出完整边界数组）';
  return values.map((value, index) => `${index}:${value.toFixed(3)}`).join(', ');
}
