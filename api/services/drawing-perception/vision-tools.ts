import {
  requestDrawingVisionCompletion,
  type DrawingVisionCompletionParams,
} from '../ai-gateway.js';
import {
  validateAnnotationObservation,
  validateDrawingManifest,
  validateGeometryObservation,
} from './validate.js';
import type {
  AnnotationObservation,
  DrawingView,
  GeometryObservation,
} from './types.js';

export type DrawingVisionToolName =
  | 'analyze_sheet'
  | 'segment_views'
  | 'detect_datums'
  | 'detect_geometry'
  | 'extract_annotations';

export interface DrawingVisionToolInput {
  runId: string;
  page: number;
  viewId?: string;
  modelName: string;
  image: string;
  mimeType: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingVisionCompletionInput extends DrawingVisionCompletionParams {
  tool: DrawingVisionToolName;
}

export type DrawingVisionCompletion = (
  input: DrawingVisionCompletionInput,
) => Promise<string>;

export interface SheetAnalysis {
  unit?: 'mm' | 'cm' | 'm';
  scale?: number;
  warnings: string[];
}

const PROMPTS: Record<DrawingVisionToolName, { system: string; user: string }> = {
  analyze_sheet: {
    system: '你是二维工程图纸页分析器。只输出 JSON，不识别具体对象，不输出图片或推理过程。',
    user: '识别单位、图纸比例和页级警告。输出 {"unit"?:"mm"|"cm"|"m","scale"?:number,"warnings":string[]}。',
  },
  segment_views: {
    system: '你是二维工程图视图区分器。按视图边界而非对象名称拆分，只输出 JSON。所有坐标归一化到 0-1。',
    user: '输出 {"views":[{"id":string,"kind":"primary"|"section"|"detail"|"auxiliary"|"unknown","imageBounds":[x,y,w,h],"confidence":number}]}。',
  },
  detect_datums: {
    system: '你是二维 CAD 基准几何检测器。只识别 point、line、ray、xline，只输出 JSON，缺失参数不得猜测。',
    user: `只输出以下 JSON 契约：
{"observations":[{"id":"datum_<viewId>_001","viewId":"<输入中的精确 viewId>","type":"line","imageBounds":[x,y,width,height],"measuredParams":{"start":[x,y],"end":[x,y]},"confidence":0.9}]}
所有坐标、长度和 imageBounds 均相对当前裁剪图归一化到 0-1。type 与 measuredParams 只允许：
- point: {"x":number,"y":number}
- line: {"start":[x,y],"end":[x,y]}
- ray/xline: {"origin":[x,y],"direction":[dx,dy]}
每项必须包含 id、viewId、type、imageBounds、measuredParams、confidence；无法给出完整参数就不输出该项。`,
  },
  detect_geometry: {
    system: '你是二维 CAD 显式几何检测器。支持 point,line,ray,xline,circle,arc,ellipse,polyline,spline；不输出 text、dimension、图层、图块或填充。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"observations":[{"id":"geom_<viewId>_001","viewId":"<输入中的精确 viewId>","type":"circle","imageBounds":[x,y,width,height],"measuredParams":{"center":[x,y],"radius":number},"confidence":0.9}]}
所有坐标、长度和 imageBounds 均相对当前裁剪图归一化到 0-1。type 与 measuredParams 只允许：
- point {"x":number,"y":number}
- line {"start":[x,y],"end":[x,y]}
- ray/xline {"origin":[x,y],"direction":[dx,dy]}
- circle {"center":[x,y],"radius":number}
- arc {"center":[x,y],"radius":number,"startAngle":degree,"endAngle":degree,"counterClockwise":boolean}
- ellipse {"center":[x,y],"majorAxis":[dx,dy],"ratio":0_to_1}
- polyline {"vertices":[[x,y],...],"closed":boolean}
- spline {"degree":integer,"controlPoints":[[x,y],...],"knots":[number,...],"closed":boolean,"periodic":boolean}
每项必须包含 id、viewId、type、imageBounds、measuredParams、confidence。不要输出语义对象或嵌套 geometry；无法给出完整 CAD 参数就省略该项。`,
  },
  extract_annotations: {
    system: '你是工程图 OCR 与尺寸标注提取器。保留 R、Ø、°、± 和原始文本；不把尺寸绑定到几何。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"annotations":[{"id":"ann_<viewId>_001","viewId":"<输入中的精确 viewId>","kind":"diameter","rawText":"Ø10 ±0.1","value":10,"unit":"mm","tolerance":{"upper":0.1,"lower":-0.1},"imageBounds":[x,y,width,height],"arrowheads":[[x,y]],"confidence":0.9}]}
kind 只允许 text、linear、aligned、angular、radius、diameter、ordinate、arc-length。所有 imageBounds 和 arrowheads 相对当前裁剪图归一化到 0-1。text 可省略 value/unit/tolerance，其他项无法可靠解析 value 时也可省略 value，但每项必须包含 id、viewId、kind、rawText、imageBounds、arrowheads、confidence。不得输出图片或绑定的几何对象。`,
  },
};

export class DrawingVisionOutputError extends Error {
  constructor(public readonly tool: DrawingVisionToolName, public readonly errors: string[]) {
    super(`${tool} 输出无效: ${errors.join('; ')}`);
    this.name = 'DrawingVisionOutputError';
  }
}

export class DrawingVisionTools {
  constructor(
    private readonly complete: DrawingVisionCompletion = requestDrawingVisionCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async analyzeSheet(input: DrawingVisionToolInput): Promise<SheetAnalysis> {
    const output = await this.call('analyze_sheet', input);
    const record = asRecord(output);
    const analysis: SheetAnalysis = {
      ...(record?.unit === undefined ? {} : { unit: record.unit as SheetAnalysis['unit'] }),
      ...(record?.scale === undefined ? {} : { scale: record.scale as number }),
      warnings: Array.isArray(record?.warnings) ? record.warnings as string[] : [],
    };
    const validation = validateDrawingManifest({
      runId: input.runId,
      page: input.page,
      unit: analysis.unit,
      scale: analysis.scale,
      views: [],
      warnings: analysis.warnings,
    });
    if (!record || !Array.isArray(record.warnings) || !validation.valid) {
      throw new DrawingVisionOutputError('analyze_sheet', [
        ...(!record ? ['响应必须是对象'] : []),
        ...(!Array.isArray(record?.warnings) ? ['warnings 必须是数组'] : []),
        ...validation.errors,
      ]);
    }
    return analysis;
  }

  async segmentViews(input: DrawingVisionToolInput): Promise<DrawingView[]> {
    const output = asRecord(await this.call('segment_views', input));
    const views = output?.views;
    const validation = validateDrawingManifest({
      runId: input.runId, page: input.page, views, warnings: [],
    });
    if (!validation.valid) throw new DrawingVisionOutputError('segment_views', validation.errors);
    return structuredClone(views as DrawingView[]);
  }

  detectDatums(input: DrawingVisionToolInput): Promise<GeometryObservation[]> {
    return this.readGeometry('detect_datums', input, new Set(['point', 'line', 'ray', 'xline']));
  }

  detectGeometry(input: DrawingVisionToolInput): Promise<GeometryObservation[]> {
    return this.readGeometry('detect_geometry', input);
  }

  async extractAnnotations(input: DrawingVisionToolInput): Promise<AnnotationObservation[]> {
    const output = asRecord(await this.call('extract_annotations', input));
    const annotations = output?.annotations;
    if (!Array.isArray(annotations)) {
      throw new DrawingVisionOutputError('extract_annotations', ['annotations 必须是数组']);
    }
    const errors = annotations.flatMap((annotation, index) =>
      validateAnnotationObservation(annotation).errors.map((error) => `annotations[${index}]: ${error}`));
    if (errors.length > 0) throw new DrawingVisionOutputError('extract_annotations', errors);
    return structuredClone(annotations as AnnotationObservation[]);
  }

  private async readGeometry(
    tool: 'detect_datums' | 'detect_geometry',
    input: DrawingVisionToolInput,
    allowedTypes?: Set<string>,
  ): Promise<GeometryObservation[]> {
    const output = asRecord(await this.call(tool, input));
    const observations = output?.observations;
    if (!Array.isArray(observations)) {
      throw new DrawingVisionOutputError(tool, ['observations 必须是数组']);
    }
    const errors = observations.flatMap((observation, index) => {
      const item = asRecord(observation);
      const itemErrors = validateGeometryObservation(observation).errors;
      if (itemErrors.length > 0 && item) {
        itemErrors.push(`received fields [${Object.keys(item).sort().join(', ')}]`);
      }
      if (allowedTypes && item && !allowedTypes.has(item.type as string)) {
        itemErrors.push(`type "${String(item.type)}" 不是 datum 类型`);
      }
      return itemErrors.map((error) => `observations[${index}]: ${error}`);
    });
    if (errors.length > 0) throw new DrawingVisionOutputError(tool, errors);
    return structuredClone(observations as GeometryObservation[]);
  }

  private async call(tool: DrawingVisionToolName, input: DrawingVisionToolInput): Promise<unknown> {
    if (this.now() >= input.deadlineAt) throw new Error(`${tool} deadline exceeded`);
    const prompt = PROMPTS[tool];
    const reply = await this.complete({
      tool,
      modelName: input.modelName,
      systemPrompt: prompt.system,
      userPrompt: `${prompt.user}\nrunId=${input.runId}; page=${input.page}; viewId=${input.viewId ?? 'page'}`,
      image: input.image,
      mimeType: input.mimeType,
      signal: input.signal,
    });
    try {
      return parseJsonReply(reply);
    } catch (error) {
      throw new DrawingVisionOutputError(tool, [
        error instanceof Error ? error.message : String(error),
      ]);
    }
  }
}

function parseJsonReply(reply: string): unknown {
  const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('响应中没有 JSON 对象');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
