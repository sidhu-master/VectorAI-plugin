# Recognition Evaluation Runtime Design

## 1. Goal

Build one host-owned recognition runtime that executes and evaluates VectorAI's
complete recognition pipelines: deterministic geometry extraction, optional DSH
model review, validation, local grounding, and final domain output. Production
and evaluation must call the same pipeline implementation so a passing model-only
fixture cannot hide a regression in local algorithms or integration code.

The first production slice migrates the existing shaft-partition semantic
reviewer. The runtime is deliberately extensible to the existing GD&T reviewer
and deterministic dimension-chain, datum, diameter, opening-angle, and roughness
pipelines without moving engineering authority into the model.

## 2. Confirmed DSH Runtime Contract

VectorAI currently targets DSH `0.1.2-alpha.5`. A throwaway probe against the
installed runtime on 2026-09-04 verified all seams required by this design with a
real provider call:

- `agent/request` yielded the selected provider, model, reasoning effort, and
  call limits;
- `llm/stream` yielded the fully assembled provider-neutral request, including
  messages, system prompt, tool schemas, token limit, and session identity;
- the `llm/stream` request and its messages were deep-frozen;
- direct `ctx.subagents.start()` accepted and enforced `agentOptions`,
  `outputSchema`, `maxDepth`, `toolFilter`, and `persona`;
- the child route override reached `llm/stream`, structured output returned, and
  `subagent/start` / `subagent/end` formed a complete lifecycle pair.

`llm/stream` is the final provider-neutral DSH boundary, not a promise that every
provider emits the same vendor HTTP body. VectorAI does not instrument provider
HTTP adapters and never records credentials, headers, environment variables, or
attachment bytes.

## 3. Existing Product Promises to Preserve

- Models classify bounded semantic candidates; they do not invent coordinates,
  dimensional arithmetic, datum precedence, GD&T characteristics, tolerance
  values, or roughness values.
- Geometry extraction, validation, confidence policy, grounding, persistence,
  preview, confirmation, export, and stale-revision protection remain local and
  deterministic.
- The golden drawing is a test oracle only. Production code must not read fixture
  names, fixture digests, expected coordinates, or golden constants.
- Missing, invalid, low-confidence, timed-out, or unsupported AI enrichment must
  preserve each pipeline's documented deterministic behavior. An evaluator may
  report the enrichment failure, but may not relax production policy to make a
  fixture pass.
- Drawing, partition, dimension-plan, and annotation persistence formats do not
  change in the first slice.
- Existing user-visible workflows and UI do not gain status pills, debug panels,
  or evaluation controls as part of this architecture.

## 4. Chosen Architecture

### 4.1 One DSH boundary

Only `DshRecognitionModelAdapter` interacts with `ctx.subagents`,
`agent/request`, `llm/stream`, and subagent lifecycle events. Recognition
pipelines depend on a stable VectorAI-owned `RecognitionModelPort`; they do not
import DSH runtime types.

This is preferred over letting every recognizer call DSH directly, which would
duplicate capability checks, request capture, sanitization, timeout handling, and
version assumptions. A separate inference service is rejected because VectorAI is
local-first and DSH already owns model routing, credentials, sessions, and
provider adapters.

### 4.2 Shared pipeline runner

`RecognitionPipelineRunner` owns the invariant execution order:

1. prepare production-shaped local input;
2. run deterministic pre-processing;
3. optionally request a bounded model review through `RecognitionModelPort`;
4. validate and normalize the structured model candidate;
5. run deterministic post-processing and grounding;
6. produce the final domain output plus a diagnostic trace.

Production services and evaluators receive the same registered pipeline object
and call the same `run()` function. There is no alternate evaluation prompt,
parser, local solver, or grounding implementation.

### 4.3 Per-pipeline ownership

The global runtime standardizes execution and evidence but does not collapse all
engineering algorithms into one generic file. Each pipeline adapter owns its
typed input, candidate schema, local stages, output normalization, and assertions.
This keeps dimension-chain arithmetic independent from partition classification
while still giving both the same evaluation protocol and version checks.

## 5. Stable Internal Contracts

The host defines DSH-free contracts equivalent to:

```ts
export interface RecognitionModelRequest<TStructured> {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly parentAgent: AgentHandle;
  readonly prompt: readonly RecognitionContent[];
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly persona?: string;
  readonly timeoutMs: number;
  readonly route?: RecognitionModelRoute;
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
}

export interface RecognitionModelResult<TStructured> {
  readonly stopReason: string;
  readonly structured?: TStructured;
  readonly observation: RecognitionModelObservation;
}

export interface RecognitionPipeline<I, O> {
  readonly id: string;
  readonly version: string;
  run(input: I, context: RecognitionRunContext): Promise<RecognitionRun<O>>;
  normalize(output: O): unknown;
}
```

`AgentHandle` and `RecognitionContent` are narrow VectorAI-owned types. DSH Agent,
ContentBlock, SessionId, and SubagentRun types remain private to the adapter.

## 6. Request Capture and Correlation

The adapter registers one process-wide, effect-scoped observer. It does not
persist ordinary conversations. Capture is enabled only while an adapter-owned
recognition child is active.

Before starting the child, the adapter subscribes to `subagent/start` and
`llm/stream`. The lifecycle event supplies the published child session ID; only
`llm/stream` requests whose `sessionId` matches that child are included. The
actual DSH ordering was verified to publish `subagent/start` before the child's
first `agent/request` and `llm/stream` call. Capture closes on the paired
`subagent/end`, timeout, abort, start failure, or adapter disposal.

The observation stores only normalized metadata and SHA-256 digests. Message
text, system text, tool descriptions, images, local paths, document contents,
credentials, and provider headers are not written to evaluation artifacts. A
diagnostic run may retain sanitized structured candidates because those are
already bounded by the pipeline schema.

Concurrent runs are isolated by child session ID and subagent run ID. An
unmatched or ambiguous request is reported as
`RECOGNITION_REQUEST_CORRELATION_FAILED`; it is never attributed by timing alone.

## 7. DSH Compatibility Boundary

The adapter exposes a startup capability report containing:

- installed versions of `dsh-agent`, `dsh-llm`, and `dsh-subagent`;
- availability of `agent/request`, `llm/stream`, and one local subagent provider;
- advertised support for `agentOptions`, `outputSchema`, `depthLimit`,
  `toolFilter`, and `persona`;
- provider/model route facts captured for the recognition call.

The supported baseline is exactly `0.1.2-alpha.5` for the first slice. A different
DSH version, missing capability, missing local child, or request contract mismatch
fails explicitly as `DSH_RECOGNITION_RUNTIME_INCOMPATIBLE`. There is no silent
fallback to an unobserved model request. Pipelines whose AI stage is already
documented as optional may continue with their existing deterministic fallback,
but the evaluation result records that no comparable model run occurred.

All package-version and capability knowledge lives in the adapter and its tests.
Individual recognizers never branch on DSH versions.

## 8. Evaluation Contract

A `RecognitionContractCase<I, O>` contains:

- stable case ID and fixture revision;
- real input files or normalized production-shaped input;
- pipeline ID and expected pipeline version;
- expected normalized final domain output;
- required and forbidden invariants;
- whether ambiguity or user clarification is the expected result;
- provenance describing the drawing, document, or engineering rule that defines
  the expectation.

`RecognitionEvaluator` executes the registered production pipeline and records
four distinct layers:

1. deterministic pre-processing output;
2. validated model candidate, when used;
3. deterministic grounding/post-processing output;
4. normalized final domain output.

Assertions are made against final domain behavior: partition ranges, topology,
dimension intervals and equations, actual datum geometry, controlled GD&T
surfaces, diameter/opening-angle anchors, and roughness attachment. Raw wording
from the model is never the golden result.

Live evaluations are repeated three times by default. A contract passes only
when all three final normalized outputs satisfy the same invariants. Deterministic
pipelines run once unless the case explicitly composes a live model stage.

## 9. Reproducibility Fingerprint

Every evaluation produces a fingerprint from:

- DSH Agent, LLM, and Subagent package versions;
- provider, model, reasoning effort, output-token cap, and model capability
  metadata;
- pipeline ID and pipeline version;
- prompt, persona, output-schema, and deterministic-policy digests;
- local algorithm package version or source digest;
- fixture revision and input digest.

Results with different fingerprints are not compared as if they came from one
runtime. Changing DSH version, route, prompt, schema, or local algorithm marks the
previous live evidence stale and requires rerunning the affected contract cases.

## 10. Errors and Cancellation

- Provider, timeout, refusal, invalid structured output, and correlation failures
  remain distinct typed outcomes.
- The caller's AbortSignal owns both model execution and local pipeline work.
- Every published `SubagentRun` is disposed in `finally`.
- A failed live evaluation never writes production Drawing or workflow state.
- Evaluators use isolated session/run state and read-only fixture inputs.
- Production pipelines retain their existing persistence and transaction owners;
  the runtime does not become a second Drawing repository.

## 11. First Vertical Slice

The initial implementation delivers one observable end-to-end workflow:

1. register `shaft-partition-semantic-review` as a versioned pipeline;
2. move its DSH child construction and structured-result capture behind
   `DshRecognitionModelAdapter`;
3. keep its existing observation rendering, batching, proposal validation,
   confidence threshold, evidence checks, consolidation, and local application;
4. run the existing production partition workflow through the shared runner;
5. evaluate one production-shaped partition fixture through that exact runner,
   including local proposal application, with a deterministic fake model port;
6. provide an opt-in live command that uses the installed DSH route and emits a
   sanitized fingerprint and pass/fail report outside production persistence;
7. rebuild the annotation DSH bundle and verify the existing automatic annotation
   workflow remains unchanged.

The second slice migrates the existing GD&T semantic reviewer. Deterministic
dimension-chain, datum, diameter, opening-angle, and roughness cases then register
with the evaluator without acquiring unnecessary model stages.

## 12. Acceptance Criteria

- Exactly one production module imports or adapts the DSH request/subagent seams
  for recognition.
- The installed `0.1.2-alpha.5` runtime passes a real capability and structured
  child-call probe.
- Partition production and evaluation use the same pipeline and local
  post-processing functions.
- An adapter version or capability mismatch fails loudly and invalidates prior
  live evidence.
- Evaluation artifacts contain no prompt text, message text, attachment bytes,
  local document contents, credentials, or provider headers.
- Existing deterministic authority, fallback behavior, persistence, preview,
  confirmation, export, and stale-revision semantics remain unchanged.
- Existing partition, full automatic-annotation, package type-check, and local
  annotation-bundle build checks pass after migration.
