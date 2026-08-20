import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vector outline reveal styles', () => {
  it('draws vector strokes progressively and disables motion when requested', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(css).toContain('@keyframes vector-stroke-reveal');
    expect(css).toContain('.vector-stroke-reveal');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/stroke-dashoffset:\s*0/);
  });
});
