import { createHash } from 'node:crypto';

import type {
  CvEvidenceDraft,
  CvEvidenceStore,
  CvPrimitiveType,
  CvSourceImage,
  CvToolBudget,
  DrawingCvProvider,
  SourcePixelPoint,
  SourcePixelRect,
} from './types.js';
import type { CvCropSummary } from './crop-store.js';

export type CvToolCapability =
  | 'inspect_source_overview'
  | 'inspect_source_crop'
  | 'create_observation_region'
  | 'cv_extract_evidence'
  | 'cv_read_evidence_page'
  | 'cv_fit_primitive'
  | 'compare_region';

export interface CvObservationRegion {
  id: string;
  sourceId: string;
  bounds: SourcePixelRect;
  purpose: 'inventory' | 'geometry' | 'topology' | 'annotation' | 'verification';
  targetSlotIds: string[];
  parentRegionId?: string;
  resolutionLevel: number;
  attempt: number;
}

export interface CvToolInvocation {
  toolCallId: string;
  capability: CvToolCapability;
  runId: string;
  input: unknown;
  signal: AbortSignal;
}

export interface CvToolReceipt {
  schemaVersion: 1;
  toolCallId: string;
  capability: CvToolCapability;
  capabilityVersion: '1.0.0';
  runId: string;
  inputDigest: string;
  outputDigest?: string;
  sourceId?: string;
  regionId?: string;
  slotIds: string[];
  evidenceHandles: string[];
  durationMs: number;
  budget?: CvToolBudget;
  status: 'succeeded' | 'rejected' | 'failed';
  errorCodes: string[];
  retry: { allowed: boolean; action?: 'retry' | 'replan' | 'pause' };
}

export interface CvToolExecution {
  receipt: CvToolReceipt;
  output?: unknown;
}

export interface CvRegionGateway {
  create(region: CvObservationRegion): Promise<CvObservationRegion>;
  read(regionId: string): Promise<CvObservationRegion>;
}

export interface CvSourceGateway {
  read(sourceId: string): Promise<CvSourceImage>;
}

export interface CvCropGateway {
  create(input: {
    source: CvSourceImage;
    regionId: string;
    bounds: SourcePixelRect;
    maxPixels: number;
  }): Promise<CvCropSummary>;
}

export interface CvRegionComparator {
  compare(input: {
    sourceId: string;
    regionId: string;
    revision: string;
    signal: AbortSignal;
  }): Promise<unknown>;
}

type ParsedInvocation =
  | { capability: 'inspect_source_overview'; sourceId: string; budget: CvToolBudget }
  | { capability: 'inspect_source_crop'; sourceId: string; regionId: string; budget: CvToolBudget }
  | { capability: 'create_observation_region'; region: CvObservationRegion }
  | {
      capability: 'cv_extract_evidence';
      sourceId: string;
      regionId: string;
      budget: CvToolBudget;
    }
  | { capability: 'cv_read_evidence_page'; handle: string; offset: number; limit: number }
  | {
      capability: 'cv_fit_primitive';
      handle: string;
      primitiveType: CvPrimitiveType;
      budget: CvToolBudget;
    }
  | { capability: 'compare_region'; sourceId: string; regionId: string; revision: string };

export const CV_TOOL_BUDGETS = Object.freeze({
  inspect_source_overview: Object.freeze({
    maxPixels: 2_000_000, maxResults: 256, maxSamplesPerResult: 2_048, timeoutMs: 10_000,
  }),
  inspect_source_crop: Object.freeze({
    maxPixels: 2_000_000, maxResults: 8, maxSamplesPerResult: 2_048, timeoutMs: 10_000,
  }),
  cv_extract_evidence: Object.freeze({
    maxPixels: 1_000_000, maxResults: 16, maxSamplesPerResult: 2_048, timeoutMs: 10_000,
  }),
  cv_fit_primitive: Object.freeze({
    maxPixels: 1_000_000, maxResults: 16, maxSamplesPerResult: 2_048, timeoutMs: 10_000,
  }),
} satisfies Record<
  'inspect_source_overview' | 'inspect_source_crop' | 'cv_extract_evidence' | 'cv_fit_primitive',
  CvToolBudget
>);

export class DrawingCvToolRegistry {
  readonly #provider: DrawingCvProvider;
  readonly #evidenceStore: CvEvidenceStore;
  readonly #sources: CvSourceGateway;
  readonly #regions: CvRegionGateway;
  readonly #crops: CvCropGateway;
  readonly #comparator?: CvRegionComparator;
  readonly #now: () => number;

  constructor(input: {
    provider: DrawingCvProvider;
    evidenceStore: CvEvidenceStore;
    sources: CvSourceGateway;
    regions: CvRegionGateway;
    crops: CvCropGateway;
    comparator?: CvRegionComparator;
    now?: () => number;
  }) {
    this.#provider = input.provider;
    this.#evidenceStore = input.evidenceStore;
    this.#sources = input.sources;
    this.#regions = input.regions;
    this.#crops = input.crops;
    this.#comparator = input.comparator;
    this.#now = input.now ?? Date.now;
  }

  async invoke(invocation: CvToolInvocation): Promise<CvToolExecution> {
    const startedAt = this.#now();
    const inputDigest = digest(invocation.input);
    let parsed: ParsedInvocation;
    try {
      parsed = parseInvocation(invocation.capability, invocation.input);
    } catch (error) {
      const code = errorCode(error);
      return this.#failure(
        invocation,
        startedAt,
        inputDigest,
        code === 'CV_BUDGET_EXCEEDED' ? code : 'INVALID_TOOL_INPUT',
        'rejected',
      );
    }

    try {
      switch (parsed.capability) {
        case 'inspect_source_overview': {
          const source = await this.#sources.read(parsed.sourceId);
          const output = await this.#provider.inspectOverview({
            source,
            budget: parsed.budget,
            signal: invocation.signal,
          });
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: parsed.sourceId,
            budget: parsed.budget,
          });
        }
        case 'inspect_source_crop': {
          const [source, region] = await Promise.all([
            this.#sources.read(parsed.sourceId),
            this.#regions.read(parsed.regionId),
          ]);
          if (region.sourceId !== parsed.sourceId) throw codedError('CV_REGION_SOURCE_MISMATCH');
          const output = await this.#crops.create({
            source,
            regionId: region.id,
            bounds: region.bounds,
            maxPixels: parsed.budget.maxPixels,
          });
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: parsed.sourceId,
            regionId: region.id,
            slotIds: region.targetSlotIds,
            budget: parsed.budget,
          });
        }
        case 'create_observation_region': {
          const source = await this.#sources.read(parsed.region.sourceId);
          assertRegionWithinSource(parsed.region.bounds, source);
          const output = await this.#regions.create(parsed.region);
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: output.sourceId,
            regionId: output.id,
            slotIds: output.targetSlotIds,
          });
        }
        case 'cv_extract_evidence': {
          const [source, region] = await Promise.all([
            this.#sources.read(parsed.sourceId),
            this.#regions.read(parsed.regionId),
          ]);
          if (region.sourceId !== parsed.sourceId) throw codedError('CV_REGION_SOURCE_MISMATCH');
          const drafts = await this.#provider.extractEvidence({
            source,
            regionId: region.id,
            region: region.bounds,
            budget: parsed.budget,
            signal: invocation.signal,
          });
          const evidence = await Promise.all(drafts.map((draft) => (
            this.#evidenceStore.putEvidence(draft)
          )));
          const suggestedFits = (await Promise.all(drafts.map(async (draft, index) => {
            const primitiveType = suggestedPrimitiveType(draft.kind);
            if (!primitiveType || draft.samples.length > parsed.budget.maxSamplesPerResult) {
              return undefined;
            }
            try {
              const fit = await this.#provider.fitPrimitive({
                primitiveType,
                samples: draft.samples,
                budget: parsed.budget,
                signal: invocation.signal,
              });
              return {
                evidenceHandle: evidence[index].handle,
                ...projectFitToDocument(fit, source),
              };
            } catch {
              return undefined;
            }
          }))).filter((fit) => fit !== undefined);
          return this.#success(invocation, startedAt, inputDigest, { evidence, suggestedFits }, {
            sourceId: parsed.sourceId,
            regionId: region.id,
            slotIds: region.targetSlotIds,
            evidenceHandles: evidence.map((item) => item.handle),
            budget: parsed.budget,
          });
        }
        case 'cv_read_evidence_page': {
          const summary = await this.#evidenceStore.readSummary(parsed.handle);
          const output = await this.#evidenceStore.readSamples(parsed.handle, {
            offset: parsed.offset,
            limit: parsed.limit,
          });
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: summary.sourceId,
            regionId: summary.regionId,
            evidenceHandles: [summary.handle],
          });
        }
        case 'cv_fit_primitive': {
          const summary = await this.#evidenceStore.readSummary(parsed.handle);
          const allSamples = await readAllSamples(
            this.#evidenceStore, parsed.handle, summary.sampleCount,
          );
          const samples = evenlySample(
            allSamples, parsed.budget.maxSamplesPerResult,
          );
          const [fit, source] = await Promise.all([this.#provider.fitPrimitive({
            primitiveType: parsed.primitiveType,
            samples,
            budget: parsed.budget,
            signal: invocation.signal,
          }), this.#sources.read(summary.sourceId)]);
          const output = projectFitToDocument(fit, source);
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: summary.sourceId,
            regionId: summary.regionId,
            evidenceHandles: [summary.handle],
            budget: parsed.budget,
          });
        }
        case 'compare_region': {
          if (!this.#comparator) throw codedError('CV_CAPABILITY_UNAVAILABLE');
          const output = await this.#comparator.compare({
            sourceId: parsed.sourceId,
            regionId: parsed.regionId,
            revision: parsed.revision,
            signal: invocation.signal,
          });
          return this.#success(invocation, startedAt, inputDigest, output, {
            sourceId: parsed.sourceId,
            regionId: parsed.regionId,
          });
        }
      }
    } catch (error) {
      const code = errorCode(error);
      const rejected = code === 'CV_REGION_OUT_OF_BOUNDS'
        || code === 'CV_REGION_SOURCE_MISMATCH'
        || code === 'CV_BUDGET_EXCEEDED'
        || code.endsWith('_INVALID');
      return this.#failure(
        invocation,
        startedAt,
        inputDigest,
        code,
        rejected ? 'rejected' : 'failed',
        parsed,
      );
    }
  }

  #success(
    invocation: CvToolInvocation,
    startedAt: number,
    inputDigest: string,
    output: unknown,
    refs: Partial<Pick<CvToolReceipt,
      'sourceId' | 'regionId' | 'slotIds' | 'evidenceHandles' | 'budget'>>,
  ): CvToolExecution {
    return {
      receipt: {
        schemaVersion: 1,
        toolCallId: invocation.toolCallId,
        capability: invocation.capability,
        capabilityVersion: '1.0.0',
        runId: invocation.runId,
        inputDigest,
        outputDigest: digest(output),
        ...(refs.sourceId ? { sourceId: refs.sourceId } : {}),
        ...(refs.regionId ? { regionId: refs.regionId } : {}),
        slotIds: refs.slotIds ?? [],
        evidenceHandles: refs.evidenceHandles ?? [],
        durationMs: Math.max(0, this.#now() - startedAt),
        ...(refs.budget ? { budget: structuredClone(refs.budget) } : {}),
        status: 'succeeded',
        errorCodes: [],
        retry: { allowed: false },
      },
      output,
    };
  }

  #failure(
    invocation: CvToolInvocation,
    startedAt: number,
    inputDigest: string,
    code: string,
    status: 'rejected' | 'failed',
    parsed?: ParsedInvocation,
  ): CvToolExecution {
    const action = code === 'CV_CAPABILITY_UNAVAILABLE' ? 'pause'
      : code === 'CV_TOOL_TIMEOUT' ? 'retry'
        : 'replan';
    const references = parsed ? parsedReferences(parsed) : {};
    return {
      receipt: {
        schemaVersion: 1,
        toolCallId: invocation.toolCallId,
        capability: invocation.capability,
        capabilityVersion: '1.0.0',
        runId: invocation.runId,
        inputDigest,
        ...references,
        slotIds: references.slotIds ?? [],
        evidenceHandles: references.evidenceHandles ?? [],
        durationMs: Math.max(0, this.#now() - startedAt),
        status,
        errorCodes: [code],
        retry: { allowed: true, action },
      },
    };
  }
}

function suggestedPrimitiveType(kind: CvEvidenceDraft['kind']): CvPrimitiveType | undefined {
  switch (kind) {
    case 'point-candidate': return 'point';
    case 'line-candidate': return 'line';
    case 'circle-candidate': return 'circle';
    case 'arc-candidate': return 'arc';
    case 'ellipse-candidate': return 'ellipse';
    case 'polyline-candidate': return 'polyline';
    case 'spline-candidate': return 'spline';
    case 'edge':
    case 'contour': return 'polyline';
    case 'endpoint':
    case 'intersection':
    case 'primitive-candidate':
      return undefined;
  }
}

function parseInvocation(capability: CvToolCapability, value: unknown): ParsedInvocation {
  const input = record(value);
  switch (capability) {
    case 'inspect_source_overview':
      exactKeys(input, ['sourceId', 'budget']);
      return {
        capability, sourceId: safeId(input.sourceId),
        budget: budget(input.budget, CV_TOOL_BUDGETS.inspect_source_overview),
      };
    case 'inspect_source_crop':
      exactKeys(input, ['sourceId', 'regionId', 'budget']);
      return {
        capability,
        sourceId: safeId(input.sourceId),
        regionId: safeId(input.regionId),
        budget: budget(input.budget, CV_TOOL_BUDGETS.inspect_source_crop),
      };
    case 'create_observation_region':
      exactOptionalKeys(
        input,
        ['sourceId', 'regionId', 'bounds', 'purpose', 'targetSlotIds', 'resolutionLevel', 'attempt'],
        ['parentRegionId'],
      );
      return {
        capability,
        region: {
          id: safeId(input.regionId),
          sourceId: safeId(input.sourceId),
          bounds: rect(input.bounds),
          purpose: observationPurpose(input.purpose),
          targetSlotIds: stringArray(input.targetSlotIds, 32),
          ...(input.parentRegionId === undefined ? {} : {
            parentRegionId: safeId(input.parentRegionId),
          }),
          resolutionLevel: integer(input.resolutionLevel, 0, 8),
          attempt: integer(input.attempt, 1, 100),
        },
      };
    case 'cv_extract_evidence':
      exactKeys(input, ['sourceId', 'regionId', 'budget']);
      return {
        capability,
        sourceId: safeId(input.sourceId),
        regionId: safeId(input.regionId),
        budget: budget(input.budget, CV_TOOL_BUDGETS.cv_extract_evidence),
      };
    case 'cv_read_evidence_page':
      exactKeys(input, ['handle', 'offset', 'limit']);
      return {
        capability,
        handle: boundedString(input.handle, 1, 80),
        offset: integer(input.offset, 0, Number.MAX_SAFE_INTEGER),
        limit: integer(input.limit, 1, 1_000),
      };
    case 'cv_fit_primitive':
      exactKeys(input, ['handle', 'primitiveType', 'budget']);
      return {
        capability,
        handle: boundedString(input.handle, 1, 80),
        primitiveType: primitiveType(input.primitiveType),
        budget: budget(input.budget, CV_TOOL_BUDGETS.cv_fit_primitive),
      };
    case 'compare_region':
      exactKeys(input, ['sourceId', 'regionId', 'revision']);
      return {
        capability,
        sourceId: safeId(input.sourceId),
        regionId: safeId(input.regionId),
        revision: boundedString(input.revision, 1, 120),
      };
  }
}

function parsedReferences(parsed: ParsedInvocation): Partial<CvToolReceipt> {
  if (parsed.capability === 'inspect_source_overview') {
    return { sourceId: parsed.sourceId, budget: parsed.budget };
  }
  if (parsed.capability === 'inspect_source_crop') {
    return { sourceId: parsed.sourceId, regionId: parsed.regionId, budget: parsed.budget };
  }
  if (parsed.capability === 'create_observation_region') {
    return {
      sourceId: parsed.region.sourceId,
      regionId: parsed.region.id,
      slotIds: parsed.region.targetSlotIds,
    };
  }
  if (parsed.capability === 'cv_extract_evidence') {
    return { sourceId: parsed.sourceId, regionId: parsed.regionId, budget: parsed.budget };
  }
  if (parsed.capability === 'cv_read_evidence_page') {
    return { evidenceHandles: [parsed.handle] };
  }
  if (parsed.capability === 'cv_fit_primitive') {
    return { evidenceHandles: [parsed.handle], budget: parsed.budget };
  }
  return { sourceId: parsed.sourceId, regionId: parsed.regionId };
}

async function readAllSamples(
  store: CvEvidenceStore,
  handle: string,
  total: number,
): Promise<SourcePixelPoint[]> {
  const samples: SourcePixelPoint[] = [];
  while (samples.length < total) {
    const page = await store.readSamples(handle, {
      offset: samples.length,
      limit: Math.min(1_000, total - samples.length),
    });
    samples.push(...page.items);
    if (page.nextOffset === undefined) break;
  }
  if (samples.length !== total) throw codedError('CV_EVIDENCE_INCOMPLETE');
  return samples;
}

function evenlySample(
  samples: SourcePixelPoint[],
  limit: number,
): SourcePixelPoint[] {
  if (samples.length <= limit) return samples;
  if (limit === 1) return [samples[0]];
  return Array.from({ length: limit }, (_, index) => (
    samples[Math.floor(index * (samples.length - 1) / (limit - 1))]
  ));
}

function assertRegionWithinSource(bounds: SourcePixelRect, source: CvSourceImage): void {
  if (bounds.x + bounds.width > source.width || bounds.y + bounds.height > source.height) {
    throw codedError('CV_REGION_OUT_OF_BOUNDS');
  }
}

function budget(value: unknown, limit: CvToolBudget): CvToolBudget {
  const input = record(value);
  exactKeys(input, ['maxPixels', 'maxResults', 'maxSamplesPerResult', 'timeoutMs']);
  const parsed = {
    maxPixels: integer(input.maxPixels, 1, 100_000_000),
    maxResults: integer(input.maxResults, 1, 10_000),
    maxSamplesPerResult: integer(input.maxSamplesPerResult, 1, 100_000),
    timeoutMs: integer(input.timeoutMs, 1, 60_000),
  };
  return {
    maxPixels: Math.min(parsed.maxPixels, limit.maxPixels),
    maxResults: Math.min(parsed.maxResults, limit.maxResults),
    maxSamplesPerResult: Math.min(parsed.maxSamplesPerResult, limit.maxSamplesPerResult),
    timeoutMs: Math.min(parsed.timeoutMs, limit.timeoutMs),
  };
}

function rect(value: unknown): SourcePixelRect {
  const input = record(value);
  exactKeys(input, ['x', 'y', 'width', 'height']);
  return {
    x: integer(input.x, 0, Number.MAX_SAFE_INTEGER),
    y: integer(input.y, 0, Number.MAX_SAFE_INTEGER),
    width: integer(input.width, 1, Number.MAX_SAFE_INTEGER),
    height: integer(input.height, 1, Number.MAX_SAFE_INTEGER),
  };
}

function primitiveType(value: unknown): CvPrimitiveType {
  const allowed: CvPrimitiveType[] = [
    'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
  ];
  if (typeof value !== 'string' || !allowed.includes(value as CvPrimitiveType)) throw new Error();
  return value as CvPrimitiveType;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error();
  }
}

function exactOptionalKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[],
): void {
  const actual = Object.keys(value);
  if (required.some((key) => !actual.includes(key))
    || actual.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error();
  }
}

function observationPurpose(value: unknown): CvObservationRegion['purpose'] {
  const allowed: CvObservationRegion['purpose'][] = [
    'inventory', 'geometry', 'topology', 'annotation', 'verification',
  ];
  if (typeof value !== 'string' || !allowed.includes(value as CvObservationRegion['purpose'])) {
    throw new Error();
  }
  return value as CvObservationRegion['purpose'];
}

function safeId(value: unknown): string {
  const result = boundedString(value, 1, 120);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error();
  return result;
}

function stringArray(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new Error();
  return value.map(safeId);
}

function boundedString(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error();
  return value;
}

function integer(value: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error();
  return value as number;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
}

function codedError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)) return error.message;
  return 'CV_TOOL_FAILED';
}

function projectFitToDocument(
  fit: Awaited<ReturnType<DrawingCvProvider['fitPrimitive']>>,
  source: CvSourceImage,
) {
  const scale = 500 / source.width;
  const point = (value: unknown): [number, number] => {
    if (!Array.isArray(value) || value.length !== 2
      || !value.every((item) => typeof item === 'number')) {
      throw codedError('CV_FIT_PARAMETERS_INVALID');
    }
    return [value[0] * scale, (source.height - value[1]) * scale];
  };
  const vector = (value: unknown): [number, number] => {
    if (!Array.isArray(value) || value.length !== 2
      || !value.every((item) => typeof item === 'number')) {
      throw codedError('CV_FIT_PARAMETERS_INVALID');
    }
    return [value[0] * scale, -value[1] * scale];
  };
  const params = fit.parameters;
  let documentParameters: Record<string, unknown>;
  switch (fit.primitiveType) {
    case 'point':
      documentParameters = Object.fromEntries([
        ['x', (params.x as number) * scale],
        ['y', (source.height - (params.y as number)) * scale],
      ]);
      break;
    case 'line':
      documentParameters = { start: point(params.start), end: point(params.end) };
      break;
    case 'ray':
    case 'xline':
      documentParameters = { origin: point(params.origin), direction: vector(params.direction) };
      break;
    case 'circle':
      documentParameters = { center: point(params.center), radius: (params.radius as number) * scale };
      break;
    case 'arc':
      documentParameters = {
        center: point(params.center),
        radius: (params.radius as number) * scale,
        startAngle: normalizeDegrees(-(params.startAngle as number) * 180 / Math.PI),
        endAngle: normalizeDegrees(-(params.endAngle as number) * 180 / Math.PI),
        counterClockwise: !(params.counterClockwise as boolean),
      };
      break;
    case 'ellipse':
      documentParameters = {
        center: point(params.center),
        majorAxis: vector(params.majorAxis),
        ratio: params.ratio,
      };
      break;
    case 'polyline':
      documentParameters = {
        vertices: Array.isArray(params.vertices)
          ? params.vertices.map((vertex) => {
              const item = record(vertex);
              return { point: point(item.point) };
            })
          : [],
        closed: params.closed,
      };
      break;
    case 'spline':
      documentParameters = {
        degree: params.degree,
        controlPoints: Array.isArray(params.controlPoints)
          ? params.controlPoints.map(point)
          : [],
        knots: params.knots,
        closed: params.closed,
        periodic: params.periodic,
      };
      break;
  }
  return {
    ...fit,
    sourceParameters: structuredClone(params),
    documentParameters,
    documentFrame: {
      width: 500,
      height: source.height * scale,
      sourceToDocument: [scale, 0, 0, -scale, 0, source.height * scale],
    },
  };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
