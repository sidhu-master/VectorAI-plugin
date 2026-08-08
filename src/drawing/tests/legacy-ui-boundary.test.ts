import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const frontendRoots = ['components', 'hooks', 'pages', 'services']
  .map((name) => join(sourceRoot, name));

const forbiddenSourcePatterns: Array<[string, RegExp]> = [
  ['legacy type SpatialModel', /\bSpatialModel\b/],
  ['legacy type SpatialHistory', /\bSpatialHistory\b/],
  ['legacy mutation commitPatch', /\bcommitPatch\s*\(/],
  ['legacy mutation applyPatch', /\bapplyPatch\s*\(/],
  ['legacy UI step executor', /\bexecuteNextStep\b/],
  ['legacy mutation endpoint', /\/api\/ai\/(?:generate|perceive|agent\/execute)\b/],
  [
    'direct canonical array mutation',
    /\.(?:geometry|annotations|relations|features)\s*(?:=|\.\s*(?:push|splice)\s*\()/,
  ],
];

describe('canonical frontend drawing boundary', () => {
  it('has no production UI import from the legacy Spatial Core', () => {
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

  it('has no legacy or direct drawing mutation path in production UI code', () => {
    const violations = frontendRoots.flatMap(sourceFiles).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return forbiddenSourcePatterns
        .filter(([, pattern]) => pattern.test(source))
        .map(([label]) => `${relative(sourceRoot, file)} -> ${label}`);
    });

    expect(violations).toEqual([]);
  });

  it('does not allocate collections inside Zustand selectors', () => {
    const violations = frontendRoots.flatMap(sourceFiles).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /useStore\([^;]{0,240}=>[^;]*\?\s*\[/.test(source)
        || /useStore\([^;]{0,240}=>\s*\[/.test(source);
    }).map((file) => relative(sourceRoot, file));

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
