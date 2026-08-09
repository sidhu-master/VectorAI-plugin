import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { GeometryId } from '@/drawing';
import { CadGridPattern, PerceptionPreviewLayer } from './Canvas';

describe('Canvas infinite grid', () => {
  it('renders viewport-covering patterns instead of finite world-space lines', () => {
    const html = renderToStaticMarkup(
      <svg>
        <CadGridPattern
          visible
          transform={{ scale: 2, offsetX: 80, offsetY: 500 }}
        />
      </svg>,
    );

    expect(html).toContain('data-cad-grid="true"');
    expect(html).toContain('width="100%"');
    expect(html).toContain('height="100%"');
    expect(html).toContain('data-grid-pattern="minor"');
    expect(html).toContain('data-grid-pattern="major"');
    expect(html).not.toContain('data-grid-line');
  });
});

describe('Canvas progressive perception overlay', () => {
  it('renders provisional nodes and system labels in a non-interactive layer', () => {
    const html = renderToStaticMarkup(
      <svg>
        <PerceptionPreviewLayer
          entities={[{
            id: 'node_preview' as GeometryId,
            type: 'circle', center: [20, 20], radius: 4, visible: true,
            quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
          }]}
          labelsByNodeId={{ node_preview: 'GEO-0001' }}
          scale={10}
          viewport={{ minX: 0, minY: 0, maxX: 100, maxY: 100 }}
        />
      </svg>,
    );

    expect(html).toContain('data-perception-preview="true"');
    expect(html).toContain('data-entity-id="node_preview"');
    expect(html).toContain('GEO-0001');
    expect(html).toContain('pointer-events="none"');
  });
});
