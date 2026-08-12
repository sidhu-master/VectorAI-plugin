import type { IdFactory } from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type { DrawingCvToolRegistry } from '../drawing-cv/tool-registry.js';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service.js';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service.js';
import { DrawingModelTools } from './drawing-tools.js';
import { DrawingGenerationTools } from './generation-tools.js';
import { ModelDrawingToolRegistry } from './registry.js';
import { DrawingTopologyTools } from './topology-tools.js';

export * from './drawing-tools.js';
export * from './generation-tools.js';
export * from './registry.js';
export * from './topology-tools.js';
export type * from './types.js';

export function createModelDrawingToolGateway(input: {
  application: DrawingApplication;
  idFactory?: IdFactory;
  redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  now?: () => number;
}) {
  const drawingTools = new DrawingModelTools({
    application: input.application,
    idFactory: input.idFactory,
  });
  const topologyTools = new DrawingTopologyTools({
    application: input.application,
    drawingTools,
  });
  const generationTools = new DrawingGenerationTools({
    redraw: input.redraw,
    vectorization: input.vectorization,
    cvTools: input.cvTools,
  });
  const registry = new ModelDrawingToolRegistry({
    tools: [
      ...drawingTools.definitions,
      ...topologyTools.definitions,
      ...generationTools.definitions,
    ],
    getCurrentRevision: (drawingId) => drawingTools.currentRevision(drawingId),
    now: input.now,
  });
  return { registry, drawingTools, topologyTools, generationTools };
}
