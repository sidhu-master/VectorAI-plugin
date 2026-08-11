import { afterEach, describe, expect, it, vi } from 'vitest';

import {
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
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'doubao-seed-2.0-lite', temperature: 0.2,
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
    });
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
    });
  });
});
