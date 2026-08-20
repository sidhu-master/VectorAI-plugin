import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ObjectTypeIcon, type ObjectType } from './ObjectList';

const supportedTypes: ObjectType[] = [
  'point',
  'line',
  'ray',
  'xline',
  'circle',
  'arc',
  'ellipse',
  'polyline',
  'spline',
  'text',
  'dimension',
  'leader',
  'centerline',
];

describe('ObjectTypeIcon', () => {
  it.each(supportedTypes)('renders %s as an SVG icon instead of an abbreviation', (type) => {
    const html = renderToStaticMarkup(<ObjectTypeIcon type={type} />);

    expect(html).toContain(`data-object-type-icon="${type}"`);
    expect(html).toContain('<svg');
    expect(html).not.toContain('data-object-type-abbreviation');
  });

  it('uses distinct geometry glyphs for arcs and polylines', () => {
    const arc = renderToStaticMarkup(<ObjectTypeIcon type="arc" />);
    const polyline = renderToStaticMarkup(<ObjectTypeIcon type="polyline" />);

    expect(arc).toContain('data-icon-shape="arc"');
    expect(polyline).toContain('data-icon-shape="polyline"');
  });
});
