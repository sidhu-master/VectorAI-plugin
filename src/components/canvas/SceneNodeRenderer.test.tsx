import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AnnotationNode, GeometryNode } from '@/drawing';
import { compileAnnotationNode, compileDrawingNode } from '@/drawing';
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
          onSelect={() => undefined}
        />
      </svg>,
    );

    expect(html).toContain('data-entity-id="circle_scene"');
    expect(html).toContain('data-scene-node="true"');
    expect(html).toContain('stroke="#6da9d2"');
    expect(html).toContain('A 10 10');
    expect(html).toContain('stroke="transparent"');
    expect(html).not.toContain('pointer-events="none"');
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
    expect(html).toContain('data-agent-preview-animation="enter"');
    expect(html).toContain('G001');
    expect(html).not.toContain('stroke="transparent"');
    expect(html).not.toContain('data-vector-reveal');
  });

  it('keeps annotation primitives display-only even when a selection callback is supplied', () => {
    const node: AnnotationNode = {
      id: 'dimension_scene' as never,
      type: 'dimension',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'radius',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0]],
      textPosition: [12, 0],
      displayText: 'R10',
    };
    const html = renderToStaticMarkup(
      <svg>
        <SceneNodeRenderer
          nodeId={node.id}
          primitives={compileAnnotationNode(node, 1)}
          scale={1}
          onSelect={() => undefined}
        />
      </svg>,
    );

    expect(html).toContain('data-entity-id="dimension_scene"');
    expect(html).toContain('data-display-only="true"');
    expect(html).not.toContain('class="cursor-pointer"');
    expect(html).not.toContain('stroke="transparent"');
    expect(html).not.toContain('pointer-events="none"');
  });

  it('supports text-only selection mode for annotation text labels', () => {
    const node: AnnotationNode = {
      id: 'dimension_text_scene' as never,
      type: 'dimension',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'radius',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0]],
      textPosition: [12, 0],
      displayText: 'R10',
    };
    const html = renderToStaticMarkup(
      <svg>
        <SceneNodeRenderer
          nodeId={node.id}
          primitives={compileAnnotationNode(node, 1)}
          scale={1}
          annotationTextOnly
          onSelect={() => undefined}
          onPointerDown={() => undefined}
        />
      </svg>,
    );

    expect(html).toContain('class="cursor-pointer"');
    expect(html).toContain('data-annotation-text="true"');
  });

  it('translates editable annotation primitives by text offset (for drag preview)', () => {
    const node: AnnotationNode = {
      id: 'dimension_text_shift' as never,
      type: 'dimension',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'linear',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [20, 0], [0, 4], [20, 4]],
      textPosition: [10, 5],
      displayText: '20',
      observedValue: 20,
    };
    const html = renderToStaticMarkup(
      <svg>
        <SceneNodeRenderer
          nodeId={node.id}
          primitives={compileAnnotationNode(node, 1)}
          scale={1}
          annotationTextOnly
          onSelect={() => undefined}
          onPointerDown={() => undefined}
          textOffset={[3, -2]}
        />
      </svg>,
    );

    expect(html).toContain('transform="translate(3 -2)"');
  });
});
