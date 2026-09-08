// SPDX-License-Identifier: Apache-2.0
import { DEFAULT_DXF_EXPORT_PROFILE, type DxfBlockGraphic, type DxfExportProfile } from '@vectorai/drawing-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CadPaperGraphics } from './CadPaperGraphics';

const profile: DxfExportProfile = {
  ...DEFAULT_DXF_EXPORT_PROFILE,
  textStyles: [{ name: 'PC_TEXTSTYLE', font: 'isocp.shx', height: 0, widthFactor: 0.707 }],
};
const render = (picture: DxfBlockGraphic[]) => renderToStaticMarkup(<svg><g transform="scale(1 -1)"><CadPaperGraphics picture={picture} profile={profile} /></g></svg>);

describe('CadPaperGraphics', () => {
  it('keeps physical text placement and nested stacked tolerances, without printing DXF control codes', () => {
    const markup = render([{ type: 'mtext', layer: 'DIMENSIONS', color: 3, position: [10, 20], height: 3.5,
      rotation: 90, alignment: 5, style: 'PC_TEXTSTYLE', content: '\\A1;%%C35{\\C2;{\\H0.71x;\\S+0.033^ +0.017;}}' }]);
    expect(markup).toContain('translate(10 20) rotate(90) scale(1 -1)');
    expect(markup).toContain('⌀35');
    expect(markup).toContain('+0.033');
    expect(markup).toContain('+0.017');
    expect(markup).toContain('data-cad-stack="true"');
    expect(markup).toContain('data-cap-height="2.485"');
    expect(markup).toContain('fill="#ffff00"');
    expect(markup).not.toContain('\\S');
    expect(markup).not.toContain('\\A1');
  });

  it('draws CAXA geometric tolerance symbols as vector shapes instead of font code letters', () => {
    const markup = render(['e', 'g', 'h', 't'].map((code, index) => ({
      type: 'mtext', layer: 'SYMBOLS', position: [index * 6, 0], height: 3.5, content: `{\\Famgdt;${code}}`, alignment: 5,
    })));
    for (const name of ['circularity', 'cylindricity', 'circular-runout', 'total-runout']) expect(markup).toContain(`data-gdt-symbol="${name}"`);
    expect(markup).not.toMatch(/>\s*[eght]\s*<\/text>/);
    expect(markup).not.toContain('Famgdt');
  });

  it('preserves arcs, filled arrows, layer color and default BYBLOCK witness white', () => {
    const markup = render([
      { type: 'line', layer: 'DIMENSIONS', color: 0, start: [1, 2], end: [3, 4] },
      { type: 'arc', layer: 'DIMENSIONS', color: 256, center: [0, 0], radius: 4, startAngle: 350, endAngle: 10 },
      { type: 'solid-hatch', layer: 'SECTION_HATCH', boundary: [[0, 0], [1, 0], [0, 1]] },
      { type: 'polyline', layer: 'SYMBOLS', color: 31, points: [[0, 0], [5, 0], [5, 2]], closed: true },
    ]);
    expect(markup).toContain('stroke="#ffffff"');
    expect(markup).toContain('stroke="#00ffff"');
    expect(markup).toContain('fill="#ffff00"');
    expect(markup).toContain('A 4 4 0 0 1');
    expect(markup).toContain('points="0,0 1,0 0,1"');
    expect(markup).toContain('stroke="#ffbf7f"');
  });

  it('restores text style after nested groups and honors inline width and paragraph attachment', () => {
    const markup = render([{ type: 'mtext', layer: 'SYMBOLS', position: [0, 0], height: 2,
      alignment: 1, content: '{\\Fisocp,GBCBIG;\\W0.5;A}{\\H0.5x;B}C\\P第二行' }]);
    expect(markup).toContain('data-width-factor="0.5"');
    expect(markup).toContain('data-cap-height="1"');
    expect(markup).toContain('data-cap-height="2"');
    expect(markup).toContain('第二行');
    expect(markup).not.toContain('GBCBIG');
  });
});
