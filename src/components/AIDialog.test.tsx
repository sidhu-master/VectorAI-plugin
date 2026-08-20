import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AIDialog, { Message } from './AIDialog';

describe('AIDialog unified Agent entry', () => {
  it('renders one AI entry without a mode switch', () => {
    const html = renderToStaticMarkup(<AIDialog />);

    expect(html).not.toContain('Agent 工作流模式');
    expect(html).not.toContain('>普通<');
    expect(html).toContain('accept="image/*,application/pdf,.dxf,application/dxf,.txt,text/plain"');
    expect(html).toContain('multiple=""');
  });

  it('renders DXF and engineering documents as file cards instead of fake image messages', () => {
    const html = renderToStaticMarkup(<Message msg={{
      id: 'dxf_message', role: 'user', content: '', timestamp: 1,
      files: [
        { name: '样本图001.dxf', mimeType: 'application/dxf' },
        { name: '工程数据.txt', mimeType: 'text/plain' },
      ],
    }} />);

    expect(html).toContain('样本图001.dxf');
    expect(html).toContain('工程数据.txt');
    expect(html).toContain('DXF');
    expect(html).toContain('TXT');
    expect(html).not.toContain('<img');
  });

  it('renders an image-only user message without inventing user text', () => {
    const html = renderToStaticMarkup(<Message msg={{
      id: 'image_message', role: 'user', content: '', timestamp: 1,
      image: 'iVBORw0KGgo=', mimeType: 'image/png',
    }} />);

    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('alt="用户上传的图片"');
    expect(html).not.toContain('解析并重建上传的二维图纸');
  });

});
