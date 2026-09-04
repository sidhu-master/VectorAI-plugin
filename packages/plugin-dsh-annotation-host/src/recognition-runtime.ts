// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

export type RecognitionPromptPart =
  | { readonly type: 'text'; readonly text: string }
  | {
    readonly type: 'image';
    readonly data: Uint8Array;
    readonly mediaType: 'image/png';
    readonly name: string;
  };

export interface RecognitionModelRoute {
  readonly subagentProvider?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly reasoningEffort?: string;
}

export interface RecognitionModelRequest<TStructured> {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly parentSessionId: string;
  readonly prompt: readonly RecognitionPromptPart[];
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly persona?: string;
  readonly maxDepth: number;
  readonly maxTokens?: number;
  readonly timeoutMs: number;
  readonly route?: RecognitionModelRoute;
  readonly signal?: AbortSignal;
}

export interface RecognitionRuntimeVersions {
  readonly agent: string;
  readonly llm: string;
  readonly subagent: string;
}

export interface RecognitionModelObservation {
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: string;
  readonly maxTokens?: number;
  readonly messageCount: number;
  readonly systemDigest?: string;
  readonly toolNames: readonly string[];
  readonly requestDigest: string;
  readonly runtimeVersions?: RecognitionRuntimeVersions;
}

export interface RecognitionModelResult<TStructured> {
  readonly stopReason: string;
  readonly structured?: TStructured;
  readonly observations: readonly RecognitionModelObservation[];
}

export interface RecognitionModelPort {
  review<TStructured>(
    request: RecognitionModelRequest<TStructured>,
  ): Promise<RecognitionModelResult<TStructured>>;
}

export type RecognitionStageKind = 'deterministic' | 'model' | 'validation' | 'grounding';
export type RecognitionStageStatus = 'completed' | 'skipped' | 'failed';

export interface RecognitionStageTrace {
  readonly id: string;
  readonly kind: RecognitionStageKind;
  readonly status: RecognitionStageStatus;
  readonly digest?: string;
  readonly code?: string;
}

export interface RecognitionRunContext {
  readonly signal?: AbortSignal;
  review<TStructured>(
    request: RecognitionModelRequest<TStructured>,
  ): Promise<RecognitionModelResult<TStructured>>;
  record(stage: RecognitionStageTrace): void;
}

export interface RecognitionPipeline<I, O> {
  readonly id: string;
  readonly version: string;
  execute(input: I, context: RecognitionRunContext): Promise<O>;
  normalize(output: O): unknown;
}

export interface RecognitionRun<O> {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly output: O;
  readonly normalized: unknown;
  readonly trace: readonly RecognitionStageTrace[];
  readonly modelObservations: readonly RecognitionModelObservation[];
}

export interface RecognitionContractCase<I, O> {
  readonly id: string;
  readonly pipelineId: string;
  readonly input: I;
  readonly attempts?: number;
  readonly fixtureDigest: string;
  readonly policyDigests?: readonly string[];
  assert(output: O): readonly string[];
}

export interface RecognitionEvaluationAttempt {
  readonly index: number;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly normalized?: unknown;
  readonly trace: readonly RecognitionStageTrace[];
  readonly modelObservations: readonly RecognitionModelObservation[];
  readonly fingerprint: string;
}

export interface RecognitionEvaluationReport {
  readonly caseId: string;
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly passed: boolean;
  readonly attempts: readonly RecognitionEvaluationAttempt[];
}

export interface RecognitionFingerprintInput {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly fixtureDigest: string;
  readonly policyDigests?: readonly string[];
  readonly observations: readonly RecognitionModelObservation[];
}

export class RecognitionPipelineRunner {
  private readonly pipelines = new Map<string, RecognitionPipeline<unknown, unknown>>();

  constructor(private readonly model: RecognitionModelPort) {}

  register<I, O>(pipeline: RecognitionPipeline<I, O>): void {
    if (this.pipelines.has(pipeline.id)) {
      throw new Error(`RECOGNITION_PIPELINE_DUPLICATE:${pipeline.id}`);
    }
    this.pipelines.set(pipeline.id, pipeline as RecognitionPipeline<unknown, unknown>);
  }

  list(): string[] {
    return [...this.pipelines.keys()];
  }

  async run<I, O>(pipelineId: string, input: I, signal?: AbortSignal): Promise<RecognitionRun<O>> {
    const pipeline = this.expectPipeline<I, O>(pipelineId);
    const trace: RecognitionStageTrace[] = [];
    const modelObservations: RecognitionModelObservation[] = [];
    const context: RecognitionRunContext = {
      signal,
      record: (stage) => trace.push(structuredClone(stage)),
      review: async <TStructured>(request: RecognitionModelRequest<TStructured>) => {
        if (request.pipelineId !== pipeline.id || request.pipelineVersion !== pipeline.version) {
          throw new Error(`RECOGNITION_MODEL_REQUEST_PIPELINE_MISMATCH:${pipeline.id}`);
        }
        const result = await this.model.review(request);
        modelObservations.push(...result.observations.map((observation) => structuredClone(observation)));
        return result;
      },
    };
    const output = await pipeline.execute(input, context);
    return {
      pipelineId: pipeline.id,
      pipelineVersion: pipeline.version,
      output,
      normalized: pipeline.normalize(output),
      trace,
      modelObservations,
    };
  }

  async evaluate<I, O>(contract: RecognitionContractCase<I, O>): Promise<RecognitionEvaluationReport> {
    const pipeline = this.expectPipeline<I, O>(contract.pipelineId);
    const count = contract.attempts ?? 3;
    if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
      throw new Error('RECOGNITION_EVALUATION_ATTEMPTS_INVALID');
    }
    const attempts: RecognitionEvaluationAttempt[] = [];
    for (let index = 0; index < count; index += 1) {
      try {
        const run = await this.run<I, O>(contract.pipelineId, contract.input);
        const failures = [...contract.assert(run.output)];
        attempts.push({
          index: index + 1,
          passed: failures.length === 0,
          failures,
          normalized: run.normalized,
          trace: run.trace,
          modelObservations: run.modelObservations,
          fingerprint: createRecognitionFingerprint({
            pipelineId: pipeline.id,
            pipelineVersion: pipeline.version,
            fixtureDigest: contract.fixtureDigest,
            policyDigests: contract.policyDigests,
            observations: run.modelObservations,
          }),
        });
      } catch (error) {
        attempts.push({
          index: index + 1,
          passed: false,
          failures: [errorMessage(error)],
          trace: [],
          modelObservations: [],
          fingerprint: createRecognitionFingerprint({
            pipelineId: pipeline.id,
            pipelineVersion: pipeline.version,
            fixtureDigest: contract.fixtureDigest,
            policyDigests: contract.policyDigests,
            observations: [],
          }),
        });
      }
    }
    return {
      caseId: contract.id,
      pipelineId: pipeline.id,
      pipelineVersion: pipeline.version,
      passed: attempts.every(({ passed }) => passed),
      attempts,
    };
  }

  private expectPipeline<I, O>(pipelineId: string): RecognitionPipeline<I, O> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`RECOGNITION_PIPELINE_UNKNOWN:${pipelineId}`);
    return pipeline as RecognitionPipeline<I, O>;
  }
}

export function createRecognitionFingerprint(input: RecognitionFingerprintInput): string {
  const canonical = canonicalJson({
    fixtureDigest: input.fixtureDigest,
    observations: input.observations,
    pipelineId: input.pipelineId,
    pipelineVersion: input.pipelineVersion,
    policyDigests: input.policyDigests ?? [],
  });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function recognitionDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('RECOGNITION_FINGERPRINT_NON_FINITE');
    return value;
  }
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value instanceof Uint8Array) {
    return { byteLength: value.byteLength, digest: recognitionDigestBytes(value) };
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const member = (value as Record<string, unknown>)[key];
      if (member !== undefined) output[key] = canonicalValue(member);
    }
    return output;
  }
  throw new TypeError('RECOGNITION_FINGERPRINT_VALUE_UNSUPPORTED');
}

function recognitionDigestBytes(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
