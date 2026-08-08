import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeWorkspace } from './Home';

describe('CAD workspace shell', () => {
  it('renders the canvas, inspector, assistant, and one shared composer as one workspace', () => {
    const html = renderToStaticMarkup(<HomeWorkspace canvasResetKey="revision_home" />);

    expect(html).toContain('aria-label="CAD 工作区"');
    expect(html).toContain('data-panel="inspector"');
    expect(html).toContain('data-panel="assistant"');
    expect(html).toContain('AI 助手');
    expect(html).toContain('<svg');
    expect(html.match(/<textarea/g)).toHaveLength(1);
  });
});
