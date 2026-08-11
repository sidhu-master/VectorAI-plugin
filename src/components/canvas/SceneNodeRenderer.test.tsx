import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { GeometryNode } from '@/drawing';
import { compileDrawingNode } from '@/drawing';
import SceneNodeRenderer from './SceneNodeRenderer';

describe('SceneNodeRenderer', () => {
  it('renders compiled primitives with the stable node id and selection style', () => {
    const node: GeometryNode = {
      id: 'circle_scene' as never,
      type: 'circle',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      center: [20, 20],
      radius: 10,
    };
    const html = renderToStaticMarkup(
      <svg>
        <SceneNodeRenderer
          nodeId={node.id}
          primitives={compileDrawingNode(node)}
          scale={2}
          selected
        />
      </svg>,
    );

    expect(html).toContain('data-entity-id="circle_scene"');
    expect(html).toContain('data-scene-node="true"');
    expect(html).toContain('stroke="#6da9d2"');
    expect(html).toContain('A 10 10');
  });

  it('renders provisional labels without an interactive hit path', () => {
    const node: GeometryNode = {
      id: 'line_scene' as never,
      type: 'line',
      visible: true,
      quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
      start: [0, 0],
      end: [20, 0],
    };
    const html = renderToStaticMarkup(
      <svg>
        <SceneNodeRenderer
          nodeId={node.id}
          primitives={compileDrawingNode(node)}
          scale={2}
          provisional
          label="G001"
          perceptionStage="detail"
        />
      </svg>,
    );

    expect(html).toContain('data-provisional="true"');
    expect(html).toContain('G001');
    expect(html).not.toContain('stroke="transparent"');
  });
});
