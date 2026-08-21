// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('@vectorai/engineering-annotation dependency boundary', () => {
  it('uses only public core/protocol dependencies and no Host or API deep imports', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'plan.ts'), 'utf8');
    expect(source).not.toMatch(/@vectorai\/plugin-|\/api\/|\/src\/drawing|express|@deepseek-ai/);
  });
});
