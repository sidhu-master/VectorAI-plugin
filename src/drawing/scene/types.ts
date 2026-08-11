import type {
  DrawingId,
  NodeQuality,
  RevisionId,
  Vec2,
} from '../document/types';
import type { Bounds2D } from '../query/types';

export const SCENE_RENDERER_VERSION = 'scene-1.0';

export type ScenePlane = 'geometry' | 'construction' | 'annotation' | 'text';

export type SceneStyleRole =
  | 'primary'
  | 'construction'
  | 'annotation'
  | 'text'
  | 'dimension';

export type ScenePathCommand =
  | { op: 'M' | 'L'; point: Vec2 }
  | { op: 'Q'; control: Vec2; end: Vec2 }
  | {
      op: 'A';
      center: Vec2;
      radiusX: number;
      radiusY: number;
      rotation: number;
      startAngle: number;
      endAngle: number;
      counterClockwise: boolean;
    }
  | { op: 'Z' };

interface ScenePrimitiveBase {
  key: string;
  nodeId: string;
  nodeType: string;
  plane: ScenePlane;
  role: SceneStyleRole;
  semanticRole?: string;
  quality: NodeQuality;
}

export interface ScenePath extends ScenePrimitiveBase {
  kind: 'path';
  commands: ScenePathCommand[];
}

export interface SceneMarker extends ScenePrimitiveBase {
  kind: 'marker';
  position: Vec2;
  marker: 'point' | 'center';
}

export interface SceneText extends ScenePrimitiveBase {
  kind: 'text';
  content: string;
  position: Vec2;
  height: number;
  rotation: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top';
}

export type ScenePrimitive = ScenePath | SceneMarker | SceneText;

export interface SceneNodeIndex {
  nodeId: string;
  nodeType: string;
  worldBounds: Bounds2D;
  primitiveKeys: string[];
}

export interface RenderScene {
  drawingId: DrawingId;
  revision: RevisionId;
  rendererVersion: typeof SCENE_RENDERER_VERSION;
  worldBounds: Bounds2D | null;
  primitives: ScenePrimitive[];
  nodeIndex: Record<string, SceneNodeIndex>;
}

export interface CompileSceneOptions {
  revision: RevisionId;
  viewBounds?: Bounds2D;
  scale?: number;
}
