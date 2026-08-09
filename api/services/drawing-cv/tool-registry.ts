import { createHash } from 'node:crypto';

import type {
  CvEvidenceStore,
  CvPrimitiveType,
  CvSourceImage,
  CvToolBudget,
  DrawingCvProvider,
  SourcePixelPoint,
  SourcePixelRect,
} from './types.js';

export type CvToolCapability =
  | 'inspect_source_overview'
  | 'create_observation_region'
  | 'cv_extract_evidence'
  | 'cv_read_evidence_page'
  | 'cv_fit_primitive'
  | 'compare_region';

export interface CvObservationRegion {
  id: string;
  sourceId: string;
  bounds: SourcePixelRect;
  purpose: string;
  targetSlotIds: string[];
  resolutionScale: number;
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

export class DrawingCvToolRegistry {
  readonly #provider: DrawingCvProvider;
  readonly #evidenceStore: CvEvidenceStore;
  readonly #sources: CvSourceGateway;
  readonly #regions: CvRegionGateway;
  readonly #comparator?: CvRegionComparator;
  readonly #now: () => number;

  constructor(input: {
    provider: DrawingCvProvider;
    evidenceStore: CvEvidenceStore;
    sources: CvSourceGateway;
    regions: CvRegionGateway;
    comparator?: CvRegionComparator;
    now?: () => number;
  }) {
    this.#provider = input.provider;
    this.#evidenceStore = input.evidenceStore;
    this.#sources = input.sources;
    this.#regions = input.regions;
    this.#comparator = input.comparator;
    this.#now = input.now ?? Date.now;
  }

  async invoke(invocation: CvToolInvocation): Promise<CvToolExecution> {
    const startedAt = this.#now();
    const inputDigest = digest(invocation.input);
    let parsed: ParsedInvocation;
    try {
      parsed = parseInvocation(invocation.capability, invocation.input);
    } catch {
      return this.#failure(invocation, startedAt, inputDigest, 'INVALID_TOOL_INPUT', 'rejected');
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
          return this.#success(invocation, startedAt, inputDigest, { evidence }, {
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
          if (summary.sampleCount > parsed.budget.maxSamplesPerResult) {
            throw codedError('CV_BUDGET_EXCEEDED');
          }
          const samples = await readAllSamples(this.#evidenceStore, parsed.handle, summary.sampleCount);
          const output = await this.#provider.fitPrimitive({
            primitiveType: parsed.primitiveType,
            samples,
            budget: parsed.budget,
            signal: invocation.signal,
          });
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

function parseInvocation(capability: CvToolCapability, value: unknown): ParsedInvocation {
  const input = record(value);
  switch (capability) {
    case 'inspect_source_overview':
      exactKeys(input, ['sourceId', 'budget']);
      return { capability, sourceId: safeId(input.sourceId), budget: budget(input.budget) };
    case 'create_observation_region':
      exactKeys(input, [
        'sourceId', 'regionId', 'bounds', 'purpose', 'targetSlotIds', 'resolutionScale',
      ]);
      return {
        capability,
        region: {
          id: safeId(input.regionId),
          sourceId: safeId(input.sourceId),
          bounds: rect(input.bounds),
          purpose: boundedString(input.purpose, 1, 500),
          targetSlotIds: stringArray(input.targetSlotIds, 32),
          resolutionScale: finiteNumber(input.resolutionScale, 0.1, 8),
        },
      };
    case 'cv_extract_evidence':
      exactKeys(input, ['sourceId', 'regionId', 'budget']);
      return {
        capability,
        sourceId: safeId(input.sourceId),
        regionId: safeId(input.regionId),
        budget: budget(input.budget),
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
        budget: budget(input.budget),
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

function assertRegionWithinSource(bounds: SourcePixelRect, source: CvSourceImage): void {
  if (bounds.x + bounds.width > source.width || bounds.y + bounds.height > source.height) {
    throw codedError('CV_REGION_OUT_OF_BOUNDS');
  }
}

function budget(value: unknown): CvToolBudget {
  const input = record(value);
  exactKeys(input, ['maxPixels', 'maxResults', 'maxSamplesPerResult', 'timeoutMs']);
  return {
    maxPixels: integer(input.maxPixels, 1, 100_000_000),
    maxResults: integer(input.maxResults, 1, 10_000),
    maxSamplesPerResult: integer(input.maxSamplesPerResult, 1, 100_000),
    timeoutMs: integer(input.timeoutMs, 1, 60_000),
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

function finiteNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error();
  return value;
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
