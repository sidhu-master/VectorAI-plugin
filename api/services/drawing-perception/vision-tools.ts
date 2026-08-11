import {
  requestDrawingVisionCompletion,
  type DrawingVisionCompletionParams,
} from '../ai-gateway.js';
import {
  validateAnnotationObservation,
  validateContourEvidence,
  validateDrawingManifest,
  validateGlobalContour,
  validateGeometryObservation,
} from './validate.js';
import type {
  AnnotationObservation,
  ContourEvidence,
  DrawingView,
  GeometryObservation,
  GlobalContour,
} from './types.js';
import type { NormalizedImageBounds } from './types.js';
import type { DrawingCoverageAssessment } from './coverage.js';

export type DrawingVisionToolName =
  | 'analyze_sheet'
  | 'segment_views'
  | 'detect_datums'
  | 'detect_geometry'
  | 'detect_global_contours'
  | 'detect_contour_evidence'
  | 'detect_regional_geometry'
  | 'extract_annotations'
  | 'assess_coverage';

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

export interface DrawingCoverageContext {
  globalContours: Array<{
    id: string;
    geometryFamily: string;
    imageBounds: NormalizedImageBounds;
  }>;
  contourEvidence: Array<{
    globalContourId: string;
    imageBounds: NormalizedImageBounds;
  }>;
  standaloneGeometry: Array<{ type: string; imageBounds: NormalizedImageBounds }>;
  annotations: Array<{ kind: string; imageBounds: NormalizedImageBounds }>;
}

export interface DrawingRegionalGeometryContext {
  mode: 'regional_standalone';
  globalContours: Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>>;
}

export interface DrawingRegionalGeometryRead {
  geometry: GeometryObservation[];
  evidence: ContourEvidence[];
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
点坐标的 x 按裁剪图宽度归一化、y 按裁剪图高度归一化；方向向量使用同一像素坐标基底；imageBounds 相对裁剪图归一化到 0-1。type 与 measuredParams 只允许：
- point: {"x":number,"y":number}
- line: {"start":[x,y],"end":[x,y]}
- ray/xline: {"origin":[x,y],"direction":[dx,dy]}
每项必须包含 id、viewId、type、imageBounds、measuredParams、confidence；无法给出完整参数就不输出该项。`,
  },
  detect_geometry: {
    system: '你是二维 CAD 显式几何检测器。支持 point,line,ray,xline,circle,arc,ellipse,polyline,spline；不输出 text、dimension、图层、图块或填充。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"observations":[{"id":"geom_<viewId>_001","viewId":"<输入中的精确 viewId>","type":"circle","imageBounds":[x,y,width,height],"measuredParams":{"center":[x,y],"radius":number},"confidence":0.9}]}
点坐标的 x 按裁剪图宽度归一化、y 按裁剪图高度归一化；radius 等标量长度按裁剪图像素宽度归一化；向量分量 x/y 分别按裁剪宽/高归一化；imageBounds 相对裁剪图归一化到 0-1。type 与 measuredParams 只允许：
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
  detect_global_contours: {
    system: '你是二维 CAD 全局轮廓检测器。输入是完整视图；先识别跨区域的完整圆、长直线、闭合轮廓和主要曲线。只输出 JSON，不输出文字尺寸、局部碎片或推理过程。',
    user: `只输出以下 JSON 契约：
{"contours":[{"id":"contour_001","viewId":"<输入中的精确 viewId>","geometryFamily":"circle","imageBounds":[x,y,width,height],"closed":true,"confidence":0.9,"coarseParams":{"center":[x,y],"radius":number}}]}
坐标相对完整视图归一化到 0-1。geometryFamily 只允许 point、line、ray、xline、circle、arc、ellipse、polyline、spline。一个视觉上连续的完整圆只能输出一个 circle，不能按局部可见段拆成多个 arc。coarseParams 可省略，缺失参数不得猜测。`,
  },
  detect_contour_evidence: {
    system: '你是二维 CAD 区域轮廓证据检测器。输入是完整视图的局部裁剪；只采集轮廓采样点并关联已有全局轮廓。裁剪边缘的碎片不是独立 CAD 图元。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"evidence":[{"id":"evidence_<viewId>_001","viewId":"<输入中的精确 viewId>","globalContourId":"<匹配到的全局轮廓 id>","imageBounds":[x,y,width,height],"samplePoints":[[x,y],[x,y]],"confidence":0.9,"touchesCropEdge":true}]}
所有坐标相对当前裁剪图归一化到 0-1。samplePoints 沿实际可见轮廓取样。能匹配给出的全局轮廓时必须填写其精确 id；不能可靠匹配时省略 globalContourId，交由扩大视野复核。不要把被裁剪的圆、椭圆、长线或闭合轮廓声明为独立图元。`,
  },
  detect_regional_geometry: {
    system: '你是二维 CAD 区域几何读取器。一次读取小型完整独立图元和已有全局轮廓的局部证据。裁剪片段绝不是独立 CAD 图元。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"observations":[{"id":"geom_<viewId>_001","viewId":"<输入中的精确 viewId>","type":"circle","imageBounds":[x,y,width,height],"measuredParams":{"center":[x,y],"radius":number},"confidence":0.9}],"evidence":[{"id":"evidence_<viewId>_001","viewId":"<输入中的精确 viewId>","globalContourId":"<全局轮廓 id>","imageBounds":[x,y,width,height],"samplePoints":[[x,y],[x,y]],"confidence":0.9,"touchesCropEdge":true}]}
所有坐标相对当前裁剪图归一化到 0-1。observations 只允许在裁剪中完整可见、参数完整且不属于给定全局轮廓的小型 point、line、ray、xline、circle、arc、ellipse、polyline、spline；参数契约与标准 CAD 图元一致。任何在裁剪边缘结束的线、圆弧、曲线或闭合轮廓只能放入 evidence。evidence.samplePoints 沿可见轮廓取样，能匹配时必须使用给出的精确 globalContourId，不能可靠匹配时省略该字段。`,
  },
  extract_annotations: {
    system: '你是工程图 OCR 与尺寸标注提取器。保留 R、Ø、°、± 和原始文本；不把尺寸绑定到几何。只输出 JSON。',
    user: `只输出以下 JSON 契约：
{"annotations":[{"id":"ann_<viewId>_001","viewId":"<输入中的精确 viewId>","kind":"diameter","rawText":"Ø10 ±0.1","value":10,"unit":"mm","tolerance":{"upper":0.1,"lower":-0.1},"imageBounds":[x,y,width,height],"arrowheads":[[x,y]],"confidence":0.9}]}
kind 只允许 text、linear、aligned、angular、radius、diameter、ordinate、arc-length。所有 imageBounds 和 arrowheads 相对当前裁剪图归一化到 0-1。text 可省略 value/unit/tolerance，其他项无法可靠解析 value 时也可省略 value，但每项必须包含 id、viewId、kind、rawText、imageBounds、arrowheads、confidence。不得输出图片或绑定的几何对象。`,
  },
  assess_coverage: {
    system: '你是二维工程图感知覆盖检查器。比较裁剪图与已检测摘要，只判断是否仍有未参数化的可见几何或尺寸。只输出 JSON，不输出推理过程。',
    user: `只输出以下 JSON 契约：
{"complete":boolean,"confidence":0_to_1,"unreadBounds":[[x,y,width,height]],"reasons":[string]}
unreadBounds 相对当前裁剪图归一化到 0-1，最多 16 项。若所有可见二维几何和尺寸都已被摘要覆盖，complete=true 且 unreadBounds=[]；装饰、水印、填充和颜色不计入遗漏。`,
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

  detectGeometry(
    input: DrawingVisionToolInput,
    context?: DrawingRegionalGeometryContext,
  ): Promise<GeometryObservation[]> {
    const suffix = context ? `
区域读取规则：只输出在当前裁剪中边界完整、参数完整的小型独立图元。任何在裁剪边缘结束的线、圆弧、曲线或闭合轮廓都不要输出，它们由全局轮廓证据工具处理。不要重复以下全局轮廓：${JSON.stringify(context.globalContours.slice(0, 100))}` : '';
    return this.readGeometry('detect_geometry', input, undefined, suffix);
  }

  async detectGlobalContours(input: DrawingVisionToolInput): Promise<GlobalContour[]> {
    const output = asRecord(await this.call('detect_global_contours', input));
    const contours = output?.contours;
    if (!Array.isArray(contours)) {
      throw new DrawingVisionOutputError('detect_global_contours', ['contours 必须是数组']);
    }
    const errors = contours.flatMap((contour, index) => (
      validateGlobalContour(contour).errors.map((error) => `contours[${index}]: ${error}`)
    ));
    if (errors.length > 0) throw new DrawingVisionOutputError('detect_global_contours', errors);
    return structuredClone(contours as GlobalContour[]);
  }

  async detectContourEvidence(
    input: DrawingVisionToolInput,
    contours: Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>>,
  ): Promise<ContourEvidence[]> {
    const boundedContours = contours.slice(0, 100).map((contour) => ({
      id: contour.id,
      geometryFamily: contour.geometryFamily,
      imageBounds: contour.imageBounds,
    }));
    const output = asRecord(await this.call(
      'detect_contour_evidence',
      input,
      `\n当前裁剪内可匹配的全局轮廓=${JSON.stringify(boundedContours)}`,
    ));
    const evidence = output?.evidence;
    if (!Array.isArray(evidence)) {
      throw new DrawingVisionOutputError('detect_contour_evidence', ['evidence 必须是数组']);
    }
    const errors = evidence.flatMap((item, index) => (
      validateContourEvidence(item).errors.map((error) => `evidence[${index}]: ${error}`)
    ));
    if (errors.length > 0) throw new DrawingVisionOutputError('detect_contour_evidence', errors);
    return structuredClone(evidence as ContourEvidence[]);
  }

  async detectRegionalGeometry(
    input: DrawingVisionToolInput,
    contours: Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>>,
  ): Promise<DrawingRegionalGeometryRead> {
    const boundedContours = contours.slice(0, 100).map((contour) => ({
      id: contour.id,
      geometryFamily: contour.geometryFamily,
      imageBounds: contour.imageBounds,
    }));
    const output = asRecord(await this.call(
      'detect_regional_geometry',
      input,
      `\n当前裁剪内可匹配的全局轮廓=${JSON.stringify(boundedContours)}`,
    ));
    const observations = output?.observations;
    const evidence = output?.evidence;
    const errors: string[] = [];
    if (!Array.isArray(observations)) errors.push('observations 必须是数组');
    else observations.forEach((item, index) => {
      errors.push(...validateGeometryObservation(item).errors.map(
        (error) => `observations[${index}]: ${error}`,
      ));
    });
    if (!Array.isArray(evidence)) errors.push('evidence 必须是数组');
    else evidence.forEach((item, index) => {
      errors.push(...validateContourEvidence(item).errors.map(
        (error) => `evidence[${index}]: ${error}`,
      ));
    });
    if (errors.length > 0) throw new DrawingVisionOutputError('detect_regional_geometry', errors);
    return {
      geometry: structuredClone(observations as GeometryObservation[]),
      evidence: structuredClone(evidence as ContourEvidence[]),
    };
  }

  async extractAnnotations(input: DrawingVisionToolInput): Promise<AnnotationObservation[]> {
    const output = asRecord(await this.call('extract_annotations', input));
    const annotations = output?.annotations;
    if (!Array.isArray(annotations)) {
      throw new DrawingVisionOutputError('extract_annotations', ['annotations 必须是数组']);
    }
    // 局部容错：丢弃无效条目、保留有效条目，避免单个越界项导致整批标注丢失。
    // 仅当全部条目都无效时抛错，从而触发上层重试一次。
    const errors: string[] = [];
    const valid: AnnotationObservation[] = [];
    annotations.forEach((annotation, index) => {
      const itemErrors = validateAnnotationObservation(annotation).errors;
      if (itemErrors.length > 0) {
        errors.push(`annotations[${index}]: ${itemErrors.join('; ')}`);
      } else {
        valid.push(annotation as AnnotationObservation);
      }
    });
    if (annotations.length > 0 && valid.length === 0) {
      throw new DrawingVisionOutputError('extract_annotations', errors);
    }
    return structuredClone(valid);
  }

  async assessCoverage(
    input: DrawingVisionToolInput,
    context: DrawingCoverageContext,
  ): Promise<DrawingCoverageAssessment> {
    const bounded = {
      globalContours: context.globalContours.slice(0, 100).map((item) => ({
        id: item.id, geometryFamily: item.geometryFamily, imageBounds: item.imageBounds,
      })),
      contourEvidence: context.contourEvidence.slice(0, 100).map((item) => ({
        globalContourId: item.globalContourId, imageBounds: item.imageBounds,
      })),
      standaloneGeometry: context.standaloneGeometry.slice(0, 100).map((item) => ({
        type: item.type, imageBounds: item.imageBounds,
      })),
      annotations: context.annotations.slice(0, 100).map((item) => ({
        kind: item.kind, imageBounds: item.imageBounds,
      })),
    };
    const record = asRecord(await this.call(
      'assess_coverage',
      input,
      `\n已检测摘要=${JSON.stringify(bounded)}`,
    ));
    const errors = validateCoverageAssessment(record);
    if (errors.length > 0) throw new DrawingVisionOutputError('assess_coverage', errors);
    return structuredClone(record as unknown as DrawingCoverageAssessment);
  }

  private async readGeometry(
    tool: 'detect_datums' | 'detect_geometry',
    input: DrawingVisionToolInput,
    allowedTypes?: Set<string>,
    userSuffix = '',
  ): Promise<GeometryObservation[]> {
    const output = asRecord(await this.call(tool, input, userSuffix));
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

  private async call(
    tool: DrawingVisionToolName,
    input: DrawingVisionToolInput,
    userSuffix = '',
  ): Promise<unknown> {
    if (this.now() >= input.deadlineAt) throw new Error(`${tool} deadline exceeded`);
    const prompt = PROMPTS[tool];
    const reply = await this.complete({
      tool,
      modelName: input.modelName,
      systemPrompt: prompt.system,
      userPrompt: `${prompt.user}\nrunId=${input.runId}; page=${input.page}; viewId=${input.viewId ?? 'page'}${userSuffix}`,
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

function validateCoverageAssessment(record: Record<string, unknown> | undefined): string[] {
  if (!record) return ['响应必须是对象'];
  const errors: string[] = [];
  const keys = Object.keys(record).sort();
  const expected = ['complete', 'confidence', 'reasons', 'unreadBounds'];
  if (keys.join(',') !== expected.join(',')) errors.push('字段必须且只能包含 complete、confidence、unreadBounds、reasons');
  if (typeof record.complete !== 'boolean') errors.push('complete 必须是 boolean');
  if (typeof record.confidence !== 'number' || !Number.isFinite(record.confidence)
    || record.confidence < 0 || record.confidence > 1) errors.push('confidence 必须位于 0-1');
  if (!Array.isArray(record.unreadBounds) || record.unreadBounds.length > 16) {
    errors.push('unreadBounds 必须是最多 16 项的数组');
  } else {
    record.unreadBounds.forEach((bounds, index) => {
      if (!validNormalizedBounds(bounds)) errors.push(`unreadBounds[${index}] 必须位于 0-1`);
    });
  }
  if (!Array.isArray(record.reasons) || record.reasons.length > 20
    || record.reasons.some((reason) => typeof reason !== 'string')) {
    errors.push('reasons 必须是最多 20 项的字符串数组');
  }
  return errors;
}

function validNormalizedBounds(value: unknown): value is NormalizedImageBounds {
  if (!Array.isArray(value) || value.length !== 4
    || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) return false;
  const [x, y, width, height] = value as number[];
  return x >= 0 && y >= 0 && width > 0 && height > 0
    && x + width <= 1 && y + height <= 1;
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
