// SPDX-License-Identifier: Apache-2.0

import { readFile, readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dimension inference source guard', () => {
  it('keeps golden fixture identity and closure values out of runtime decisions', async () => {
    const directory = resolve(import.meta.dirname);
    const names = (await readdir(directory)).filter((name) => (
      extname(name) === '.ts'
      && !name.endsWith('.test.ts')
      && !name.endsWith('-test-support.ts')
    ));
    const runtimeSource = (await Promise.all(names.map((name) => readFile(resolve(directory, name), 'utf8')))).join('\n');

    expect(runtimeSource).not.toMatch(/样本图001|golden-shaft-001/);
    expect(runtimeSource).not.toMatch(/closure\s*[:=]\s*(3\.5|23|39)\b/);
  });
});
