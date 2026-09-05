// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import {
  DshRecognitionModelAdapter,
  SUPPORTED_DSH_RECOGNITION_VERSION,
  loadDshRecognitionVersions,
  type DshRecognitionAgentConfig,
  type DshRecognitionBridge,
  type DshRecognitionBridgeRun,
  type DshRecognitionProvider,
  type DshRecognitionStartRequest,
  type DshRecognitionStreamOptions,
} from './dsh-recognition-model-adapter';
import type { RecognitionModelRequest } from './recognition-runtime';
import { DSH_RUNTIME_VERSION } from './dsh-runtime-baseline.generated';

const request: RecognitionModelRequest<{ proposals: unknown[] }> = {
  pipelineId: 'partition',
  pipelineVersion: '1',
  parentSessionId: 'parent',
  prompt: [
    { type: 'text', text: 'SECRET_PROMPT_BODY' },
    { type: 'image', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png', name: 'observation.png' },
  ],
  outputSchema: { type: 'object', properties: {} },
  persona: 'bounded reviewer',
  maxDepth: 1,
  maxTokens: 256,
  timeoutMs: 1_000,
};

describe('DshRecognitionModelAdapter', () => {
  it('uses the generated runtime baseline independently of the build-time SDK packages', () => {
    expect(SUPPORTED_DSH_RECOGNITION_VERSION).toBe(DSH_RUNTIME_VERSION);
    expect(loadDshRecognitionVersions()).toEqual({
      agent: '0.1.2-rc.1',
      llm: '0.1.2-rc.1',
      subagent: '0.1.2-rc.1',
    });
  });

  it('correlates every child request and returns only sanitized observations', async () => {
    const fixture = createFakeBridge({
      modelCalls: [modelCall(), modelCall({ messageCount: 5 })],
      structured: { proposals: [] },
    });

    const result = await new DshRecognitionModelAdapter(fixture.bridge).review(request);

    expect(result.structured).toEqual({ proposals: [] });
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0]).toMatchObject({
      provider: 'deepseek-official',
      model: 'fixture-model',
      reasoningEffort: 'high',
      maxTokens: 256,
      messageCount: 3,
      toolNames: ['structured_output'],
      runtimeVersions: {
        agent: SUPPORTED_DSH_RECOGNITION_VERSION,
        llm: SUPPORTED_DSH_RECOGNITION_VERSION,
        subagent: SUPPORTED_DSH_RECOGNITION_VERSION,
      },
    });
    expect(result.observations[0]?.requestDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.observations[0]?.systemDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('SECRET_PROMPT_BODY');
    expect(JSON.stringify(result)).not.toContain('bounded reviewer');
    expect(fixture.savedImages).toEqual([{ bytes: [1, 2, 3], mediaType: 'image/png', name: 'observation.png' }]);
    expect(fixture.disposedRuns).toBe(1);
    expect(fixture.activeListenerCount()).toBe(0);
  });

  it('rejects an unsupported DSH package version before starting a child', async () => {
    const fixture = createFakeBridge({ versions: {
      agent: '0.1.2-alpha.4',
      llm: SUPPORTED_DSH_RECOGNITION_VERSION,
      subagent: SUPPORTED_DSH_RECOGNITION_VERSION,
    } });

    await expect(new DshRecognitionModelAdapter(fixture.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_VERSION_MISMATCH:agent:0.1.2-alpha.4');
    expect(fixture.startedRuns()).toBe(0);
  });

  it('requires the complete provider capability contract', async () => {
    const fixture = createFakeBridge({ capabilities: { persona: false } });

    await expect(new DshRecognitionModelAdapter(fixture.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_CAPABILITY_REQUIRED:persona');
    expect(fixture.startedRuns()).toBe(0);
  });

  it('fails loud when the parent or provider cannot be resolved', async () => {
    const missingParent = createFakeBridge({ parentAvailable: false });
    await expect(new DshRecognitionModelAdapter(missingParent.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_PARENT_UNAVAILABLE');

    const missingProvider = createFakeBridge({ providerAvailable: false });
    await expect(new DshRecognitionModelAdapter(missingProvider.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_PROVIDER_UNAVAILABLE');
  });

  it('fails when the published child produces no correlated llm request', async () => {
    const fixture = createFakeBridge({ modelCalls: [] });

    await expect(new DshRecognitionModelAdapter(fixture.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_OBSERVATION_MISSING');
    expect(fixture.disposedRuns).toBe(1);
    expect(fixture.activeListenerCount()).toBe(0);
  });

  it('detects route drift between agent/request and llm/stream', async () => {
    const fixture = createFakeBridge({
      modelCalls: [modelCall({ streamModel: 'different-model' })],
    });

    await expect(new DshRecognitionModelAdapter(fixture.bridge).review(request))
      .rejects.toThrow('DSH_RECOGNITION_ROUTE_MISMATCH');
    expect(fixture.disposedRuns).toBe(1);
  });

  it('accepts provider defaults resolved only at llm/stream', async () => {
    const call = modelCall();
    const fixture = createFakeBridge({
      modelCalls: [{
        request: {
          provider: call.request.provider,
          model: call.request.model,
          maxTokens: call.request.maxTokens,
        } as DshRecognitionAgentConfig,
        stream: call.stream,
      }],
    });

    await expect(new DshRecognitionModelAdapter(fixture.bridge).review(request))
      .resolves.toMatchObject({ observations: [expect.objectContaining({ reasoningEffort: 'high' })] });
  });

  it('keeps the subagent transport provider separate from the LLM route', async () => {
    const call = modelCall({
      requestProvider: 'llm-provider', requestModel: 'llm-model',
      streamProvider: 'llm-provider', streamModel: 'llm-model',
    });
    const fixture = createFakeBridge({ modelCalls: [call] });

    await new DshRecognitionModelAdapter(fixture.bridge).review({
      ...request,
      route: {
        subagentProvider: 'spawn-provider',
        provider: 'llm-provider',
        model: 'llm-model',
        reasoningEffort: 'high',
      },
    });

    expect(fixture.lookedUpProviders).toEqual(['spawn-provider']);
    expect(fixture.startedProviders).toEqual(['spawn-provider']);
    expect(fixture.startRequests[0]?.agentOptions).toMatchObject({
      provider: 'llm-provider', model: 'llm-model', reasoningEffort: 'high', maxTokens: 256,
    });
  });

  it('uses stable timeout and cancellation errors and releases listeners', async () => {
    const timedOut = createFakeBridge({ hang: true });
    await expect(new DshRecognitionModelAdapter(timedOut.bridge).review({ ...request, timeoutMs: 5 }))
      .rejects.toThrow('DSH_RECOGNITION_TIMEOUT');
    expect(timedOut.activeListenerCount()).toBe(0);

    const controller = new AbortController();
    controller.abort(new Error('caller stopped'));
    const aborted = createFakeBridge();
    await expect(new DshRecognitionModelAdapter(aborted.bridge).review({ ...request, signal: controller.signal }))
      .rejects.toThrow('DSH_RECOGNITION_ABORTED');
    expect(aborted.activeListenerCount()).toBe(0);
  });

  it('releases caller abort forwarding after a successful review', async () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    await new DshRecognitionModelAdapter(createFakeBridge().bridge).review({
      ...request,
      signal: controller.signal,
    });

    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});

function modelCall(overrides: Partial<{
  requestProvider: string;
  requestModel: string;
  streamProvider: string;
  streamModel: string;
  messageCount: number;
}> = {}): { request: DshRecognitionAgentConfig; stream: DshRecognitionStreamOptions } {
  return {
    request: {
      provider: overrides.requestProvider ?? 'deepseek-official',
      model: overrides.requestModel ?? 'fixture-model',
      reasoningEffort: 'high',
      maxTokens: 256,
    },
    stream: {
      provider: overrides.streamProvider ?? 'deepseek-official',
      model: overrides.streamModel ?? 'fixture-model',
      reasoningEffort: 'high',
      maxTokens: 256,
      messages: Array.from({ length: overrides.messageCount ?? 3 }, (_, index) => ({
        role: index === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `message-${index}` }],
      })),
      system: 'SYSTEM_PROMPT_BODY',
      tools: [{ name: 'structured_output', description: 'capture', parameters: {} }],
      sessionId: 'child',
    } as DshRecognitionStreamOptions,
  };
}

function createFakeBridge(options: {
  versions?: { agent: string; llm: string; subagent: string };
  capabilities?: Partial<DshRecognitionProvider['capabilities']>;
  parentAvailable?: boolean;
  providerAvailable?: boolean;
  modelCalls?: ReturnType<typeof modelCall>[];
  structured?: unknown;
  hang?: boolean;
} = {}) {
  const starts = new Set<(event: { id: string; provider: string }) => void>();
  const requests = new Set<(event: { agentId: string; config: ReturnType<typeof modelCall>['request'] }) => void>();
  const streams = new Set<(options: ReturnType<typeof modelCall>['stream']) => void>();
  const savedImages: Array<{ bytes: number[]; mediaType: string; name: string }> = [];
  let started = 0;
  let disposedRuns = 0;
  const lookedUpProviders: string[] = [];
  const startedProviders: string[] = [];
  const startRequests: DshRecognitionStartRequest[] = [];
  const baseCapabilities = {
    agentOptions: true,
    outputSchema: true,
    depthLimit: true,
    toolFilter: true,
    persona: true,
  };
  const provider: DshRecognitionProvider = {
    capabilities: { ...baseCapabilities, ...options.capabilities },
  };
  const bridge: DshRecognitionBridge = {
    versions: options.versions ?? {
      agent: SUPPORTED_DSH_RECOGNITION_VERSION,
      llm: SUPPORTED_DSH_RECOGNITION_VERSION,
      subagent: SUPPORTED_DSH_RECOGNITION_VERSION,
    },
    getParent: () => options.parentAvailable === false ? undefined : { id: 'parent' },
    listProviders: () => options.providerAvailable === false ? [] : ['spawn'],
    getProvider: (name) => {
      lookedUpProviders.push(name);
      return options.providerAvailable === false ? undefined : provider;
    },
    saveImage: async (input) => {
      savedImages.push({ bytes: [...input.data], mediaType: input.mediaType, name: input.name });
      return { id: 'attachment-1' };
    },
    onSubagentStart: (_parent, listener) => register(starts, listener),
    onAgentRequest: (listener) => register(requests, listener),
    onLlmStream: (listener) => register(streams, listener),
    startSubagent: async (providerName, startRequest): Promise<DshRecognitionBridgeRun> => {
      started += 1;
      startedProviders.push(providerName);
      startRequests.push(startRequest);
      if (options.hang) {
        return new Promise((_resolve, reject) => {
          startRequest.signal.addEventListener('abort', () => reject(startRequest.signal.reason), { once: true });
        });
      }
      starts.forEach((listener) => listener({ id: 'child', provider: providerName }));
      for (const call of options.modelCalls ?? [modelCall()]) {
        requests.forEach((listener) => listener({ agentId: 'child', config: call.request }));
        streams.forEach((listener) => listener(call.stream));
      }
      return {
        id: 'child',
        result: Promise.resolve({
          stopReason: 'completed',
          structured: options.structured ?? { proposals: [] },
        }),
        dispose: async () => { disposedRuns += 1; },
      };
    },
  };
  return {
    bridge,
    savedImages,
    startedRuns: () => started,
    activeListenerCount: () => starts.size + requests.size + streams.size,
    lookedUpProviders,
    startedProviders,
    startRequests,
    get disposedRuns() { return disposedRuns; },
  };
}

function register<T>(listeners: Set<T>, listener: T): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
