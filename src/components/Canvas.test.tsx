import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AnnotationId, GeometryId } from '@/drawing';
import { CadGridPattern, PerceptionPreviewLayer, SpatialRegionOverlayLayer } from './Canvas';
import { filterCanvasAnnotations } from './canvas/annotation-visibility';

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

  it('renders the active semantic region and boundary anchors behind preview geometry', () => {
    const html = renderToStaticMarkup(
      <svg>
        <SpatialRegionOverlayLayer
          scale={2}
          overlay={{
            id: 'region_arm', revision: 'revision_1' as import('@/drawing').RevisionId,
            previewVersionId: 'preview_2', label: '右臂',
            contours: [[[0, 0], [20, 0], [20, 10], [0, 10]]], holes: [],
            anchors: [{ id: 'shoulder', role: 'connection', point: [20, 10], confidence: 1 }],
            confidence: 0.95,
          }}
        />
      </svg>,
    );

    expect(html).toContain('data-spatial-region-overlay="preview_2"');
    expect(html).toContain('data-region-id="region_arm"');
    expect(html).toContain('data-region-anchor="shoulder"');
    expect(html).toContain('fill-rule="evenodd"');
  });
});

describe('Canvas annotation visibility', () => {
  it('hides authoritative and provisional annotations without removing geometry', () => {
    const entities = [{
      id: 'geometry_1' as GeometryId,
      type: 'line' as const, start: [0, 0] as const, end: [10, 0] as const, visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }, {
      id: 'annotation_1' as AnnotationId,
      type: 'text' as const, content: '10', position: [5, 2] as const, height: 2,
      rotation: 0, alignment: 'center' as const, verticalAlignment: 'middle' as const,
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }];

    expect(filterCanvasAnnotations(entities, false).map((entity) => entity.id)).toEqual(['geometry_1']);
    expect(filterCanvasAnnotations(entities, true)).toEqual(entities);
  });
});
