// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import plugin from './index';

describe('@vectorai/plugin-dsh-annotation-host boundary', () => {
  it('depends on the public extension contract instead of the concrete first-layer Host', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tools.ts'), 'utf8');
    expect(source).not.toContain('@vectorai/plugin-dsh-space-host');
    expect(source).toContain('DrawingSpaceExtensionHost');
  });

  it('attaches Cordis service dependencies to the loader-visible default plugin', () => {
    expect(plugin.inject).toEqual(['tools', 'drawingSpace', 'attachments', 'agents', 'subagents', 'connection']);
  });

  it('persists dimension plans without embedding tolerance formulas in the DSH adapter', () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const service = readFileSync(join(directory, 'service.ts'), 'utf8');
    const store = readFileSync(join(directory, 'dimension-plan-store.ts'), 'utf8');
    expect(service).toContain('DimensionPlanStore');
    expect(store).not.toMatch(/ToleranceRuleProvider|resolveToleranceSpec|formulaSource|eval\s*\(|new Function/);
  });
});
