// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('drawing surface API dependency boundary', () => {
  it('has no React runtime, DSH, Zustand, Node runtime, or plugin dependency', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const runtimeImports = [...source.matchAll(/import\s+(?!type\s)[^'"]*['"]([^'"]+)['"]/g)]
      .map((match) => match[1]);

    expect(runtimeImports).toEqual([]);
    expect(source).not.toMatch(/@deepseek-ai|zustand|@vectorai\/plugin-|from ['"]node:/);
  });
});
