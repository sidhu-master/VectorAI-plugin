import { createHash } from 'node:crypto';

import {
  compileDrawingScene,
  SCENE_RENDERER_VERSION,
  type Bounds2D,
  type DrawingDocument,
  type RevisionId,
} from '../../../src/drawing/index.js';
import {
  renderGroundingSnapshot,
  type GroundingSnapshot,
  type RenderGroundingSnapshotInput,
} from './grounding-renderer.js';
import type {
  AgentObservationViewport,
  ObservationViewPurpose,
  VisualObservation,
  VisualObservationView,
  VisualVectorDigest,
} from './observation-types.js';

const STYLE_PROFILE = 'agent-grounding-v1';
const DEFAULT_WORLD_BOUNDS: Bounds2D = { minX: -250, minY: -250, maxX: 250, maxY: 250 };

export interface BuildVisualObservationInput {
  document: DrawingDocument;
  revision: RevisionId;
  cacheScope?: string;
  includeAnnotations?: boolean;
  selectedIds?: string[];
  targetBounds?: Bounds2D;
  userViewport?: AgentObservationViewport;
}

export class DrawingObservationBuilder {
  readonly #renderSnapshot: (input: RenderGroundingSnapshotInput) => Promise<GroundingSnapshot>;
  readonly #maxImages: number;
  readonly #images = new Map<string, string>();
  readonly #viewCache = new Map<string, VisualObservationView>();
  readonly #inflight = new Map<string, Promise<VisualObservationView>>();

  constructor(input: {
    renderSnapshot?: (input: RenderGroundingSnapshotInput) => Promise<GroundingSnapshot>;
    maxImages?: number;
  } = {}) {
    this.#renderSnapshot = input.renderSnapshot ?? renderGroundingSnapshot;
    this.#maxImages = Math.max(2, Math.floor(input.maxImages ?? 32));
  }

  async build(input: BuildVisualObservationInput): Promise<VisualObservation> {
    const document = input.includeAnnotations === false
      ? { ...input.document, annotations: [] }
      : input.document;
    const renderInput = document === input.document ? input : { ...input, document };
    const selectedIds = [...new Set(input.selectedIds ?? [])].sort();
    const baseScene = compileDrawingScene(document, { revision: input.revision });
    const documentBounds = baseScene.worldBounds ?? DEFAULT_WORLD_BOUNDS;
    const vectorDigest: VisualVectorDigest = {
      unit: input.document.unitSystem.length,
      counts: {
        geometry: document.geometry.length,
        annotation: document.annotations.length,
        relation: document.relations.length,
        feature: document.features.length,
      },
      bounds: baseScene.worldBounds ? { ...baseScene.worldBounds } : null,
      nodes: Object.values(baseScene.nodeIndex).map((node) => ({
        id: node.nodeId,
        type: node.nodeType,
        bounds: { ...node.worldBounds },
      })),
    };
    const requests: ViewRequest[] = [{
      purpose: 'overview',
      viewport: fitBounds(documentBounds, 1024, 1024, 0.08),
      selectedIds,
    }];
    const selectedBounds = input.targetBounds ?? unionBounds(selectedIds
      .map((id) => baseScene.nodeIndex[id]?.worldBounds)
      .filter((bounds): bounds is Bounds2D => Boolean(bounds)));
    if (selectedBounds) {
      requests.push({
        purpose: 'target-detail',
        viewport: fitBounds(selectedBounds, 768, 768, 0.2),
        selectedIds,
      });
    }
    if (input.userViewport) {
      requests.push({
        purpose: 'user-viewport',
        viewport: normalizeViewport(input.userViewport),
        selectedIds,
      });
    }
    const views = await Promise.all(requests.map((request) => this.#buildView(renderInput, request)));
    return {
      drawingId: input.document.id,
      revision: input.revision,
      rendererVersion: SCENE_RENDERER_VERSION,
      selectedIds,
      vectorDigest,
      views,
    };
  }

  readImage(handle: string): string | null {
    const image = this.#images.get(handle);
    if (!image) return null;
    this.#images.delete(handle);
    this.#images.set(handle, image);
    return image;
  }

  async #buildView(
    input: BuildVisualObservationInput,
    request: ViewRequest,
  ): Promise<VisualObservationView> {
    const cacheKey = viewCacheKey(input, request);
    const cached = this.#viewCache.get(cacheKey);
    if (cached && this.#images.has(cached.image.handle)) return structuredClone(cached);
    const active = this.#inflight.get(cacheKey);
    if (active) return structuredClone(await active);
    const building = this.#renderView(input, request, cacheKey);
    this.#inflight.set(cacheKey, building);
    try {
      return structuredClone(await building);
    } finally {
      this.#inflight.delete(cacheKey);
    }
  }

  async #renderView(
    input: BuildVisualObservationInput,
    request: ViewRequest,
    cacheKey: string,
  ): Promise<VisualObservationView> {
    const viewport = request.viewport;
    const snapshot = await this.#renderSnapshot({
      document: input.document,
      revision: input.revision,
      scale: viewport.scale,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
      width: viewport.width,
      height: viewport.height,
      selectedIds: request.selectedIds,
      maxDimension: Math.max(viewport.width, viewport.height),
    });
    const handle = `observation_${digest(`${cacheKey}:${snapshot.imageDataUrl}`).slice(0, 24)}`;
    this.#putImage(handle, snapshot.imageDataUrl);
    const view: VisualObservationView = {
      id: `view_${request.purpose}_${digest(cacheKey).slice(0, 12)}`,
      purpose: request.purpose,
      cacheKey,
      image: { handle, mimeType: 'image/png' },
      width: snapshot.width,
      height: snapshot.height,
      worldBounds: viewportWorldBounds(viewport),
      worldToImage: snapshot.worldToImage,
      grounding: structuredClone(snapshot.nodes),
    };
    this.#viewCache.set(cacheKey, structuredClone(view));
    while (this.#viewCache.size > this.#maxImages) {
      this.#viewCache.delete(this.#viewCache.keys().next().value!);
    }
    return view;
  }

  #putImage(handle: string, dataUrl: string): void {
    this.#images.delete(handle);
    this.#images.set(handle, dataUrl);
    while (this.#images.size > this.#maxImages) {
      this.#images.delete(this.#images.keys().next().value!);
    }
  }
}

interface ViewRequest {
  purpose: ObservationViewPurpose;
  viewport: AgentObservationViewport;
  selectedIds: string[];
}

function fitBounds(
  source: Bounds2D,
  width: number,
  height: number,
  paddingRatio: number,
): AgentObservationViewport {
  const centerX = (source.minX + source.maxX) / 2;
  const centerY = (source.minY + source.maxY) / 2;
  const spanX = Math.max(source.maxX - source.minX, 1);
  const spanY = Math.max(source.maxY - source.minY, 1);
  const usable = Math.max(0.1, 1 - paddingRatio * 2);
  const scale = Math.min(width * usable / spanX, height * usable / spanY);
  return {
    scale,
    offsetX: width / 2 - centerX * scale,
    offsetY: height / 2 + centerY * scale,
    width,
    height,
  };
}

function normalizeViewport(viewport: AgentObservationViewport): AgentObservationViewport {
  return {
    scale: Math.max(0.001, viewport.scale),
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    width: Math.max(1, Math.floor(viewport.width)),
    height: Math.max(1, Math.floor(viewport.height)),
  };
}

function viewportWorldBounds(viewport: AgentObservationViewport): Bounds2D {
  return {
    minX: -viewport.offsetX / viewport.scale,
    minY: (viewport.offsetY - viewport.height) / viewport.scale,
    maxX: (viewport.width - viewport.offsetX) / viewport.scale,
    maxY: viewport.offsetY / viewport.scale,
  };
}

function unionBounds(bounds: Bounds2D[]): Bounds2D | null {
  if (bounds.length === 0) return null;
  return {
    minX: Math.min(...bounds.map((item) => item.minX)),
    minY: Math.min(...bounds.map((item) => item.minY)),
    maxX: Math.max(...bounds.map((item) => item.maxX)),
    maxY: Math.max(...bounds.map((item) => item.maxY)),
  };
}

function viewCacheKey(input: BuildVisualObservationInput, request: ViewRequest): string {
  return [
    input.document.id,
    input.revision,
    input.cacheScope ?? 'canonical',
    input.includeAnnotations === false ? 'geometry-only' : 'all-planes',
    request.purpose,
    digest(JSON.stringify(request.viewport)),
    digest(JSON.stringify(request.selectedIds)),
    SCENE_RENDERER_VERSION,
    STYLE_PROFILE,
  ].join('/');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
