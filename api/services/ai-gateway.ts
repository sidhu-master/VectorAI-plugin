/** Internal model transport for drawing-native planning, decisions, and vision tools. */

import { Agent } from 'undici';

const DRAWING_MODEL_DISPATCHER = new Agent({
  headersTimeout: 12 * 60_000,
  bodyTimeout: 12 * 60_000,
  connectTimeout: 30_000,
});

type DrawingFetchInit = RequestInit & { dispatcher?: Agent };

function modelFetchInit(init: RequestInit): DrawingFetchInit {
  return { ...init, dispatcher: DRAWING_MODEL_DISPATCHER };
}

export function getAIStatus(): { connected: boolean; mode: string } {
  if (process.env.COMPANY_AI_GATEWAY_URL && process.env.COMPANY_INTERNAL_TOKEN) {
    return { connected: true, mode: 'company-gateway' };
  }
  if (process.env.COMPANY_AI_BASE_URL && process.env.COMPANY_AI_API_KEY) {
    return { connected: true, mode: 'direct-llm' };
  }
  return { connected: false, mode: 'demo' };
}

export function isDrawingImageEditConfigured(): boolean {
  return Boolean(
    (process.env.COMPANY_AI_GATEWAY_URL && process.env.COMPANY_INTERNAL_TOKEN)
    || (process.env.COMPANY_AI_IMAGE_EDIT_URL && process.env.COMPANY_AI_API_KEY),
  );
}

export interface DrawingVisionCompletionParams {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  image: string;
  mimeType: string;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
}

export interface DrawingResponseSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface DrawingImageEditTransportInput {
  modelName: string;
  prompt: string;
  cropPng: Buffer;
  maskPng: Buffer;
  protectedMaskPng: Buffer;
  seed: number;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingImageEditTransportResult {
  imageBase64: string;
  providerRequestId: string;
}

export type DrawingImageEditTransport = (
  input: DrawingImageEditTransportInput,
) => Promise<DrawingImageEditTransportResult>;

/** Server-only image edit transport. Pixel output remains untrusted until vectorized and validated. */
export const requestDrawingImageEdit: DrawingImageEditTransport = async (input) => {
  if (Date.now() >= input.deadlineAt) throw new Error('GENERATION_DEADLINE_EXCEEDED');
  const gatewayUrl = process.env.COMPANY_AI_GATEWAY_URL;
  const internalToken = process.env.COMPANY_INTERNAL_TOKEN;
  const directUrl = process.env.COMPANY_AI_IMAGE_EDIT_URL;
  const body = JSON.stringify({
    product: 'vectorai', scene: 'drawing_agent_local_redraw', model: input.modelName,
    prompt: input.prompt, seed: input.seed,
    crop_png_base64: input.cropPng.toString('base64'),
    mask_png_base64: input.maskPng.toString('base64'),
    protected_mask_png_base64: input.protectedMaskPng.toString('base64'),
  });
  let response: Response;
  if (gatewayUrl && internalToken) {
    response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/image-edit`, modelFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
      body, signal: input.signal,
    }));
  } else if (directUrl && process.env.COMPANY_AI_API_KEY) {
    response = await fetch(directUrl, modelFetchInit({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COMPANY_AI_API_KEY}`,
      },
      body, signal: input.signal,
    }));
  } else {
    throw new Error('GENERATION_PROVIDER_UNAVAILABLE');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Drawing Image Edit 错误: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json() as Record<string, unknown>;
  const imageBase64 = imageResultBase64(data);
  if (!imageBase64) throw new Error('GENERATION_PROVIDER_RESULT_EMPTY');
  const providerRequestId = stringValue(data.providerRequestId)
    ?? stringValue(data.request_id)
    ?? response.headers.get('x-request-id')
    ?? `image_edit_${Date.now()}`;
  return { imageBase64, providerRequestId };
};

export interface DrawingMultimodalCompletionParams {
  role: 'grounding' | 'design' | 'verification';
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  images: Array<{ id: string; dataUrl: string; width?: number; height?: number }>;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
  /** 禁用思考型模型的深度推理（仅需要轻量判断的调用使用，如分区语义判断） */
  thinkingDisabled?: boolean;
  onTelemetry?: (telemetry: DrawingModelCallTelemetry) => void;
}

export interface DrawingModelCallTelemetry {
  transport: 'company-gateway' | 'direct-llm';
  role: DrawingMultimodalCompletionParams['role'];
  status: 'succeeded' | 'empty' | 'http_error' | 'invalid_response' | 'transport_error';
  requestBytes: number;
  imageCount: number;
  imageBytes: number;
  imagePixels: number;
  ttfbMs?: number;
  totalMs: number;
  httpStatus?: number;
  requestId?: string;
  providerCompletionId?: string;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  };
}

export class DrawingModelResponseError extends Error {
  constructor(
    readonly code: 'MODEL_HTTP_ERROR' | 'MODEL_EMPTY_CONTENT' | 'MODEL_INVALID_RESPONSE',
    message: string,
    readonly telemetry: DrawingModelCallTelemetry,
  ) {
    super(message);
    this.name = 'DrawingModelResponseError';
  }
}

export async function requestDrawingMultimodalCompletion(
  input: DrawingMultimodalCompletionParams,
): Promise<string> {
  const content = [
    { type: 'text', text: input.userPrompt },
    ...input.images.flatMap((image) => [
      { type: 'text', text: `图像引用: ${image.id}` },
      { type: 'image_url', image_url: { url: image.dataUrl } },
    ]),
  ];
  const gatewayUrl = process.env.COMPANY_AI_GATEWAY_URL;
  const internalToken = process.env.COMPANY_INTERNAL_TOKEN;
  if (gatewayUrl && internalToken) {
    const body = JSON.stringify({
      product: 'vectorai',
      scene: `drawing_agent_${input.role}`,
      messages: [{ role: 'user', content }],
      system_context: input.systemPrompt,
      model_role: input.role,
      model: input.modelName,
      ...responseFormat(input.responseSchema),
    });
    return measuredCompletion({
      input, transport: 'company-gateway', body,
      fetchResponse: () => fetch(
        `${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/chat`,
        modelFetchInit({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
          body,
          signal: input.signal,
        }),
      ),
      companyGateway: true,
      label: 'Drawing Multimodal Gateway',
    });
  }
  const { baseUrl, apiKey } = directModelConfig();
  const body = JSON.stringify({
    model: input.modelName,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    ...(input.thinkingDisabled ? { thinking: { type: 'disabled' } } : {}),
    ...responseFormat(input.responseSchema),
  });
  return measuredCompletion({
    input, transport: 'direct-llm', body,
    fetchResponse: () => fetch(`${baseUrl}/chat/completions`, modelFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
      signal: input.signal,
    })),
    companyGateway: false,
    label: 'Drawing Multimodal',
  });
}

export async function requestDrawingVisionCompletion(
  input: DrawingVisionCompletionParams,
): Promise<string> {
  const { baseUrl, apiKey } = directModelConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, modelFetchInit({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: input.modelName,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: [
          { type: 'text', text: input.userPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:${input.mimeType};base64,${input.image}` },
          },
        ] },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      ...responseFormat(input.responseSchema),
    }),
    signal: input.signal,
  }));
  return completionContent(response, 'Drawing Vision');
}

export interface DrawingAgentCompletionParams {
  role: 'planner' | 'decision';
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
}

/** Model selection remains internal and is never projected into public task events. */
export async function requestDrawingAgentCompletion(
  input: DrawingAgentCompletionParams,
): Promise<string> {
  const gatewayUrl = process.env.COMPANY_AI_GATEWAY_URL;
  const internalToken = process.env.COMPANY_INTERNAL_TOKEN;
  if (gatewayUrl && internalToken) {
    const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/chat`, modelFetchInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
      body: JSON.stringify({
        product: 'vectorai',
        scene: `drawing_agent_${input.role}`,
        messages: [{ role: 'user', content: input.userPrompt }],
        system_context: input.systemPrompt,
        model_role: input.role,
        model: input.modelName,
        ...responseFormat(input.responseSchema),
      }),
      signal: input.signal,
    }));
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Drawing Agent Gateway 错误: ${response.status} ${detail.slice(0, 200)}`);
    }
    const data = await response.json();
    if (!data.ok || typeof data.reply !== 'string' || data.reply.trim() === '') {
      throw new Error(data.message || 'Drawing Agent Gateway 返回空内容');
    }
    return data.reply;
  }

  const { baseUrl, apiKey } = directModelConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, modelFetchInit({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: input.modelName,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      temperature: input.role === 'planner' ? 0.2 : 0.1,
      max_tokens: 4096,
      ...responseFormat(input.responseSchema),
    }),
    signal: input.signal,
  }));
  return completionContent(response, 'Drawing Agent');
}

function responseFormat(schema?: DrawingResponseSchema): Record<string, unknown> {
  return schema ? {
    response_format: {
      type: 'json_schema',
      json_schema: { name: schema.name, strict: true, schema: schema.schema },
    },
  } : {};
}

function directModelConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('AI 未配置');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function completionContent(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${label} API 错误: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error(`${label} 返回空内容`);
  }
  return content;
}

async function measuredCompletion(input: {
  input: DrawingMultimodalCompletionParams;
  transport: DrawingModelCallTelemetry['transport'];
  body: string;
  fetchResponse: () => Promise<Response>;
  companyGateway: boolean;
  label: string;
}): Promise<string> {
  const startedAt = performance.now();
  const request = requestMetrics(input.input, input.transport, input.body);
  let response: Response;
  try {
    response = await input.fetchResponse();
  } catch (error) {
    emitTelemetry(input.input, {
      ...request,
      status: 'transport_error',
      totalMs: elapsed(startedAt),
    });
    throw error;
  }
  const ttfbMs = elapsed(startedAt);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const telemetry: DrawingModelCallTelemetry = {
      ...request,
      status: 'http_error',
      httpStatus: response.status,
      ttfbMs,
      totalMs: elapsed(startedAt),
      ...responseIdentifiers(response, undefined),
    };
    emitTelemetry(input.input, telemetry);
    throw new DrawingModelResponseError(
      'MODEL_HTTP_ERROR',
      `${input.label} API 错误: ${response.status} ${detail.slice(0, 200)}`,
      telemetry,
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    const telemetry: DrawingModelCallTelemetry = {
      ...request,
      status: 'invalid_response',
      httpStatus: response.status,
      ttfbMs,
      totalMs: elapsed(startedAt),
      ...responseIdentifiers(response, undefined),
    };
    emitTelemetry(input.input, telemetry);
    throw new DrawingModelResponseError(
      'MODEL_INVALID_RESPONSE', `${input.label} 返回的不是合法 JSON`, telemetry,
    );
  }
  const metadata = responseMetadata(response, data, input.companyGateway);
  const content = input.companyGateway
    ? (data.ok === true ? stringValue(data.reply) : null)
    : directCompletionText(data);
  if (!content) {
    const telemetry: DrawingModelCallTelemetry = {
      ...request,
      ...metadata,
      status: 'empty',
      httpStatus: response.status,
      ttfbMs,
      totalMs: elapsed(startedAt),
    };
    emitTelemetry(input.input, telemetry);
    const finish = telemetry.finishReason ? `，finish_reason=${telemetry.finishReason}` : '';
    const providerMessage = stringValue(data.message);
    throw new DrawingModelResponseError(
      'MODEL_EMPTY_CONTENT',
      providerMessage ?? `${input.label} 返回空内容${finish}`,
      telemetry,
    );
  }
  emitTelemetry(input.input, {
    ...request,
    ...metadata,
    status: 'succeeded',
    httpStatus: response.status,
    ttfbMs,
    totalMs: elapsed(startedAt),
  });
  return content;
}

function requestMetrics(
  input: DrawingMultimodalCompletionParams,
  transport: DrawingModelCallTelemetry['transport'],
  body: string,
): Pick<
  DrawingModelCallTelemetry,
  'transport' | 'role' | 'requestBytes' | 'imageCount' | 'imageBytes' | 'imagePixels'
> {
  return {
    transport,
    role: input.role,
    requestBytes: Buffer.byteLength(body),
    imageCount: input.images.length,
    imageBytes: input.images.reduce((total, image) => total + dataUrlByteLength(image.dataUrl), 0),
    imagePixels: input.images.reduce((total, image) => (
      total + (image.width && image.height ? image.width * image.height : 0)
    ), 0),
  };
}

function responseMetadata(
  response: Response,
  data: Record<string, unknown>,
  companyGateway: boolean,
): Partial<DrawingModelCallTelemetry> {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = choices[0] && typeof choices[0] === 'object'
    ? choices[0] as Record<string, unknown>
    : undefined;
  const usageSource = recordValue(data.usage)
    ?? (companyGateway ? recordValue(recordValue(data.data)?.usage) : undefined);
  const promptDetails = recordValue(usageSource?.prompt_tokens_details);
  const completionDetails = recordValue(usageSource?.completion_tokens_details);
  const usage = compactRecord({
    inputTokens: numberValue(usageSource?.prompt_tokens),
    outputTokens: numberValue(usageSource?.completion_tokens),
    totalTokens: numberValue(usageSource?.total_tokens),
    cachedInputTokens: numberValue(promptDetails?.cached_tokens),
    reasoningTokens: numberValue(completionDetails?.reasoning_tokens),
  });
  return {
    ...responseIdentifiers(response, data),
    ...(stringValue(choice?.finish_reason) ?? stringValue(data.finish_reason)
      ? { finishReason: stringValue(choice?.finish_reason) ?? stringValue(data.finish_reason)! }
      : {}),
    ...(Object.keys(usage).length > 0 ? { usage } : {}),
  };
}

function responseIdentifiers(
  response: Response,
  data: Record<string, unknown> | undefined,
): Pick<DrawingModelCallTelemetry, never> & {
  requestId?: string;
  providerCompletionId?: string;
} {
  const requestId = response.headers.get('x-request-id')
    ?? response.headers.get('x-tt-logid')
    ?? response.headers.get('trace-id')
    ?? stringValue(data?.request_id)
    ?? stringValue(data?.requestId);
  const providerCompletionId = stringValue(data?.id) ?? stringValue(data?.completion_id);
  return {
    ...(requestId ? { requestId } : {}),
    ...(providerCompletionId ? { providerCompletionId } : {}),
  };
}

function directCompletionText(data: Record<string, unknown>): string | null {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = recordValue(choices[0]);
  return stringValue(recordValue(choice?.message)?.content);
}

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return Buffer.byteLength(dataUrl);
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (/;base64(?:;|$)/i.test(metadata)) return Buffer.from(payload, 'base64').byteLength;
  try {
    return Buffer.byteLength(decodeURIComponent(payload));
  } catch {
    return Buffer.byteLength(payload);
  }
}

function emitTelemetry(
  input: DrawingMultimodalCompletionParams,
  telemetry: DrawingModelCallTelemetry,
): void {
  input.onTelemetry?.(structuredClone(telemetry));
}

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compactRecord<T extends Record<string, unknown>>(value: T): {
  [K in keyof T]?: Exclude<T[K], undefined>;
} {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

function imageResultBase64(data: Record<string, unknown>): string | null {
  const direct = stringValue(data.imageBase64) ?? stringValue(data.image_base64);
  if (direct) return direct;
  const nested = data.data;
  if (!Array.isArray(nested) || !nested[0] || typeof nested[0] !== 'object') return null;
  const first = nested[0] as Record<string, unknown>;
  return stringValue(first.b64_json) ?? stringValue(first.image_base64);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
