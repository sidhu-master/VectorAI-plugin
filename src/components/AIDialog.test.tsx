import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AIDialog from './AIDialog';

describe('AIDialog unified Agent entry', () => {
  it('renders one AI entry without a mode switch', () => {
    const html = renderToStaticMarkup(<AIDialog />);

    expect(html).not.toContain('Agent 工作流模式');
    expect(html).not.toContain('>普通<');
    expect(html).toContain('accept="image/*,application/pdf"');
  });

});
