import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PRODUCTION_ROOTS = ['api', 'src', 'python']
  .map((path) => resolve(process.cwd(), path));

describe('generic spatial architecture', () => {
  it('wires the production server only through the model-led Drawing IR runtime', async () => {
    const appSource = await readFile(resolve(process.cwd(), 'api/app.ts'), 'utf8');

    expect(appSource).toContain('ModelLedDrawingAgentRuntime');
    expect(appSource).toContain('createModelDrawingToolGateway');
    expect(appSource).toContain('FileHumanInteractionStore');
    expect(appSource).not.toMatch(
      /\bDrawingAgentRuntime\b|DrawingPlannerAdapter|DrawingDecisionAdapter|DrawingAcceptanceAdapter|DrawingSpatialDesignAdapter|DrawingSemanticRegionAdapter|DrawingFeedbackLoop/,
    );
  });

  it('keeps production selection and validation free of fixture-specific semantic rules', async () => {
    const sources = await productionSources();

    expect(sources.join('\n')).not.toMatch(
      /打招呼|挥手|抬手|肩膀|肩部|手臂|胳膊|肢体|躯干|脚部|右手|左手|SEMANTIC_HAND|waving|shoulder/i,
    );
  });

  it('does not retain the region-intersection and second model selection pipeline', async () => {
    const sources = await productionSources();

    expect(sources.join('\n')).not.toMatch(
      /RegionResolver|fragmentSelector|FRAGMENT_SELECTION|selecting_fragments|isAdditiveRedrawGoal/,
    );
  });

  it('uses the World Model for the production first-decision path without a visual gate', async () => {
    const gateway = await readFile(resolve(
      process.cwd(), 'api/services/drawing-tools/index.ts',
    ), 'utf8');
    const runtime = await readFile(resolve(
      process.cwd(), 'api/services/drawing-agent/model-loop-runtime.ts',
    ), 'utf8');

    expect(gateway).toContain('DrawingWorldModelTools');
    expect(runtime).toContain('buildModelWorldContext');
    expect(runtime).not.toContain('PREVIEW_VISUAL_EVALUATION_REQUIRED');
  });
});

async function productionSources(): Promise<string[]> {
  const files = (await Promise.all(PRODUCTION_ROOTS.map(productionFiles))).flat();
  return Promise.all(files.map((file) => readFile(file, 'utf8')));
}

async function productionFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : productionFiles(path);
    if (!isProductionSource(entry.name)) return [];
    return [path];
  }));
  return nested.flat();
}

function isProductionSource(name: string): boolean {
  return /\.(?:ts|tsx|py)$/.test(name)
    && !/\.test\.(?:ts|tsx|py)$/.test(name)
    && !/^test_.*\.py$/.test(name)
    && !/test(?:2)?-fixture\.ts$/.test(name);
}
