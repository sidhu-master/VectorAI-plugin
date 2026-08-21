// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent';

import type { SemanticEditServicePorts } from './semantic-edit-service';
import { renderReviewComparison } from './review-renderer';

export function createDshReviewer(
  ctx: Context & { subagents: SubagentRuntime },
): NonNullable<SemanticEditServicePorts['review']> {
  return async (input) => {
    const parent = ctx.agents.get(input.sessionId as SessionId);
    const providerName = ctx.subagents.list()[0];
    if (!parent || !providerName) return { outcome: 'unavailable', defects: [] };
    const provider = ctx.subagents.getProvider(providerName);
    if (!provider?.capabilities.outputSchema || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) {
      return { outcome: 'unavailable', defects: [] };
    }
    const signal = input.signal ?? new AbortController().signal;
    const rendered = await renderReviewComparison({
      before: input.beforeDocument,
      after: input.afterDocument,
      viewport: input.viewport,
      changedNodeIds: input.changedNodeIds,
    });
    const attachment = await ctx.attachments.saveImage({
      data: rendered.png,
      mediaType: 'image/png',
      name: 'drawing-before-after.png',
    });
    const render = {
      ...rendered.manifest,
      contentDigest: rendered.contentDigest,
    };
    let run;
    try {
      run = await ctx.subagents.start(providerName, {
        label: 'drawing-reviewer',
        parent,
        signal,
        maxDepth: 1,
        toolFilter: { allow: ['structured_output'] },
        persona: provider.capabilities.persona
          ? 'You are a read-only drawing edit reviewer. Evaluate only the supplied bounded semantic diff. Never request or execute tools.'
          : undefined,
        prompt: [{ type: 'text', text: JSON.stringify({
          instruction: 'Return satisfied only when the changed nodes and diagnostics support the objective without a visible semantic defect.',
          objective: input.objective,
          beforeSemanticDigest: input.beforeSemanticDigest,
          afterSemanticDigest: input.afterSemanticDigest,
          effectDigest: input.effectDigest,
          changedNodeIds: input.changedNodeIds,
          diagnostics: input.diagnostics,
          comparisonLayout: rendered.manifest.comparisonLayout,
          rendererVersion: rendered.manifest.rendererVersion,
          comparisonContentDigest: rendered.contentDigest,
        }) }, { type: 'image', attachment }],
        outputSchema: {
          type: 'object',
          properties: {
            outcome: { type: 'string', enum: ['satisfied', 'needs_revision'] },
            defects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  reason: { type: 'string' },
                  scopeDigest: { type: 'string' },
                },
                required: ['code', 'reason', 'scopeDigest'],
                additionalProperties: false,
              },
            },
          },
          required: ['outcome', 'defects'],
          additionalProperties: false,
        },
      });
    } catch {
      return { outcome: 'unavailable', defects: [], render };
    }
    try {
      let result;
      try {
        result = await run.result;
      } catch {
        return { outcome: 'unavailable', defects: [], render };
      }
      const verdict = result.stopReason === 'completed'
        ? reviewerVerdict(result.structured, result.output)
        : null;
      if (!verdict) {
        return { outcome: 'unavailable', defects: [], render };
      }
      return {
        ...structuredClone(verdict),
        render,
      };
    } finally {
      await run.dispose();
    }
  };
}

function reviewerVerdict(structured: unknown, output: unknown): {
  outcome: 'satisfied' | 'needs_revision';
  defects: Array<{ code: string; reason: string; scopeDigest: string }>;
} | null {
  if (validReview(structured)) return structured;
  if (!Array.isArray(output)) return null;
  const text = output
    .filter((block): block is { type: 'text'; text: string } => (
      !!block && typeof block === 'object'
      && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string'
    ))
    .map(({ text }) => text)
    .join('\n');
  if (text.length === 0 || text.length > 20_000) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return validReview(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validReview(value: unknown): value is {
  outcome: 'satisfied' | 'needs_revision';
  defects: Array<{ code: string; reason: string; scopeDigest: string }>;
} {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.outcome === 'satisfied' || candidate.outcome === 'needs_revision')
    && Array.isArray(candidate.defects)
    && candidate.defects.length <= 32
    && candidate.defects.every((defect) => {
      if (!defect || typeof defect !== 'object') return false;
      const item = defect as Record<string, unknown>;
      return typeof item.code === 'string' && typeof item.reason === 'string' && typeof item.scopeDigest === 'string';
    });
}
