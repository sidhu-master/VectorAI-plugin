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
  const reviewBatch = async ({ agent, draft, segmentIds, signal }: Parameters<PartitionSemanticReviewer>[0]): Promise<SegmentSemanticProposal[]> => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('AI_SEMANTIC_REVIEW_TIMEOUT')), options.timeoutMs ?? 60_000);
    const reviewSignal = combineSignals(signal, timeout.signal);
    try {
    const targets = new Set(segmentIds);
    const segments = draft.segments.filter(({ id }) => targets.has(id));
    const segmentById = new Map(draft.segments.map((segment) => [segment.id, segment]));
    const contextGroups = draft.semanticGroups.slice(0, 64).flatMap((group, index) => {
      const related = group.segmentIds.map((id) => segmentById.get(id)).filter((segment) => segment !== undefined);
      if (related.length === 0) return [];
      const zStart = group.range?.zStart ?? Math.min(...related.map((segment) => segment.zStart));
      const zEnd = group.range?.zEnd ?? Math.max(...related.map((segment) => segment.zEnd));
      const radius = Math.max(...related.map((segment) => segment.profile.maxRadius), 0.1) * 1.08;
      const origin = group.evidenceIds
        .map((id) => draft.evidence.find((item) => item.id === id)?.origin)
        .find(Boolean) ?? 'geometry';
      return [{
        group,
        visualLabel: `C${index + 1}`,
        origin,
        overlay: {
          id: `context:${group.id}`,
          label: `C${index + 1} ${group.name ?? group.semanticType}`,
          polygon: segmentPolygon(draft.axis, zStart, zEnd, radius),
        },
      }];
    });
    const targetOverlays = segments.map((segment, index) => ({
      id: `observation:${segment.id}`,
      label: `S${index + 1}`,
      polygon: segmentPolygon(draft.axis, segment.zStart, segment.zEnd, Math.max(segment.profile.maxRadius, 0.1) * 1.08),
    }));
    const overlays = [...contextGroups.map(({ overlay }) => overlay), ...targetOverlays];
    const rendered = await abortable(space.renderObservation(agent, { ref: draft.drawingRef, overlays }, reviewSignal), reviewSignal);
    if (rendered.status !== 'rendered') throw new Error(`AI_SEMANTIC_OBSERVATION_${rendered.status.toUpperCase()}`);
    const attachment = await abortable(ctx.attachments.saveImage({ data: rendered.png, mediaType: 'image/png', name: 'shaft-segment-observation.png' }), reviewSignal);
    const parent = ctx.agents.get(String(agent.id) as SessionId);
    const providerName = ctx.subagents.list()[0];
    if (!parent || !providerName) throw new Error('AI_SEMANTIC_REVIEW_UNAVAILABLE');
    const provider = ctx.subagents.getProvider(providerName);
    if (!provider?.capabilities.outputSchema || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) throw new Error('AI_SEMANTIC_REVIEW_ISOLATION_REQUIRED');
    const catalog = segments.map((segment, index) => ({
      id: segment.id,
      visualLabel: `S${index + 1}`,
      visualEvidenceId: `observation:${segment.id}`,
      ordinal: index + 1,
      width: segment.zEnd - segment.zStart,
      diameter: segment.profile.maxRadius * 2,
      boundaryConfidence: segment.boundaryConfidence,
    }));
    const payload = JSON.stringify({
      instruction: '不要展示分析过程，立即返回要求的结构化结果。C 标签只作为已分类上下文，不得重新分类或放入 proposal；只判断 S 标签对应的候选轴段。只识别有明确视觉证据的主要区域。允许返回空 proposals，并允许不覆盖全部轴段，不得为了连续覆盖而强行分类。可将构成同一语义区域的相邻轴段放入同一提案。semanticType 必须从 gear、spline、bearing-seat、shaft-seat、seal-seat、oil-seal-seat、coupling-seat、thread、keyway、shoulder 中选择。dimensionRole 必须从 functional-feature、process-datum、transition、ordinary 中选择：直接承担传动、配合、密封或连接功能的区域才是 functional-feature；定位轴肩是 process-datum；退刀、收尾或功能区之间的短过渡是 transition；仅有稳定圆柱外形但没有直接功能证据的轴段是 ordinary，不能因为名称含 shaft-seat 就判为 functional-feature。name 和 reason 使用简短中文。每个 segmentId 都必须提供对应的 observation:segmentId 视觉证据，confidence 低于 0.8 时不要提议。不要返回坐标、边界、尺寸或几何编辑命令。',
      segments: catalog,
      existingRegions: contextGroups.map(({ group, visualLabel, origin }) => ({
        visualLabel,
        name: group.name ?? group.semanticType,
        semanticType: group.semanticType,
        dimensionRole: group.dimensionRole,
        origin,
      })),
      observationDigest: rendered.contentDigest,
    });
    if (payload.length > 64 * 1024) throw new Error('AI_SEMANTIC_PROMPT_LIMIT');
    const run = await abortable(ctx.subagents.start(providerName, {
      label: 'shaft-partition-semantic-reviewer', parent, signal: reviewSignal,
      maxDepth: 1, toolFilter: { allow: [] },
      persona: provider.capabilities.persona
        ? 'You are a bounded shaft-region classifier. Do not narrate analysis. Immediately return the requested structured result from the supplied numbered image and segment catalog.'
        : undefined,
      prompt: [{ type: 'text', text: payload }, { type: 'image', attachment }],
      outputSchema: proposalSchema as never,
    }), reviewSignal);
    try {
      const result = await abortable(run.result, reviewSignal);
      const proposals = result.stopReason === 'completed' ? validateOutput(result.structured) : null;
      if (!proposals) throw new Error('AI_SEMANTIC_REVIEW_INVALID');
      return proposals;
    } finally {
      await abortable(run.dispose(), reviewSignal).catch(() => undefined);
    }
    } finally {
      clearTimeout(timer);
    }
  };
  return async (input) => {
    const contextCount = countContextOverlays(input.draft);
    const capacity = Math.max(1, 128 - contextCount);
    const overlap = Math.min(8, capacity - 1);
    const proposals: SegmentSemanticProposal[] = [];
    let nextStart = 0;
    while (nextStart < input.segmentIds.length) {
      const batchStart = nextStart === 0 ? 0 : Math.max(0, nextStart - overlap);
      const batchIds = input.segmentIds.slice(batchStart, batchStart + capacity);
      proposals.push(...await reviewBatch({
        ...input,
        segmentIds: batchIds,
      }));
      nextStart = batchStart + batchIds.length;
      if (nextStart >= input.segmentIds.length) break;
    }
    let reviewed = input.draft;
    const consolidated = consolidateProposals(reviewed, proposals);
    for (let offset = 0; offset < consolidated.length; offset += 64) {
      reviewed = applySemanticProposals(reviewed, consolidated.slice(offset, offset + 64), {
        allowedSegmentIds: input.segmentIds,
        allowedVisualEvidenceIds: input.segmentIds.map((id) => `observation:${id}`),
      }).draft;
    }
    return { draft: reviewed };
  };
}

function countContextOverlays(draft: Parameters<PartitionSemanticReviewer>[0]['draft']): number {
  const segmentIds = new Set(draft.segments.map(({ id }) => id));
  return draft.semanticGroups.slice(0, 64).filter((group) => group.segmentIds.some((id) => segmentIds.has(id))).length;
}

function consolidateProposals(
  draft: Parameters<PartitionSemanticReviewer>[0]['draft'],
  proposals: SegmentSemanticProposal[],
): SegmentSemanticProposal[] {
  const index = new Map(draft.segments.map((segment, position) => [segment.id, position]));
  const merged: SegmentSemanticProposal[] = [];
  for (const proposal of proposals) {
    const matches = merged.filter((candidate) => candidate.semanticType === proposal.semanticType
      && candidate.dimensionRole === proposal.dimensionRole
      && candidate.segmentIds.some((id) => proposal.segmentIds.includes(id)));
    if (matches.length === 0) {
      merged.push(structuredClone(proposal));
      continue;
    }
    const match = matches[0]!;
    const candidates = [...matches, proposal];
    const stronger = candidates.reduce((best, candidate) => candidate.confidence > best.confidence ? candidate : best);
    match.segmentIds = [...new Set(candidates.flatMap(({ segmentIds }) => segmentIds))]
      .sort((left, right) => (index.get(left) ?? 0) - (index.get(right) ?? 0));
    match.visualEvidenceIds = [...new Set(candidates.flatMap(({ visualEvidenceIds }) => visualEvidenceIds))];
    match.confidence = Math.min(...candidates.map(({ confidence }) => confidence));
    match.reason = stronger.reason;
    if (stronger.name === undefined) delete match.name;
    else match.name = stronger.name;
    for (const duplicate of matches.slice(1)) merged.splice(merged.indexOf(duplicate), 1);
  }
  const assigned = new Set<string>();
  return merged.sort((left, right) => right.confidence - left.confidence).filter((proposal) => {
    if (proposal.segmentIds.some((id) => assigned.has(id))) return false;
    proposal.segmentIds.forEach((id) => assigned.add(id));
    return true;
  });
}

const proposalSchema = {
  type: 'object', additionalProperties: false, required: ['proposals'],
  properties: { proposals: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['segmentIds', 'semanticType', 'dimensionRole', 'confidence', 'reason', 'visualEvidenceIds'],
    properties: {
      segmentIds: { type: 'array', items: { type: 'string' } },
      semanticType: { type: 'string' }, dimensionRole: { type: 'string' }, name: { type: 'string' },
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
  const allowed = new Set(['segmentIds', 'semanticType', 'dimensionRole', 'name', 'confidence', 'reason', 'visualEvidenceIds']);
  return keys.every((key) => allowed.has(key))
    && ['segmentIds', 'semanticType', 'dimensionRole', 'confidence', 'reason', 'visualEvidenceIds'].every((key) => keys.includes(key))
    && Array.isArray(item.segmentIds) && item.segmentIds.length > 0 && item.segmentIds.every((id) => typeof id === 'string')
    && typeof item.semanticType === 'string' && (item.name === undefined || typeof item.name === 'string')
    && typeof item.dimensionRole === 'string' && DIMENSION_ROLES.has(item.dimensionRole)
    && typeof item.confidence === 'number' && typeof item.reason === 'string'
    && Array.isArray(item.visualEvidenceIds) && item.visualEvidenceIds.every((id) => typeof id === 'string');
}

const DIMENSION_ROLES = new Set([
  'functional-feature', 'process-datum', 'transition', 'ordinary',
]);

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
