import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const packageSourceRoot = resolve(import.meta.dirname);
const requiredProductionFiles = [
  'document/create.ts',
  'document/types.ts',
];
const forbidden = [
  /^node:/,
  /^(?:react|react-dom|express)(?:\/|$)/,
  /^@deepseek-ai\//,
  /(?:^|\/)api(?:\/|$)/,
  /(?:^|\/)src\/(?:components|hooks|services)(?:\/|$)/,
];

describe('@vectorai/drawing-core dependency boundary', () => {
  it('owns the canonical Drawing Document production files', () => {
    const files = productionFiles(packageSourceRoot)
      .map((file) => relative(packageSourceRoot, file))
      .sort();

    expect(files).toEqual(expect.arrayContaining(requiredProductionFiles));
  });

  it('keeps production code independent from hosts and legacy application layers', () => {
    const violations = productionFiles(packageSourceRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const specifiers = [...source.matchAll(
        /\b(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g,
      )].map((match) => match[1]);
      return specifiers
        .filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${relative(packageSourceRoot, file)} -> ${specifier}`);
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
