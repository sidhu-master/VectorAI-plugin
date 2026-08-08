/**
 * AI Gateway - 公司 AI 调度层接入
 *
 * 三级降级策略：
 * 1. 公司 AI 调度端点（COMPANY_AI_GATEWAY_URL + COMPANY_INTERNAL_TOKEN）
 * 2. 直接 LLM 调用（COMPANY_AI_BASE_URL + COMPANY_AI_API_KEY，OpenAI 兼容）
 * 3. Mock 演示模式（无配置时）
 *
 * 未来扩展: Prompt 管理、Few-shot 示例注入、模型选择、成本控制
 */

import type { GeometryEntity, SpatialIntent, SpatialModel } from '../../src/core/types.js';
import { summarizeModel } from '../../src/core/harness.js';
import { PLANNER_PROMPT, buildStepPrompt } from '../../src/core/agent.js';
import type { TaskPlan, TaskStep } from '../../src/core/agent.js';

const SYSTEM_PROMPT = `你是 VectorAI 空间协议引擎。用户会用自然语言描述二维绘图需求，你需要将其转换为 VectorAI Spatial Intent JSON。

## 协议规范

SpatialIntent 格式：
{
  "operation": "create"|"modify"|"replace",
  "objects": [{ "type": "point"|"line"|"circle", "params": {...}, "reference": "可选名称", "id": "修改时必填" }],
  "relations": [{ "kind": "约束类型", "entities": ["引用名或索引"], "value": 数字 }],
  "description": "简要说明",
  "confidence": 0.0-1.0
}

## 操作类型

- create（默认）：新建实体，追加到画布
- modify：修改已有实体，objects 中必须包含 id 字段指定要修改的实体，只返回需要修改的实体
- replace：替换整个画布，清除所有已有实体并使用新实体

## 实体类型

- point: params: { x, y }
- line: params: { start: [x,y], end: [x,y] }
- circle: params: { center: [x,y], radius: r }

## 关系类型

- distance: 两实体距离 = value
- radius: 圆半径 = value
- equal: 两实体属性相等 (property: "radius")
- coincident/horizontal/vertical/parallel/perpendicular/tangent/angle/symmetry

## 示例

用户: "画一个半径20的圆在(100,100)"
输出:
{"operation":"create","objects":[{"type":"circle","params":{"center":[100,100],"radius":20},"reference":"main_circle"}],"description":"半径20mm的圆","confidence":0.95}

用户: "两个相距100mm的孔，半径都为15"
输出:
{"operation":"create","objects":[{"type":"circle","params":{"center":[50,50],"radius":15},"reference":"hole1"},{"type":"circle","params":{"center":[150,50],"radius":15},"reference":"hole2"}],"relations":[{"kind":"equal","entities":["hole1","hole2"],"property":"radius"},{"kind":"distance","entities":["hole1","hole2"],"value":100}],"description":"两个对称排列的安装孔","confidence":0.88}

用户选中了实体 ent_1 (line: start=[0,0], end=[100,0]) 等矩形四条边，请求"把这个矩形放大到200x120"
输出:
{"operation":"modify","objects":[{"type":"line","id":"ent_1","params":{"start":[0,0],"end":[200,0]}},{"type":"line","id":"ent_2","params":{"start":[200,0],"end":[200,120]}},{"type":"line","id":"ent_3","params":{"start":[200,120],"end":[0,120]}},{"type":"line","id":"ent_4","params":{"start":[0,120],"end":[0,0]}}],"description":"将矩形放大到200x120","confidence":0.9}

## 规则

1. 只输出 JSON，不要 Markdown 包裹
2. 坐标单位为 mm
3. 为需要被关系引用的对象设置 reference 名称
4. confidence 反映你对理解用户意图的把握
5. 如果用户描述模糊，合理推测并降低 confidence
6. 当用户要求修改已有图形时，使用 operation: "modify"，并在 objects 中包含 id 字段
7. 当用户选中了实体并要求修改时，只返回需要修改的实体，保留未修改的实体不变`;

const VISION_PROMPT = `分析图片中的工程图纸，恢复设计意图，输出JSON。
格式：{"operation":"create","objects":[{"type":"circle","params":{"center":[x,y],"radius":r},"confidence":0.9}],"relations":[],"description":"摘要","confidence":0.8}
类型：point:{x,y} line:{start:[x,y],end:[x,y]} circle:{center:[x,y],radius:r}
关系：distance/equal/radius，坐标mm，只输出JSON。`;

interface GenerateParams {
  prompt: string;
  context?: SpatialModel;
  unit?: string;
  model?: string;
  selectedEntities?: GeometryEntity[];
}

export async function generateSpatialIntent({
  prompt,
  context,
  unit = 'mm',
  model,
  selectedEntities,
}: GenerateParams): Promise<SpatialIntent> {
  const gatewayUrl = process.env.COMPANY_AI_GATEWAY_URL;
  const internalToken = process.env.COMPANY_INTERNAL_TOKEN;

  // 1. 优先走公司 AI 调度端点
  if (gatewayUrl && internalToken) {
    try {
      return await callCompanyGateway(gatewayUrl, internalToken, prompt, context, unit, model, selectedEntities);
    } catch (err) {
      console.error('[AI Gateway] 公司调度端点失败，降级:', err);
    }
  }

  // 2. 直接 LLM 调用（公司 API Key）
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  if (baseUrl && apiKey) {
    return await callLLMDirect(baseUrl, apiKey, prompt, context, unit, model, selectedEntities);
  }

  // 3. Mock 演示模式
  return mockGenerate(prompt);
}

/** 构建包含 Harness 上下文的用户消息 */
function buildUserMessage(
  prompt: string,
  context: SpatialModel | undefined,
  selectedEntities?: GeometryEntity[],
): string {
  const parts: string[] = [];

  // 使用 Harness 提供模型摘要，而非发送整个原始模型
  if (context && context.entities.length > 0) {
    const summary = summarizeModel(context);
    parts.push(`【画布摘要】`);
    parts.push(`实体总数: ${summary.entityCount}，关系总数: ${summary.relationCount}`);
    parts.push(`类型分布: ${Object.entries(summary.byType).map(([t, c]) => `${t}×${c}`).join(', ')}`);
    if (summary.bbox) {
      parts.push(`包围盒: [${summary.bbox.minX}, ${summary.bbox.minY}] ~ [${summary.bbox.maxX}, ${summary.bbox.maxY}]`);
    }
    // 列出最近实体（Harness search 结果）
    if (summary.recentEntities.length > 0) {
      parts.push(`实体列表:`);
      for (const e of summary.recentEntities) {
        parts.push(`  - ${e.id} (${e.type}): ${e.summary}`);
      }
    }
  }

  // 选中实体详情（Harness inspect 结果）
  if (selectedEntities && selectedEntities.length > 0) {
    parts.push(`\n【选中实体】(${selectedEntities.length} 个)`);
    for (const e of selectedEntities) {
      switch (e.type) {
        case 'point':
          parts.push(`  - ${e.id} (point): x=${e.x}, y=${e.y}`);
          break;
        case 'line':
          parts.push(`  - ${e.id} (line): start=[${e.start[0]},${e.start[1]}], end=[${e.end[0]},${e.end[1]}]`);
          break;
        case 'circle':
          parts.push(`  - ${e.id} (circle): center=[${e.center[0]},${e.center[1]}], radius=${e.radius}`);
          break;
      }
    }
  }

  parts.push(`\n用户请求: ${prompt}`);
  return parts.join('\n');
}

/**
 * 通过公司 AI 调度端点调用
 */
async function callCompanyGateway(
  gatewayUrl: string,
  internalToken: string,
  prompt: string,
  context: SpatialModel | undefined,
  unit: string,
  model?: string,
  selectedEntities?: GeometryEntity[],
): Promise<SpatialIntent> {
  const url = `${gatewayUrl.replace(/\/+$/, '')}/internal/company/ai/chat`;
  const userMessage = buildUserMessage(prompt, context, selectedEntities);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': internalToken,
    },
    body: JSON.stringify({
      product: 'vectorai',
      scene: 'spatial_intent_generation',
      messages: [{ role: 'user', content: userMessage }],
      system_context: SYSTEM_PROMPT,
      model_role: 'planner',
      model: model || process.env.COMPANY_AI_MODEL_NAME || 'doubao-seed-2.0-lite',
    }),
  });

  if (!response.ok) {
    throw new Error(`公司 AI 调度端点错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.ok || !data.reply) {
    throw new Error(data.message || '公司 AI 返回空内容');
  }

  return parseIntentFromReply(data.reply);
}

/**
 * 直接调用 LLM（OpenAI 兼容接口）
 */
async function callLLMDirect(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  context: SpatialModel | undefined,
  unit: string,
  model?: string,
  selectedEntities?: GeometryEntity[],
): Promise<SpatialIntent> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const modelName = model || process.env.COMPANY_AI_MODEL_NAME || 'doubao-seed-2.0-lite';
  const userMessage = buildUserMessage(prompt, context, selectedEntities);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM API 错误: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM 返回空内容');
  }

  return parseIntentFromReply(content);
}

/**
 * 从 LLM 回复文本中解析 SpatialIntent JSON
 */
function parseIntentFromReply(reply: string): SpatialIntent {
  const jsonStr = reply
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(jsonStr) as SpatialIntent;
  } catch {
    // 尝试提取第一个 JSON 对象
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as SpatialIntent;
    }
    throw new Error('无法从 LLM 回复中解析 Spatial Intent JSON');
  }
}

/**
 * 检查 AI 是否已连接
 */
export function getAIStatus(): { connected: boolean; mode: string } {
  const gatewayUrl = process.env.COMPANY_AI_GATEWAY_URL;
  const internalToken = process.env.COMPANY_INTERNAL_TOKEN;
  if (gatewayUrl && internalToken) {
    return { connected: true, mode: 'company-gateway' };
  }
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  if (baseUrl && apiKey) {
    return { connected: true, mode: 'direct-llm' };
  }
  return { connected: false, mode: 'demo' };
}

// ============ 空间感知（图片 -> Spatial Intent） ============

interface PerceiveParams {
  image: string;        // base64 编码图片（不含 data: 前缀）
  mimeType: string;      // image/png, image/jpeg
  model?: string;        // 视觉模型名（可选，默认用 COMPANY_AI_VISION_MODEL 或 COMPANY_AI_MODEL_NAME）
}

/**
 * 从图片感知 Spatial Intent
 * 调用多模态 LLM，通过 Vision Pipeline 恢复设计意图
 */
export async function perceiveFromImage({
  image,
  mimeType,
  model,
}: PerceiveParams): Promise<SpatialIntent> {
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  const visionModel = model
    || process.env.COMPANY_AI_VISION_MODEL
    || process.env.COMPANY_AI_MODEL_NAME
    || 'doubao-seed-2.0-lite';

  console.log('[Vision] 使用模型:', visionModel, '图片大小:', Math.round(image.length * 0.75 / 1024), 'KB');

  if (!baseUrl || !apiKey) {
    console.error('[Vision] AI 未配置');
    throw new Error('AI 未配置：缺少 COMPANY_AI_BASE_URL 或 COMPANY_AI_API_KEY');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const dataUrl = `data:${mimeType};base64,${image}`;

  console.log('[Vision] 发送请求到 LLM...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这张工程图纸/CAD截图，恢复原始设计意图，输出 Spatial Intent JSON。' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(180000), // 3 分钟超时
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[Vision] API 错误:', response.status, errText.slice(0, 300));
    throw new Error(`Vision API 错误: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  console.log('[Vision] LLM 响应成功，使用 tokens:', data.usage?.total_tokens);
  const content = data.choices?.[0]?.message?.content;
  console.log('[Vision] 返回内容长度:', content?.length || 0, '预览:', content?.slice(0, 100));

  if (!content) {
    console.error('[Vision] LLM 返回空内容');
    throw new Error('Vision LLM 返回空内容');
  }

  return parseIntentFromReply(content);
}

// ============ Spatial Agent Workflow ============

export interface PlanParams {
  prompt?: string;
  image?: string;
  mimeType?: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Task Planner: 分析输入，生成分阶段任务计划
 */
export async function planTask({
  prompt,
  image,
  mimeType,
  model,
  signal,
}: PlanParams): Promise<TaskPlan> {
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  const modelName = model || process.env.COMPANY_AI_MODEL_NAME || 'doubao-seed-2.0-lite';

  if (!baseUrl || !apiKey) {
    // 无配置时返回默认计划
    return defaultPlan(prompt || '图片分析');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const userText = prompt || '请分析图片并制定任务计划';

  // 构建 messages（支持图片输入）
  const userContent = image
    ? [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
      ]
    : userText;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Planner API 错误: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Planner 返回空内容');

  return parsePlanFromReply(content);
}

export interface ExecuteStepParams {
  step: TaskStep;
  model: SpatialModel;
  plan: TaskPlan;
  llmModel?: string;
  currentView?: string;  // base64 PNG，当前渲染截图
  currentViewMimeType?: string;
  correctionErrors?: string[];
  signal?: AbortSignal;
}

/**
 * 执行单个任务步骤：调用 LLM 生成此阶段的 Spatial Intent
 * 如果附带 currentView，LLM 能看到当前渲染结果（视觉反馈）
 */
export async function executeAgentStep({
  step,
  model,
  plan,
  llmModel,
  currentView,
  currentViewMimeType,
  correctionErrors,
  signal,
}: ExecuteStepParams): Promise<SpatialIntent> {
  const baseUrl = process.env.COMPANY_AI_BASE_URL;
  const apiKey = process.env.COMPANY_AI_API_KEY;
  const modelName = llmModel || process.env.COMPANY_AI_MODEL_NAME || 'doubao-seed-2.0-lite';

  if (!baseUrl || !apiKey) {
    throw new Error('AI 未配置');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const hasVisual = !!currentView;
  const baseStepPrompt = buildStepPrompt(step, model, plan, hasVisual);
  const stepPrompt = correctionErrors && correctionErrors.length > 0
    ? `${baseStepPrompt}\n\n## 上次验证错误\n${correctionErrors.map((error) => `- ${error}`).join('\n')}\n请修正这些错误。`
    : baseStepPrompt;

  // 构建 user content（有图片时用多模态格式）
  const userContent = hasVisual
    ? [
        { type: 'text', text: stepPrompt },
        { type: 'image_url', image_url: { url: `data:${currentViewMimeType || 'image/png'};base64,${currentView}` } },
      ]
    : stepPrompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
    signal: signal ?? AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Step API 错误: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Step LLM 返回空内容');

  return parseIntentFromReply(content);
}

function parsePlanFromReply(reply: string): TaskPlan {
  const jsonStr = reply
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(jsonStr) as TaskPlan;
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as TaskPlan;
    throw new Error('无法解析 TaskPlan JSON');
  }
}

function defaultPlan(prompt: string): TaskPlan {
  const isImage = prompt.includes('图片') || prompt.includes('图纸');
  return {
    task: isImage ? 'reconstruct_drawing' : 'create_from_text',
    summary: prompt.slice(0, 100),
    steps: isImage
      ? [
          { id: 1, action: 'extract_outline', description: '识别整体轮廓', status: 'pending' as const },
          { id: 2, action: 'detect_features', description: '识别孔/槽/圆角', status: 'pending' as const },
          { id: 3, action: 'apply_dimensions', description: '识别尺寸标注', status: 'pending' as const },
          { id: 4, action: 'build_constraints', description: '建立约束关系', status: 'pending' as const },
          { id: 5, action: 'verify_model', description: '工程验证', status: 'pending' as const },
        ]
      : [
          { id: 1, action: 'create_entities', description: '生成实体', status: 'pending' as const },
          { id: 2, action: 'build_constraints', description: '建立约束', status: 'pending' as const },
        ],
  };
}

/**
 * Mock 生成 - 无配置时的演示模式
 */
function mockGenerate(prompt: string): SpatialIntent {
  const lower = prompt.toLowerCase();

  if (lower.includes('两个') && (lower.includes('孔') || lower.includes('圆'))) {
    const radiusMatch = prompt.match(/(?:半径|radius|r)\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
    const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 15;
    const distMatch = prompt.match(/(?:距离|dist|间隔)\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
    const dist = distMatch ? parseFloat(distMatch[1]) : 100;

    return {
      objects: [
        { type: 'circle', params: { center: [dist / 2, 50], radius }, reference: 'hole1' },
        { type: 'circle', params: { center: [dist / 2 + dist, 50], radius }, reference: 'hole2' },
      ],
      relations: [
        { kind: 'equal', entities: ['hole1', 'hole2'], property: 'radius' },
        { kind: 'distance', entities: ['hole1', 'hole2'], value: dist },
      ],
      description: `两个半径${radius}mm的孔，间距${dist}mm`,
      confidence: 0.75,
    };
  }

  if (lower.includes('矩形') || lower.includes('长方形')) {
    const wMatch = prompt.match(/(?:宽|width|w)\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
    const hMatch = prompt.match(/(?:高|height|h)\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
    const w = wMatch ? parseFloat(wMatch[1]) : 100;
    const h = hMatch ? parseFloat(hMatch[1]) : 60;

    return {
      objects: [
        { type: 'line', params: { start: [0, 0], end: [w, 0] }, reference: 'bottom' },
        { type: 'line', params: { start: [w, 0], end: [w, h] }, reference: 'right' },
        { type: 'line', params: { start: [w, h], end: [0, h] }, reference: 'top' },
        { type: 'line', params: { start: [0, h], end: [0, 0] }, reference: 'left' },
      ],
      relations: [
        { kind: 'horizontal', entities: ['bottom'] },
        { kind: 'horizontal', entities: ['top'] },
        { kind: 'vertical', entities: ['left'] },
        { kind: 'vertical', entities: ['right'] },
      ],
      description: `${w}x${h}mm矩形`,
      confidence: 0.72,
    };
  }

  const radiusMatch = prompt.match(/(?:半径|radius|r)\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
  const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 20;
  const xMatch = prompt.match(/(?:x|横坐标)\s*[:：]?\s*(-?\d+(?:\.\d+)?)/i);
  const yMatch = prompt.match(/(?:y|纵坐标)\s*[:：]?\s*(-?\d+(?:\.\d+)?)/i);
  const x = xMatch ? parseFloat(xMatch[1]) : 100;
  const y = yMatch ? parseFloat(yMatch[1]) : 100;

  return {
    objects: [
      { type: 'circle', params: { center: [x, y], radius }, reference: 'main_circle' },
    ],
    description: `半径${radius}mm的圆，圆心(${x},${y})`,
    confidence: 0.6,
  };
}
