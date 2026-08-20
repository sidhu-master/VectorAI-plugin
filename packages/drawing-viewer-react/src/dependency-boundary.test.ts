// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { PreviewOverlayContext } from './DrawingWorkspace';

const sourceRoot = dirname(fileURLToPath(import.meta.url));

describe('@vectorai/drawing-viewer-react extension boundary', () => {
  it('does not depend on the optional engineering annotation layer or host adapters', () => {
    const forbidden = [
      /engineering-annotation/,
      /plugin-dsh-annotation/,
      /^@deepseek-ai\//,
      /src\/hooks\/useStore/,
      /src\/services/,
    ];
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

  it('exposes preview inputs as deeply readonly data', () => {
    const assertReadonly = (_context: PreviewOverlayContext) => {
      // @ts-expect-error Preview plugins cannot mutate the authoritative document.
      _context.snapshot.document.geometry = [];
      // @ts-expect-error Preview plugins cannot mutate the shared viewport.
      _context.viewport.scale = 2;
    };

    expect(assertReadonly).toBeTypeOf('function');
  });
});

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.includes('.test.')
      ? [path]
      : [];
  });
}
