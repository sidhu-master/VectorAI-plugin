import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const frontendRoots = ['components', 'hooks', 'services'].map((name) => join(sourceRoot, name));

describe('canonical frontend drawing boundary', () => {
  it('does not import the legacy Spatial Core from production UI state or services', () => {
    const violations = frontendRoots.flatMap(sourceFiles).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const specifiers = [...source.matchAll(
        /\b(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g,
      )].map((match) => match[1]);
      return specifiers
        .filter((specifier) => specifier === '@/core' || specifier.startsWith('@/core/'))
        .map((specifier) => `${relative(sourceRoot, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extname(entry.name) === '.ts' || extname(entry.name) === '.tsx'
      ? entry.name.includes('.test.') ? [] : [path]
      : [];
  });
}
