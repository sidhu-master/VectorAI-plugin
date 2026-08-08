import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MemoryDrawingRepository,
  applyDrawingPatch,
  compileDrawingCommands,
  createEmptyDrawing,
  previewTransaction,
  queryDrawing,
  replayDrawingCommits,
  validateDrawingDocument,
} from '../index';

const drawingRoot = join(process.cwd(), 'src/drawing');

describe('Drawing Core public boundary', () => {
  it('provides the supported runtime API from one entry point', () => {
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_public_api' },
      now: () => 1,
    });

    expect(validateDrawingDocument(document).valid).toBe(true);
    expect(queryDrawing(document).items).toEqual([]);
    expect([
      applyDrawingPatch,
      compileDrawingCommands,
      previewTransaction,
      replayDrawingCommits,
      MemoryDrawingRepository,
    ].every((value) => typeof value === 'function')).toBe(true);
  });

  it('does not depend on legacy core or application layers', () => {
    const forbidden = ['/components/', '/hooks/', '/api/', '/services/', '../core/'];
    const violations = sourceFiles(drawingRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const specifiers = [...source.matchAll(
        /\b(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g,
      )].map((match) => match[1]);
      return specifiers
        .filter((specifier) => forbidden.some((part) => specifier.includes(part)))
        .map((specifier) => `${relative(drawingRoot, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(path);
    return extname(entry.name) === '.ts' ? [path] : [];
  });
}
