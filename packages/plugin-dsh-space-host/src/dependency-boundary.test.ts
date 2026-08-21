// SPDX-License-Identifier: Apache-2.0

import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DSH Host package boundary', () => {
  it('does not depend on the legacy API, Express, cloud endpoints, or the browser client', async () => {
    const root = resolve(import.meta.dirname);
    const files = (await readdir(root)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    const source = (await Promise.all(files.map((name) => readFile(resolve(root, name), 'utf8')))).join('\n');

    expect(source).not.toMatch(/from ['"][^'"]*api\/services/);
    expect(source).not.toMatch(/from ['"]express['"]/);
    expect(source).not.toMatch(/fetch\s*\(\s*['"]https?:\/\//);
    expect(source).not.toMatch(/from ['"]@vectorai\/plugin-dsh-space-client/);
  });
});
