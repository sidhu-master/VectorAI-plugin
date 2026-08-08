/**
 * Spatial Core - 公共导出
 */

export * from './types';
export { validateIntent } from './intent-validator';
export { compileIntent, resetIdCounter } from './compiler';
export { validateModel } from './validator';
export { createEmptyModel, createModel, createDerivedModel, cloneModel } from './model';
export { DXFAdapter } from './adapters/dxf';
export type { RepresentationAdapter } from './adapters/types';

// Spatial Harness
export {
  searchEntities,
  inspectEntity,
  applyEdits,
  summarizeModel,
} from './harness';
export type {
  SearchQuery,
  SearchResult,
  InspectResult,
  EditOperation,
  EditResult,
  ModelSummary,
} from './harness';

// Spatial Agent Workflow
export {
  verifyIntent,
  executeStep,
  applyStepToModel,
  PLANNER_PROMPT,
  buildStepPrompt,
} from './agent';
export type {
  TaskPlan,
  TaskStep,
  StepStatus,
  StepResult,
  VerificationResult,
} from './agent';

// Spatial Patch
export * from './patch/types';
export { validatePatch } from './patch/validate';
