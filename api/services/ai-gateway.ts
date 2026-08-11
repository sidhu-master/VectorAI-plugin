/** Internal model transport for drawing-native planning, decisions, and vision tools. */

export function getAIStatus(): { connected: boolean; mode: string } {
  if (process.env.COMPANY_AI_GATEWAY_URL && process.env.COMPANY_INTERNAL_TOKEN) {
    return { connected: true, mode: 'company-gateway' };
  }
  if (process.env.COMPANY_AI_BASE_URL && process.env.COMPANY_AI_API_KEY) {
    return { connected: true, mode: 'direct-llm' };
  }
  return { connected: false, mode: 'demo' };
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
    response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/image-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
      body, signal: input.signal,
    });
  } else if (directUrl && process.env.COMPANY_AI_API_KEY) {
    response = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COMPANY_AI_API_KEY}`,
      },
      body, signal: input.signal,
    });
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
  images: Array<{ id: string; dataUrl: string }>;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
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
    const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
      body: JSON.stringify({
        product: 'vectorai',
        scene: `drawing_agent_${input.role}`,
        messages: [{ role: 'user', content }],
        system_context: input.systemPrompt,
        model_role: input.role,
        model: input.modelName,
        ...responseFormat(input.responseSchema),
      }),
      signal: input.signal,
    });
    return companyCompletionContent(response, 'Drawing Multimodal Gateway');
  }
  const { baseUrl, apiKey } = directModelConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: input.modelName,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      ...responseFormat(input.responseSchema),
    }),
    signal: input.signal,
  });
  return completionContent(response, 'Drawing Multimodal');
}

export async function requestDrawingVisionCompletion(
  input: DrawingVisionCompletionParams,
): Promise<string> {
  const { baseUrl, apiKey } = directModelConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  });
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
    const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/chat`, {
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
    });
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
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  });
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

async function companyCompletionContent(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${label} 错误: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  if (!data.ok || typeof data.reply !== 'string' || data.reply.trim() === '') {
    throw new Error(data.message || `${label} 返回空内容`);
  }
  return data.reply;
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
