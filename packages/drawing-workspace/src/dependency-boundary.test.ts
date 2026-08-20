// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const forbidden = [
  /^node:/,
  /^(?:react|react-dom|express)(?:\/|$)/,
  /^@deepseek-ai\//,
  /(?:^|\/)src\/(?:components|hooks|services)(?:\/|$)/,
];

describe('@vectorai/drawing-workspace dependency boundary', () => {
  it('keeps production code independent from UI and host runtimes', () => {
    const violations = productionFiles(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const specifiers = [...source.matchAll(
        /\b(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g,
      )].map((match) => match[1]);
      return specifiers
        .filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${relative(sourceRoot, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return extname(entry.name) === '.ts' && !entry.name.includes('.test.')
      ? [path]
      : [];
  });
}
