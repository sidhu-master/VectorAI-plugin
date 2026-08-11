import sharp from 'sharp';

import {
  compileDrawingScene,
  SCENE_RENDERER_VERSION,
  type Bounds2D,
  type DrawingDocument,
  type RevisionId,
} from '../../../src/drawing/index.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';
import {
  rasterizeScene,
  type AffineTransform,
} from '../drawing-render/rasterize-scene.js';

export interface GroundingNode {
  label: string;
  nodeId: string;
  type: string;
  rgb: [number, number, number];
  bounds: SourcePixelRect;
  worldBounds: Bounds2D;
  normalized: { left: number; top: number; right: number; bottom: number };
  selected: boolean;
  zOrder: number;
  clipped: boolean;
}

export interface GroundingSnapshot {
  width: number;
  height: number;
  imageDataUrl: string;
  rendererVersion: typeof SCENE_RENDERER_VERSION;
  worldToImage: AffineTransform;
  nodes: GroundingNode[];
}

export interface RenderGroundingSnapshotInput {
  document: DrawingDocument;
  revision?: RevisionId;
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  selectedIds?: string[];
  maxDimension?: number;
  background?: readonly [number, number, number];
}

export async function renderGroundingSnapshot(
  input: RenderGroundingSnapshotInput,
): Promise<GroundingSnapshot> {
  const maxDimension = Math.max(1, Math.floor(input.maxDimension ?? 2048));
  const sourceMax = Math.max(input.width, input.height);
  const factor = sourceMax > maxDimension ? maxDimension / sourceMax : 1;
  const width = Math.max(1, Math.round(input.width * factor));
  const height = Math.max(1, Math.round(input.height * factor));
  const worldToImage: AffineTransform = [
    input.scale * factor,
    0,
    0,
    -input.scale * factor,
    input.offsetX * factor,
    input.offsetY * factor,
  ];
  const viewBounds = viewportWorldBounds(input);
  const scene = compileDrawingScene(input.document, {
    revision: input.revision ?? ('revision_visual_snapshot' as RevisionId),
    viewBounds,
    scale: input.scale * factor,
  });
  const selected = new Set(input.selectedIds ?? []);
  const nodeIds = [...new Set(scene.primitives.map((primitive) => primitive.nodeId))];
  const palette = new Map(nodeIds.map((nodeId, index) => [nodeId, paletteColor(index)]));
  const raster = rasterizeScene(scene, {
    width,
    height,
    worldToImage,
    background: [...(input.background ?? [13, 16, 20]), 255] as const,
    colorForPrimitive: (primitive) => [...palette.get(primitive.nodeId)!, 255] as const,
    strokeWidthPixels: (primitive) => selected.has(primitive.nodeId) ? 2 : 1,
  });
  const visibleNodeIds = nodeIds.filter((nodeId) => raster.nodeBounds.has(nodeId));
  const nodes: GroundingNode[] = visibleNodeIds.map((nodeId, index) => {
    const bounds = raster.nodeBounds.get(nodeId)!;
    const sceneNode = scene.nodeIndex[nodeId];
    const rgb = palette.get(nodeId)!;
    return {
      label: `G${String(index + 1).padStart(3, '0')}`,
      nodeId,
      type: sceneNode.nodeType,
      rgb: [...rgb],
      bounds: { ...bounds },
      worldBounds: { ...sceneNode.worldBounds },
      normalized: {
        left: bounds.x / width,
        top: bounds.y / height,
        right: (bounds.x + bounds.width) / width,
        bottom: (bounds.y + bounds.height) / height,
      },
      selected: selected.has(nodeId),
      zOrder: scene.primitives.findIndex((primitive) => primitive.nodeId === nodeId),
      clipped: bounds.x === 0 || bounds.y === 0
        || bounds.x + bounds.width === width
        || bounds.y + bounds.height === height,
    };
  });
  const png = await sharp(raster.rgba, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
  return {
    width,
    height,
    imageDataUrl: `data:image/png;base64,${png.toString('base64')}`,
    rendererVersion: SCENE_RENDERER_VERSION,
    worldToImage,
    nodes,
  };
}

function viewportWorldBounds(input: RenderGroundingSnapshotInput): Bounds2D {
  return {
    minX: -input.offsetX / input.scale,
    minY: (input.offsetY - input.height) / input.scale,
    maxX: (input.width - input.offsetX) / input.scale,
    maxY: input.offsetY / input.scale,
  };
}

function paletteColor(index: number): [number, number, number] {
  const hue = index * 137.508 % 360;
  const lightness = 0.52 + (index % 3) * 0.06;
  return hslToRgb(hue, 0.68, lightness);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return rgb.map((value) => Math.round((value + match) * 255)) as [number, number, number];
}
