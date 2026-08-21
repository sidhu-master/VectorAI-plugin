// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import plugin from './index';

describe('@vectorai/plugin-dsh-annotation boundary', () => {
  it('does not deep-import first-layer Host implementation files', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tools.ts'), 'utf8');
    expect(source).not.toMatch(/plugin-dsh-space-host\/(?:src|lib)\//);
  });

  it('attaches Cordis service dependencies to the loader-visible default plugin', () => {
    expect(plugin.inject).toEqual(['tools', 'drawingSpace']);
  });
});
