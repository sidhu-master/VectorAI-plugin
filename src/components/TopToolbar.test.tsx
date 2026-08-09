import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AnnotationVisibilityButton } from './TopToolbar';

describe('TopToolbar annotation visibility', () => {
  it('shows a globally accessible annotation visibility control', () => {
    const visible = renderToStaticMarkup(
      <AnnotationVisibilityButton visible onToggle={() => undefined} />,
    );
    expect(visible).toContain('title="隐藏全部标注"');
    expect(visible).toContain('aria-pressed="true"');

    const hidden = renderToStaticMarkup(
      <AnnotationVisibilityButton visible={false} onToggle={() => undefined} />,
    );
    expect(hidden).toContain('title="显示全部标注"');
    expect(hidden).toContain('aria-pressed="false"');
  });
});
