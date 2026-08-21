// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const forbidden = [/^node:/, /^@deepseek-ai\//, /^(?:react|express)(?:\/|$)/, /^@vectorai\/plugin-/, /(?:^|\/)api(?:\/|$)/];

describe('@vectorai/drawing-edit-core dependency boundary', () => {
  it('does not depend on hosts, UI, Node built-ins, or legacy API services', () => {
    const violations = files(root).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/\b(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1])
        .filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${relative(root, file)} -> ${specifier}`);
    });
    expect(violations).toEqual([]);
  });
});

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return extname(entry.name) === '.ts' && !entry.name.includes('.test.') ? [path] : [];
  });
}
