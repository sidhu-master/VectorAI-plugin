import type { IdFactory } from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type { DrawingCvToolRegistry } from '../drawing-cv/tool-registry.js';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service.js';
import { CounterfactualWorldService } from '../drawing-preview-world/service.js';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service.js';
import { DrawingWorldModelTools } from '../drawing-world-model/tools.js';
import { DrawingModelTools } from './drawing-tools.js';
import { DrawingGenerationTools } from './generation-tools.js';
import { ModelDrawingToolRegistry } from './registry.js';
import { DrawingTopologyTools } from './topology-tools.js';
import { guideModelDrawingTool } from './catalog.js';

export * from './drawing-tools.js';
export * from './catalog.js';
export * from './generation-tools.js';
export * from './registry.js';
export * from './topology-tools.js';
export * from '../drawing-world-model/tools.js';
export type * from './types.js';

export function createModelDrawingToolGateway(input: {
  application: DrawingApplication;
  idFactory?: IdFactory;
  redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  now?: () => number;
}) {
  const counterfactualWorld = new CounterfactualWorldService();
  const drawingTools = new DrawingModelTools({
    application: input.application,
    idFactory: input.idFactory,
    counterfactualWorld,
  });
  const topologyTools = new DrawingTopologyTools({
    application: input.application,
    drawingTools,
  });
  const generationTools = new DrawingGenerationTools({
    application: input.application,
    drawingTools,
    redraw: input.redraw,
    vectorization: input.vectorization,
    cvTools: input.cvTools,
  });
  const worldModelTools = new DrawingWorldModelTools({
    application: input.application,
    counterfactualWorld,
    now: input.now,
  });
  const registry = new ModelDrawingToolRegistry({
    tools: [
      ...drawingTools.definitions,
      ...topologyTools.definitions,
      ...generationTools.definitions,
      ...worldModelTools.definitions,
    ].map(guideModelDrawingTool),
    getCurrentRevision: (drawingId) => drawingTools.currentRevision(drawingId),
    now: input.now,
  });
  const discardRun = (runId: string) => {
    const drawingCandidates = drawingTools.discardRun(runId);
    const generationCandidates = generationTools.discardRun(runId);
    const worldSlices = worldModelTools.discardRun(runId);
    const counterfactualBranches = counterfactualWorld.discardRun(runId);
    return { drawingCandidates, generationCandidates, worldSlices, counterfactualBranches };
  };
  return {
    registry,
    drawingTools,
    topologyTools,
    generationTools,
    worldModelTools,
    discardRun,
  };
}
