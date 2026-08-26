// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent';
import { applySemanticProposals, type SegmentSemanticProposal } from '@vectorai/engineering-annotation';
import type { Vec2 } from '@vectorai/drawing-core';
import type { DrawingSpaceExtensionHost } from '@vectorai/plugin-space-contracts';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PartitionSemanticReviewer } from './partition-service';

export function createPartitionSemanticReviewer(
  ctx: Context & { subagents: SubagentRuntime },
  space: Pick<DrawingSpaceExtensionHost<Agent>, 'renderObservation'>,
  options: { timeoutMs?: number } = {},
): PartitionSemanticReviewer {
  return async ({ agent, draft, segmentIds, signal }) => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('AI_SEMANTIC_REVIEW_TIMEOUT')), options.timeoutMs ?? 30_000);
    const reviewSignal = combineSignals(signal, timeout.signal);
    try {
    const targets = new Set(segmentIds);
    const segments = draft.segments.filter(({ id }) => targets.has(id)).slice(0, 128);
    const overlays = segments.map((segment, index) => ({
      id: `observation:${segment.id}`,
      label: `S${index + 1}`,
      polygon: segmentPolygon(draft.axis, segment.zStart, segment.zEnd, Math.max(segment.profile.maxRadius, 0.1) * 1.08),
    }));
    const rendered = await abortable(space.renderObservation(agent, { ref: draft.drawingRef, overlays }, reviewSignal), reviewSignal);
    if (rendered.status !== 'rendered') throw new Error(`AI_SEMANTIC_OBSERVATION_${rendered.status.toUpperCase()}`);
    const attachment = await abortable(ctx.attachments.saveImage({ data: rendered.png, mediaType: 'image/png', name: 'shaft-segment-observation.png' }), reviewSignal);
    const parent = ctx.agents.get(String(agent.id) as SessionId);
    const providerName = ctx.subagents.list()[0];
    if (!parent || !providerName) throw new Error('AI_SEMANTIC_REVIEW_UNAVAILABLE');
    const provider = ctx.subagents.getProvider(providerName);
    if (!provider?.capabilities.outputSchema || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) throw new Error('AI_SEMANTIC_REVIEW_ISOLATION_REQUIRED');
    // `structured_output` is injected by the subagent runtime for outputSchema.
    // It is not a registered global tool, so passing it to tools.restrict()
    // makes DSH reject the child before the model is started.
    const ambientToolNames = ctx.tools.schemas()
      .map(({ name }) => name)
      .filter((name) => name !== 'structured_output');
    if (ambientToolNames.length === 0) throw new Error('AI_SEMANTIC_REVIEW_ISOLATION_REQUIRED');
    const catalog = segments.map((segment, index) => ({
      id: segment.id,
      visualLabel: `S${index + 1}`,
      visualEvidenceId: `observation:${segment.id}`,
      ordinal: index + 1,
      width: segment.zEnd - segment.zStart,
      diameter: segment.profile.maxRadius * 2,
      boundaryConfidence: segment.boundaryConfidence,
      previousSegmentId: index === 0 ? null : segments[index - 1]!.id,
      nextSegmentId: index === segments.length - 1 ? null : segments[index + 1]!.id,
    }));
    const payload = JSON.stringify({
      instruction: '只根据编号图像识别明确的主要功能区域。允许返回空 proposals，并允许不覆盖全部轴段：过渡段、退刀段、工艺收尾段或证据不足的轴段必须留空，不得为了连续覆盖而强行分类。可将构成同一功能区域的相邻轴段放入同一提案。semanticType 必须从 gear、spline、bearing-seat、shaft-seat、seal-seat、oil-seal-seat、coupling-seat、thread、keyway、shoulder 中选择；name 和 reason 使用简短中文。每个 segmentId 都必须提供对应的 observation:segmentId 视觉证据，confidence 低于 0.8 时不要提议。不要返回坐标、边界、尺寸或几何编辑命令。',
      segments: catalog,
      observationDigest: rendered.contentDigest,
    });
    if (payload.length > 64 * 1024) throw new Error('AI_SEMANTIC_PROMPT_LIMIT');
    const run = await abortable(ctx.subagents.start(providerName, {
      label: 'shaft-partition-semantic-reviewer', parent, signal: reviewSignal,
      maxDepth: 1, toolFilter: { deny: ambientToolNames },
      prompt: [{ type: 'text', text: payload }, { type: 'image', attachment }],
      outputSchema: proposalSchema as never,
    }), reviewSignal);
    try {
      const result = await abortable(run.result, reviewSignal);
      const proposals = result.stopReason === 'completed' ? validateOutput(result.structured) : null;
      if (!proposals) throw new Error('AI_SEMANTIC_REVIEW_INVALID');
      return applySemanticProposals(draft, proposals, {
        allowedSegmentIds: segments.map(({ id }) => id),
        allowedVisualEvidenceIds: segments.map(({ id }) => `observation:${id}`),
      });
    } finally {
      await abortable(run.dispose(), reviewSignal).catch(() => undefined);
    }
    } finally {
      clearTimeout(timer);
    }
  };
}

const proposalSchema = {
  type: 'object', additionalProperties: false, required: ['proposals'],
  properties: { proposals: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['segmentIds', 'semanticType', 'confidence', 'reason', 'visualEvidenceIds'],
    properties: {
      segmentIds: { type: 'array', items: { type: 'string' } },
      semanticType: { type: 'string' }, name: { type: 'string' },
      confidence: { type: 'number' }, reason: { type: 'string' },
      visualEvidenceIds: { type: 'array', items: { type: 'string' } },
    },
  } } },
} as const;

function validateOutput(value: unknown): SegmentSemanticProposal[] | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { proposals?: unknown }).proposals)) return null;
  const proposals = (value as { proposals: unknown[] }).proposals;
  if (proposals.length > 64 || !proposals.every(validProposal)) return null;
  return structuredClone(proposals as SegmentSemanticProposal[]);
}
function validProposal(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const keys = Object.keys(item);
  const allowed = new Set(['segmentIds', 'semanticType', 'name', 'confidence', 'reason', 'visualEvidenceIds']);
  return keys.every((key) => allowed.has(key))
    && ['segmentIds', 'semanticType', 'confidence', 'reason', 'visualEvidenceIds'].every((key) => keys.includes(key))
    && Array.isArray(item.segmentIds) && item.segmentIds.length > 0 && item.segmentIds.every((id) => typeof id === 'string')
    && typeof item.semanticType === 'string' && (item.name === undefined || typeof item.name === 'string')
    && typeof item.confidence === 'number' && typeof item.reason === 'string'
    && Array.isArray(item.visualEvidenceIds) && item.visualEvidenceIds.every((id) => typeof id === 'string');
}

function combineSignals(first: AbortSignal | undefined, second: AbortSignal): AbortSignal {
  if (first === undefined) return second;
  const controller = new AbortController();
  const abort = (source: AbortSignal) => controller.abort(source.reason);
  if (first.aborted) abort(first);
  else first.addEventListener('abort', () => abort(first), { once: true });
  if (second.aborted) abort(second);
  else second.addEventListener('abort', () => abort(second), { once: true });
  return controller.signal;
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)).catch(() => undefined);
  });
}
function segmentPolygon(axis: { origin: Vec2; direction: Vec2; normal: Vec2 }, zStart: number, zEnd: number, radius: number): Array<[number, number]> {
  const at = (z: number, r: number): [number, number] => [axis.origin[0] + axis.direction[0] * z + axis.normal[0] * r, axis.origin[1] + axis.direction[1] * z + axis.normal[1] * r];
  return [at(zStart, -radius), at(zEnd, -radius), at(zEnd, radius), at(zStart, radius)];
}
