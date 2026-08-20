import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { SemanticRegion } from '../../../src/contracts/drawing-spatial-region.js';

export const TEST2_SHARED_POLYLINE_ID = 'node_vec_9b4cf19e18282a496e2d' as GeometryId;
export const TEST2_REVISION = 'revision_test2_region' as RevisionId;

export const TEST2_SHARED_POLYLINE_POINTS = [
  [101.910828, 193.412466],
  [103.937462, 193.991562],
  [117.255351, 203.546338],
  [118.992468, 203.546338],
  [118.992468, 71.22675],
] as const;

export function test2SharedPolylineDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_test2_region' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      {
        id: TEST2_SHARED_POLYLINE_ID,
        type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        vertices: TEST2_SHARED_POLYLINE_POINTS.map((point) => ({ point })),
        closed: false,
      },
      {
        id: 'node_test2_hand_outline' as GeometryId,
        type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        vertices: [
          TEST2_SHARED_POLYLINE_POINTS[0],
          [99, 197] as const,
          [102, 199] as const,
          [116, 210] as const,
          [122, 207] as const,
          TEST2_SHARED_POLYLINE_POINTS[3],
        ].map((point) => ({ point })),
        closed: false,
      },
      {
        id: 'node_test2_face' as GeometryId,
        type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [80, 220], radius: 20,
      },
    ],
    annotations: [], relations: [], features: [],
  };
}

export function test2RightArmRegion(confidence = 0.95): SemanticRegion {
  return {
    id: 'region_test2_right_arm',
    drawingId: 'drawing_test2_region' as DrawingId,
    revision: TEST2_REVISION,
    label: 'right arm',
    operation: 'modify-existing',
    preferredEditMode: 'geometric-edit',
    sourceViewIds: ['view_test2'],
    maskHandle: 'region_mask_test2',
    worldContours: [[
      TEST2_SHARED_POLYLINE_POINTS[0],
      TEST2_SHARED_POLYLINE_POINTS[1],
      TEST2_SHARED_POLYLINE_POINTS[2],
      [118.992468, 203.546338],
      [122, 207],
      [116, 210],
      [102, 199],
      [99, 197],
    ]],
    worldHoles: [],
    anchors: [{
      id: 'anchor_test2_shoulder', role: 'boundary',
      point: [118.992468, 203.546338], confidence: 0.98,
    }],
    confidence,
    evidenceRefs: ['view_test2'],
  };
}
