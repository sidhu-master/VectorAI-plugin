// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'node:module';
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent';
import type { Context } from '@deepseek-ai/cordis';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentRun, SubagentStartRequest } from '@deepseek-ai/dsh-subagent';
import {
  recognitionDigest,
  type RecognitionModelObservation,
  type RecognitionModelPort,
  type RecognitionModelRequest,
  type RecognitionModelResult,
  type RecognitionRuntimeVersions,
} from './recognition-runtime';
import { DSH_RUNTIME_VERSION } from './dsh-runtime-baseline.generated';

export const SUPPORTED_DSH_RECOGNITION_VERSION = DSH_RUNTIME_VERSION;

export interface DshRecognitionProvider {
  readonly capabilities: {
    readonly agentOptions: boolean;
    readonly outputSchema: boolean;
    readonly depthLimit: boolean;
    readonly toolFilter: boolean;
    readonly persona: boolean;
  };
}

export interface DshRecognitionBridgeRun {
  readonly id: string;
  readonly result: Promise<{ readonly stopReason: string; readonly structured?: unknown }>;
  dispose(): Promise<void>;
}

export interface DshRecognitionAgentOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly reasoningEffort?: string;
  readonly maxTokens?: number;
}

export interface DshRecognitionAgentConfig extends DshRecognitionAgentOptions {
  readonly provider: string;
  readonly model: string;
}

export interface DshRecognitionStreamOptions extends DshRecognitionAgentConfig {
  readonly messages: readonly unknown[];
  readonly system?: string;
  readonly tools?: readonly {
    readonly name: string;
    readonly description?: string;
    readonly parameters?: Readonly<Record<string, unknown>>;
  }[];
  readonly temperature?: number;
  readonly stop?: readonly string[];
  readonly sessionId?: string;
  readonly purpose?: string;
}

export interface DshRecognitionStartRequest {
  readonly label: string;
  readonly parent: unknown;
  readonly signal: AbortSignal;
  readonly agentOptions?: DshRecognitionAgentOptions;
  readonly maxDepth: number;
  readonly toolFilter: { readonly allow: readonly string[] };
  readonly persona?: string;
  readonly prompt: readonly unknown[];
  readonly outputSchema: Readonly<Record<string, unknown>>;
}

export interface DshRecognitionBridge {
  readonly versions: RecognitionRuntimeVersions;
  getParent(sessionId: string): unknown | undefined;
  listProviders(): readonly string[];
  getProvider(name: string): DshRecognitionProvider | undefined;
  saveImage(input: { readonly data: Uint8Array; readonly mediaType: 'image/png'; readonly name: string }): Promise<unknown>;
  onSubagentStart(parent: unknown, listener: (event: { readonly id: string; readonly provider: string }) => void): () => void;
  onAgentRequest(listener: (event: { readonly agentId: string; readonly config: DshRecognitionAgentConfig }) => void): () => void;
  onLlmStream(listener: (options: DshRecognitionStreamOptions) => void): () => void;
  startSubagent(provider: string, request: DshRecognitionStartRequest): Promise<DshRecognitionBridgeRun>;
}

export interface DshRecognitionRuntimeReport {
  readonly supportedVersion: string;
  readonly versions: RecognitionRuntimeVersions;
  readonly compatible: boolean;
}

export class DshRecognitionModelAdapter implements RecognitionModelPort {
  constructor(private readonly bridge: DshRecognitionBridge) {}

  runtimeReport(): DshRecognitionRuntimeReport {
    const versions = structuredClone(this.bridge.versions);
    return {
      supportedVersion: SUPPORTED_DSH_RECOGNITION_VERSION,
      versions,
      compatible: Object.values(versions).every((version) => version === SUPPORTED_DSH_RECOGNITION_VERSION),
    };
  }

  async review<TStructured>(request: RecognitionModelRequest<TStructured>): Promise<RecognitionModelResult<TStructured>> {
    this.assertRuntimeCompatibility();
    if (request.signal?.aborted) throw new Error('DSH_RECOGNITION_ABORTED');
    const parent = this.bridge.getParent(request.parentSessionId);
    if (!parent) throw new Error('DSH_RECOGNITION_PARENT_UNAVAILABLE');
    const providerName = request.route?.subagentProvider ?? this.bridge.listProviders()[0];
    if (!providerName) throw new Error('DSH_RECOGNITION_PROVIDER_UNAVAILABLE');
    const provider = this.bridge.getProvider(providerName);
    if (!provider) throw new Error('DSH_RECOGNITION_PROVIDER_UNAVAILABLE');
    assertCapabilities(provider);

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('DSH_RECOGNITION_TIMEOUT')), request.timeoutMs);
    const combinedSignal = combineSignals(request.signal, timeout.signal);
    const signal = combinedSignal.signal;
    const candidateIds = new Set<string>();
    const routesBySession = new Map<string, DshRecognitionAgentConfig[]>();
    const observationsBySession = new Map<string, RecognitionModelObservation[]>();
    const failuresBySession = new Map<string, string>();
    const disposers: Array<() => void> = [];
    let run: DshRecognitionBridgeRun | undefined;

    try {
      disposers.push(this.bridge.onSubagentStart(parent, ({ id }) => {
        candidateIds.add(id);
      }));
      disposers.push(this.bridge.onAgentRequest(({ agentId, config }) => {
        if (!candidateIds.has(agentId)) return;
        const routes = routesBySession.get(agentId) ?? [];
        routes.push(structuredClone(config));
        routesBySession.set(agentId, routes);
      }));
      disposers.push(this.bridge.onLlmStream((options) => {
        const childId = options.sessionId;
        if (!childId || !candidateIds.has(childId)) return;
        const agentRoute = routesBySession.get(childId)?.shift();
        const mismatch = routeMismatch(agentRoute, options);
        if (mismatch) {
          failuresBySession.set(childId, `DSH_RECOGNITION_ROUTE_MISMATCH:${mismatch}`);
          return;
        }
        const observations = observationsBySession.get(childId) ?? [];
        observations.push(toObservation(options, this.bridge.versions));
        observationsBySession.set(childId, observations);
      }));

      const prompt: unknown[] = [];
      for (const part of request.prompt) {
        if (part.type === 'text') {
          prompt.push({ type: 'text', text: part.text });
        } else {
          const attachment = await abortable(this.bridge.saveImage({
            data: part.data,
            mediaType: part.mediaType,
            name: part.name,
          }), signal);
          prompt.push({ type: 'image', attachment });
        }
      }
      const agentOptions = createAgentOptions(request);
      run = await abortable(this.bridge.startSubagent(providerName, {
        label: `recognition:${request.pipelineId}@${request.pipelineVersion}`,
        parent,
        signal,
        ...(agentOptions ? { agentOptions } : {}),
        maxDepth: request.maxDepth,
        toolFilter: { allow: [] },
        ...(request.persona ? { persona: request.persona } : {}),
        prompt,
        outputSchema: request.outputSchema,
      }), signal);
      candidateIds.add(run.id);
      const result = await abortable(run.result, signal);
      const correlationFailure = failuresBySession.get(run.id);
      if (correlationFailure) throw new Error(correlationFailure);
      const observations = observationsBySession.get(run.id) ?? [];
      if (observations.length === 0) throw new Error('DSH_RECOGNITION_OBSERVATION_MISSING');
      return {
        stopReason: result.stopReason,
        structured: result.structured as TStructured | undefined,
        observations: observations.map((observation) => structuredClone(observation)),
      };
    } catch (error) {
      if (request.signal?.aborted) throw new Error('DSH_RECOGNITION_ABORTED');
      if (timeout.signal.aborted) throw new Error('DSH_RECOGNITION_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timer);
      combinedSignal.dispose();
      for (const dispose of disposers.reverse()) dispose();
      if (run) await run.dispose().catch(() => undefined);
    }
  }

  private assertRuntimeCompatibility(): void {
    for (const name of ['agent', 'llm', 'subagent'] as const) {
      const version = this.bridge.versions[name];
      if (version !== SUPPORTED_DSH_RECOGNITION_VERSION) {
        throw new Error(`DSH_RECOGNITION_VERSION_MISMATCH:${name}:${version}`);
      }
    }
  }
}

export function createDshRecognitionModelAdapter(ctx: Context): DshRecognitionModelAdapter {
  const versions = loadDshRecognitionVersions();
  const bridge: DshRecognitionBridge = {
    versions,
    getParent: (sessionId) => ctx.agents.get(SessionId(sessionId)),
    listProviders: () => ctx.subagents.list(),
    getProvider: (name) => ctx.subagents.getProvider(name),
    saveImage: (input) => ctx.attachments.saveImage(input),
    onSubagentStart: (parent, listener) => (parent as Agent).ctx.on('subagent/start', (info) => {
      listener({ id: String(info.id), provider: info.provider });
    }),
    onAgentRequest: (listener) => ctx.on('agent/request', async (payload, next) => {
      const config = await next();
      listener({ agentId: String(payload.agent.id), config });
      return config;
    }, { global: true }),
    onLlmStream: (listener) => ctx.on('llm/stream', (options, next) => {
      listener(options);
      return next();
    }, { global: true }),
    startSubagent: async (provider, request) => {
      const run = await ctx.subagents.start(provider, {
        label: request.label,
        parent: request.parent as Agent,
        signal: request.signal,
        ...(request.agentOptions ? { agentOptions: request.agentOptions as AgentOptions } : {}),
        maxDepth: request.maxDepth,
        toolFilter: { allow: [...request.toolFilter.allow] },
        ...(request.persona ? { persona: request.persona } : {}),
        prompt: request.prompt as ContentBlock[],
        outputSchema: request.outputSchema as unknown as SubagentStartRequest['outputSchema'],
      });
      return adaptRun(run);
    },
  };
  return new DshRecognitionModelAdapter(bridge);
}

export function loadDshRecognitionVersions(): RecognitionRuntimeVersions {
  const require = createRequire(import.meta.url);
  return {
    agent: packageVersion(require('@deepseek-ai/dsh-agent/package.json')),
    llm: packageVersion(require('@deepseek-ai/dsh-llm/package.json')),
    subagent: packageVersion(require('@deepseek-ai/dsh-subagent/package.json')),
  };
}

function adaptRun(run: SubagentRun): DshRecognitionBridgeRun {
  return {
    id: String(run.id),
    result: run.result,
    dispose: () => run.dispose(),
  };
}

function packageVersion(value: unknown): string {
  const version = (value as { version?: unknown })?.version;
  if (typeof version !== 'string') throw new Error('DSH_RECOGNITION_VERSION_UNAVAILABLE');
  return version;
}

function assertCapabilities(provider: DshRecognitionProvider): void {
  for (const capability of ['agentOptions', 'outputSchema', 'depthLimit', 'toolFilter', 'persona'] as const) {
    if (!provider.capabilities[capability]) {
      throw new Error(`DSH_RECOGNITION_CAPABILITY_REQUIRED:${capability}`);
    }
  }
}

function createAgentOptions<TStructured>(request: RecognitionModelRequest<TStructured>): DshRecognitionAgentOptions | undefined {
  const options: DshRecognitionAgentOptions = {
    ...(request.route?.provider !== undefined ? { provider: request.route.provider } : {}),
    ...(request.route?.model !== undefined ? { model: request.route.model } : {}),
    ...(request.route?.reasoningEffort !== undefined ? { reasoningEffort: request.route.reasoningEffort } : {}),
    ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
  };
  return Object.keys(options).length > 0 ? options : undefined;
}

function routeMismatch(
  agent: DshRecognitionAgentConfig | undefined,
  stream: DshRecognitionStreamOptions,
): string | undefined {
  if (!agent) return 'agent-request-missing';
  if (agent.provider !== stream.provider) return 'provider';
  if (agent.model !== stream.model) return 'model';
  if (agent.reasoningEffort !== undefined && agent.reasoningEffort !== stream.reasoningEffort) return 'reasoning-effort';
  if (agent.maxTokens !== undefined && agent.maxTokens !== stream.maxTokens) return 'max-tokens';
  return undefined;
}

function toObservation(
  options: DshRecognitionStreamOptions,
  runtimeVersions: RecognitionRuntimeVersions,
): RecognitionModelObservation {
  return {
    provider: options.provider,
    model: options.model,
    ...(options.reasoningEffort !== undefined ? { reasoningEffort: options.reasoningEffort } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    messageCount: options.messages.length,
    ...(options.system !== undefined ? { systemDigest: recognitionDigest(options.system) } : {}),
    toolNames: options.tools?.map(({ name }) => name) ?? [],
    requestDigest: recognitionDigest({
      provider: options.provider,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      messages: options.messages,
      system: options.system,
      tools: options.tools,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stop: options.stop,
      sessionId: options.sessionId,
      purpose: options.purpose,
    }),
    runtimeVersions: structuredClone(runtimeVersions),
  };
}

function combineSignals(
  first: AbortSignal | undefined,
  second: AbortSignal,
): { readonly signal: AbortSignal; dispose(): void } {
  if (!first) return { signal: second, dispose: () => undefined };
  const controller = new AbortController();
  const forward = (source: AbortSignal) => controller.abort(source.reason);
  const forwardFirst = () => forward(first);
  const forwardSecond = () => forward(second);
  if (first.aborted) forward(first);
  else first.addEventListener('abort', forwardFirst, { once: true });
  if (second.aborted) forward(second);
  else second.addEventListener('abort', forwardSecond, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      first.removeEventListener('abort', forwardFirst);
      second.removeEventListener('abort', forwardSecond);
    },
  };
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)).catch(() => undefined);
  });
}
