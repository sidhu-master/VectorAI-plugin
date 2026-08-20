import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DrawingModelResponseError,
  isDrawingImageEditConfigured,
  requestDrawingAgentCompletion,
  requestDrawingMultimodalCompletion,
} from './ai-gateway';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('Drawing Agent AI Gateway', () => {
  it('passes the selected model and AbortSignal to the company gateway', async () => {
    process.env.COMPANY_AI_GATEWAY_URL = 'http://gateway.local/';
    process.env.COMPANY_INTERNAL_TOKEN = 'internal-token';
    delete process.env.COMPANY_AI_BASE_URL;
    delete process.env.COMPANY_AI_API_KEY;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({
        ok: true, reply: '{"type":"finish","summary":"done"}',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    const reply = await requestDrawingAgentCompletion({
      role: 'decision', modelName: 'doubao-seed-2.1-turbo',
      systemPrompt: 'system', userPrompt: 'user', signal,
    });

    expect(reply).toContain('finish');
    const call = fetchMock.mock.calls[0];
    if (!call?.[1]) throw new Error('expected fetch call');
    const [url, init] = call;
    expect(url).toBe('http://gateway.local/internal/company/ai/chat');
    expect(init.signal).toBe(signal);
    expect(JSON.parse(init.body as string)).toMatchObject({
      product: 'vectorai', scene: 'drawing_agent_decision',
      model_role: 'decision', model: 'doubao-seed-2.1-turbo',
      system_context: 'system', messages: [{ role: 'user', content: 'user' }],
    });
  });

  it('uses the OpenAI-compatible local endpoint when no gateway is configured', async () => {
    delete process.env.COMPANY_AI_GATEWAY_URL;
    delete process.env.COMPANY_INTERNAL_TOKEN;
    process.env.COMPANY_AI_BASE_URL = 'http://models.local/v1/';
    process.env.COMPANY_AI_API_KEY = 'api-key';
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"goal":{}}' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    await requestDrawingAgentCompletion({
      role: 'planner', modelName: 'doubao-seed-2.0-lite',
      systemPrompt: 'system', userPrompt: 'user', signal,
    });

    const call = fetchMock.mock.calls[0];
    if (!call?.[1]) throw new Error('expected fetch call');
    const [url, init] = call;
    expect(url).toBe('http://models.local/v1/chat/completions');
    expect(init.signal).toBe(signal);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer api-key' });
    expect((init as RequestInit & { dispatcher?: unknown }).dispatcher).toBeDefined();
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'doubao-seed-2.0-lite', temperature: 0.2,
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
    });
  });

  it('reports image editing only when its actual transport is configured', () => {
    delete process.env.COMPANY_AI_GATEWAY_URL;
    delete process.env.COMPANY_INTERNAL_TOKEN;
    delete process.env.COMPANY_AI_IMAGE_EDIT_URL;
    process.env.COMPANY_AI_API_KEY = 'chat-key-alone-is-not-enough';
    expect(isDrawingImageEditConfigured()).toBe(false);

    process.env.COMPANY_AI_IMAGE_EDIT_URL = 'http://images.local/edit';
    expect(isDrawingImageEditConfigured()).toBe(true);

    delete process.env.COMPANY_AI_IMAGE_EDIT_URL;
    process.env.COMPANY_AI_GATEWAY_URL = 'http://gateway.local';
    process.env.COMPANY_INTERNAL_TOKEN = 'internal-token';
    expect(isDrawingImageEditConfigured()).toBe(true);
  });

  it('sends multiple grounded images through the configured company gateway', async () => {
    process.env.COMPANY_AI_GATEWAY_URL = 'http://gateway.local/';
    process.env.COMPANY_INTERNAL_TOKEN = 'internal-token';
    const fetchMock = vi.fn(async (
      _url: string | URL | Request,
      _init?: RequestInit,
    ) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({
        ok: true, reply: '{"features":[]}',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    await requestDrawingMultimodalCompletion({
      role: 'grounding',
      modelName: 'doubao-seed-2.1-turbo',
      systemPrompt: 'system',
      userPrompt: 'ground these views',
      images: [{ id: 'overview', dataUrl: 'data:image/png;base64,AAAA' }],
      responseSchema: {
        name: 'feature_graph',
        schema: { type: 'object', properties: { features: { type: 'array' } } },
      },
      signal: new AbortController().signal,
    });

    const init = fetchMock.mock.calls[0]?.[1];
    if (!init) throw new Error('expected fetch call');
    expect(JSON.parse(init.body as string)).toMatchObject({
      scene: 'drawing_agent_grounding', model_role: 'grounding',
      model: 'doubao-seed-2.1-turbo',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'ground these views' },
        { type: 'text', text: '图像引用: overview' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      ] }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'feature_graph', strict: true,
          schema: { type: 'object', properties: { features: { type: 'array' } } },
        },
      },
    });
  });

  it('passes a strict response schema to the direct model endpoint', async () => {
    delete process.env.COMPANY_AI_GATEWAY_URL;
    delete process.env.COMPANY_INTERNAL_TOKEN;
    process.env.COMPANY_AI_BASE_URL = 'http://models.local/v1/';
    process.env.COMPANY_AI_API_KEY = 'api-key';
    const fetchMock = vi.fn(async (
      _url: string | URL | Request,
      _init?: RequestInit,
    ) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"type":"connected"}' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    await requestDrawingMultimodalCompletion({
      role: 'grounding', modelName: 'model', systemPrompt: 'system', userPrompt: 'user',
      images: [], signal: new AbortController().signal,
      responseSchema: {
        name: 'relation',
        schema: { type: 'object', properties: { type: { enum: ['connected'] } } },
      },
    });

    const init = fetchMock.mock.calls[0]?.[1];
    if (!init) throw new Error('expected fetch call');
    expect(JSON.parse(init.body as string).response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'relation', strict: true,
        schema: { type: 'object', properties: { type: { enum: ['connected'] } } },
      },
    });
  });

  it('reports audit-safe request, image, timing, provider and token telemetry', async () => {
    delete process.env.COMPANY_AI_GATEWAY_URL;
    delete process.env.COMPANY_INTERNAL_TOKEN;
    process.env.COMPANY_AI_BASE_URL = 'http://models.local/v1/';
    process.env.COMPANY_AI_API_KEY = 'api-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'completion_1',
      choices: [{
        finish_reason: 'stop',
        message: { content: '{"type":"finish","summary":"done"}' },
      }],
      usage: {
        prompt_tokens: 321,
        completion_tokens: 45,
        total_tokens: 366,
        prompt_tokens_details: { cached_tokens: 120 },
        completion_tokens_details: { reasoning_tokens: 17 },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'request_1' },
    })));
    const telemetry = vi.fn();

    await requestDrawingMultimodalCompletion({
      role: 'design', modelName: 'model', systemPrompt: 'system', userPrompt: 'user',
      images: [{
        id: 'focus', dataUrl: 'data:image/png;base64,AAAA', width: 12, height: 10,
      }],
      signal: new AbortController().signal,
      onTelemetry: telemetry,
    });

    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'direct-llm', role: 'design', status: 'succeeded', httpStatus: 200,
      requestId: 'request_1', providerCompletionId: 'completion_1', finishReason: 'stop',
      imageCount: 1, imageBytes: 3, imagePixels: 120,
      requestBytes: expect.any(Number), ttfbMs: expect.any(Number), totalMs: expect.any(Number),
      usage: {
        inputTokens: 321, outputTokens: 45, totalTokens: 366,
        cachedInputTokens: 120, reasoningTokens: 17,
      },
    }));
    expect(telemetry.mock.calls[0]?.[0].requestBytes).toBeGreaterThan(100);
  });

  it('distinguishes a 200 empty completion caused by token exhaustion from a network failure', async () => {
    delete process.env.COMPANY_AI_GATEWAY_URL;
    delete process.env.COMPANY_INTERNAL_TOKEN;
    process.env.COMPANY_AI_BASE_URL = 'http://models.local/v1/';
    process.env.COMPANY_AI_API_KEY = 'api-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'completion_empty',
      choices: [{ finish_reason: 'length', message: { content: '' } }],
      usage: {
        prompt_tokens: 200,
        completion_tokens: 4096,
        completion_tokens_details: { reasoning_tokens: 4096 },
      },
    }), { status: 200, headers: { 'x-tt-logid': 'log_1' } })));
    const telemetry = vi.fn();

    const completion = requestDrawingMultimodalCompletion({
      role: 'design', modelName: 'model', systemPrompt: 'system', userPrompt: 'user',
      images: [], signal: new AbortController().signal, onTelemetry: telemetry,
    });

    await expect(completion).rejects.toMatchObject({
      name: DrawingModelResponseError.name,
      code: 'MODEL_EMPTY_CONTENT',
      message: expect.stringContaining('finish_reason=length'),
    });
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      status: 'empty', httpStatus: 200, requestId: 'log_1', finishReason: 'length',
      usage: expect.objectContaining({ reasoningTokens: 4096 }),
    }));
  });
});
