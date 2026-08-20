import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AnnotationId, DrawingRelation, GeometryId } from '@/drawing';
import {
  AgentCanvasOverlayLayer,
  CadGridPattern,
  PerceptionPreviewLayer,
  SpatialRegionOverlayLayer,
} from './Canvas';
import { filterCanvasAnnotations } from './canvas/annotation-visibility';
import { filterCanvasRelations, isCanvasSelectable } from './canvas/canvas-policies';

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
  it('renders model-observed nodes, candidate paths and points as non-authoritative overlays', () => {
    const nodes = [{
      id: 'line_a' as GeometryId,
      type: 'line' as const, start: [0, 0] as const, end: [10, 0] as const, visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }];
    const paths = renderToStaticMarkup(<svg><AgentCanvasOverlayLayer
      overlay={{
        kind: 'paths', role: 'candidate',
        paths: [{ id: 'path_1', nodeIds: ['line_a'], points: [[0, 0], [10, 0]] }],
      }}
      entities={nodes}
      scale={2}
    /></svg>);
    const observed = renderToStaticMarkup(<svg><AgentCanvasOverlayLayer
      overlay={{ kind: 'nodes', role: 'observed', nodeIds: ['line_a'] }}
      entities={nodes}
      scale={2}
    /></svg>);
    const points = renderToStaticMarkup(<svg><AgentCanvasOverlayLayer
      overlay={{ kind: 'points', points: [{ id: 'point_1', point: [4, 2] }] }}
      entities={nodes}
      scale={2}
    /></svg>);

    expect(paths).toContain('data-agent-overlay="paths"');
    expect(paths).toContain('data-agent-path="path_1"');
    expect(paths).toContain('attributeName="stroke-dashoffset"');
    expect(paths).toContain('pointer-events="none"');
    expect(observed).toContain('data-agent-overlay-node="line_a"');
    expect(observed).toContain('data-agent-overlay-node-shape="line_a"');
    expect(observed).toContain('AI 正在观察');
    expect(observed).toContain('data-agent-overlay-animation="focus"');
    expect(observed).not.toContain('data-selected');
    expect(points).toContain('data-agent-point="point_1"');
    expect(points).toContain('data-agent-overlay-animation="point-pulse"');
  });

  it('renders exact spatial supports, exclusions, interfaces and motion without hijacking selection', () => {
    const html = renderToStaticMarkup(<svg><AgentCanvasOverlayLayer
      overlay={{
        kind: 'spatial', phase: 'grounding', label: '目标局部',
        strokes: [
          {
            id: 'target_span', ref: 'span_target', nodeId: 'polyline_a', role: 'target',
            points: [[0, 0], [8, 0], [10, 2]], confidence: 0.92,
          },
          {
            id: 'excluded_span', ref: 'span_neighbor', nodeId: 'polyline_a', role: 'excluded',
            points: [[10, 2], [16, 2]],
          },
        ],
        markers: [{ id: 'interface_1', ref: 'vertex_1', role: 'interface', point: [10, 2] }],
        vectors: [{ id: 'motion_1', role: 'motion', from: [6, 1], to: [6, 8] }],
      }}
      entities={[]}
      scale={2}
    /></svg>);

    expect(html).toContain('data-agent-overlay="spatial"');
    expect(html).toContain('data-agent-spatial-stroke="target_span"');
    expect(html).toContain('data-agent-spatial-role="target"');
    expect(html).toContain('data-agent-spatial-role="excluded"');
    expect(html).toContain('data-agent-spatial-marker="interface_1"');
    expect(html).toContain('data-agent-spatial-vector="motion_1"');
    expect(html).toContain('data-agent-overlay-animation="span-reveal"');
    expect(html).toContain('stroke-dasharray="1"');
    expect(html).toContain('data-agent-overlay-animation="interface-pulse"');
    expect(html).toContain('data-agent-overlay-animation="motion-flow"');
    expect(html).toContain('目标局部');
    expect(html).toContain('pointer-events="none"');
    expect(html).not.toContain('data-selected');
  });

  it('marks low-confidence spatial evidence in the shared candidate color', () => {
    const html = renderToStaticMarkup(<svg><AgentCanvasOverlayLayer
      overlay={{
        kind: 'spatial', phase: 'grounding', truncated: true,
        strokes: [{
          id: 'uncertain_span', role: 'target', points: [[0, 0], [8, 2]], confidence: 0.42,
        }],
        markers: [], vectors: [],
      }}
      entities={[]}
      scale={1}
    /></svg>);

    expect(html).toContain('data-agent-spatial-truncated="true"');
    expect(html).toContain('data-agent-spatial-confidence="low"');
    expect(html).toContain('stroke="#d98a70"');
  });

  it('renders provisional nodes and system labels in a non-interactive layer', () => {
    const html = renderToStaticMarkup(
      <svg>
        <PerceptionPreviewLayer
          entities={[{
            id: 'node_preview' as GeometryId,
            type: 'circle', center: [20, 20], radius: 4, visible: true,
            quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
          }, {
            id: 'line_preview' as GeometryId,
            type: 'line', start: [4, 4], end: [12, 8], visible: true,
            quality: { status: 'confirmed', confidence: 0.9, evidenceRefs: [] },
          }]}
          labelsByNodeId={{ node_preview: 'GEO-0001' }}
          stageByNodeId={{ node_preview: 'outline', line_preview: 'outline' }}
          scale={10}
          viewport={{ minX: 0, minY: 0, maxX: 100, maxY: 100 }}
        />
      </svg>,
    );

    expect(html).toContain('data-perception-preview="true"');
    expect(html).toContain('data-entity-id="node_preview"');
    expect(html).toContain('GEO-0001');
    expect(html).toContain('pointer-events="none"');
    expect(html.match(/data-vector-reveal="true"/g)).toHaveLength(2);
    expect(html).toContain('pathLength="1"');
    expect(html).toContain('--vector-reveal-delay:0ms');
    expect(html).toContain('--vector-reveal-delay:220ms');
  });

  it('renders the active semantic region and boundary anchors behind preview geometry', () => {
    const html = renderToStaticMarkup(
      <svg>
        <SpatialRegionOverlayLayer
          scale={2}
          overlay={{
            id: 'region_arm', revision: 'revision_1' as import('@/drawing').RevisionId,
            previewVersionId: 'preview_2', label: '右臂', attempt: 2, status: 'tracing',
            contours: [[[0, 0], [20, 0], [20, 10], [0, 10]]], holes: [],
            anchors: [{
              id: 'shoulder', role: 'boundary', point: [18, 9], confidence: 1,
              snapStatus: 'snapped', snappedPoint: [20, 10],
            }],
            paths: [{
              id: 'path_arm', nodeId: 'arm', role: 'selected', order: 0,
              points: [[5, 5], [10, 7], [20, 10]],
            }],
            issues: [],
            confidence: 0.95,
          }}
        />
      </svg>,
    );

    expect(html).toContain('data-spatial-region-overlay="preview_2"');
    expect(html).toContain('data-region-id="region_arm"');
    expect(html).toContain('data-region-anchor="shoulder"');
    expect(html).toContain('data-anchor-snap="shoulder"');
    expect(html).toContain('data-topology-path="path_arm"');
    expect(html).toContain('data-overlay-status="tracing"');
    expect(html).toContain('attributeName="stroke-dashoffset"');
    expect(html).toContain('fill-rule="evenodd"');
  });

  it('renders rejected grounding evidence as a rejected overlay', () => {
    const html = renderToStaticMarkup(
      <svg>
        <SpatialRegionOverlayLayer
          scale={1}
          overlay={{
            id: 'region_bad', revision: 'revision_1' as import('@/drawing').RevisionId,
            previewVersionId: 'preview_bad', label: '候选部件', attempt: 1,
            status: 'rejected', contours: [[[0, 0], [10, 0], [10, 10]]], holes: [],
            anchors: [{
              id: 'seed', role: 'target-seed', point: [3, 3], confidence: 0.7,
              snapStatus: 'missed',
            }],
            paths: [], issues: [{ code: 'TARGET_ANCHOR_MISSING', message: '目标点未吸附' }],
            confidence: 0.7,
          }}
        />
      </svg>,
    );

    expect(html).toContain('data-overlay-status="rejected"');
    expect(html).toContain('data-anchor-status="missed"');
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
    }, {
      id: 'annotation_centerline' as AnnotationId,
      type: 'centerline' as const, targets: ['geometry_1' as GeometryId],
      start: [0, 0] as const, end: [10, 0] as const, extension: 1,
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }, {
      id: 'annotation_leader' as AnnotationId,
      type: 'leader' as const,
      target: { geometryId: 'geometry_1' as GeometryId, anchor: { kind: 'start' as const } },
      points: [[0, 0], [4, 3]] as Array<readonly [number, number]>, content: 'R2', textHeight: 2,
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }, {
      id: 'annotation_hatch' as AnnotationId,
      type: 'section-hatch' as const, pattern: 'ANSI31', angle: 45, spacing: 3,
      segments: [{ start: [0, 0] as const, end: [3, 3] as const }],
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }];

    expect(filterCanvasAnnotations(entities, false).map((entity) => entity.id)).toEqual(['geometry_1']);
    expect(filterCanvasAnnotations(entities, true)).toEqual(entities);
  });

  it('allows canvas selection only for geometry nodes', () => {
    const geometry = {
      id: 'geometry_1' as GeometryId,
      type: 'line' as const, start: [0, 0] as const, end: [10, 0] as const, visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };
    const annotation = {
      id: 'annotation_1' as AnnotationId,
      type: 'text' as const, content: '10', position: [5, 2] as const, height: 2,
      rotation: 0, alignment: 'center' as const, verticalAlignment: 'middle' as const,
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };
    const centerline = {
      id: 'annotation_centerline' as AnnotationId,
      type: 'centerline' as const, targets: ['geometry_1' as GeometryId],
      start: [0, 0] as const, end: [10, 0] as const, extension: 1,
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };
    const hatch = {
      id: 'annotation_hatch' as AnnotationId,
      type: 'section-hatch' as const, pattern: 'ANSI31', angle: 45, spacing: 3,
      segments: [{ start: [0, 0] as const, end: [3, 3] as const }],
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };

    expect(isCanvasSelectable(geometry)).toBe(true);
    expect(isCanvasSelectable(annotation)).toBe(true);
    expect(isCanvasSelectable(centerline)).toBe(false);
    expect(isCanvasSelectable(hatch)).toBe(false);
  });
});

describe('Canvas relation visibility', () => {
  it('keeps internal topology relations out of the normal canvas overlay', () => {
    const relations: DrawingRelation[] = [{
      id: 'relation_connected' as never,
      type: 'topology', plane: 'topology', kind: 'connected',
      nodeIds: ['line_a', 'line_b'], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'relation_parallel' as never,
      type: 'constraint', plane: 'constraint', kind: 'parallel',
      geometryIds: ['line_a', 'line_b'] as never,
      status: 'satisfied', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];

    expect(filterCanvasRelations(relations).map((relation) => relation.kind))
      .toEqual(['parallel']);
  });
});
