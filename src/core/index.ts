/**
 * Spatial Core - 公共导出
 */

export * from './types';
export { validateIntent } from './intent-validator';
export { compileIntent, resetIdCounter } from './compiler';
export { validateModel } from './validator';
export { createEmptyModel, createModel, createDerivedModel, cloneModel } from './model';
export { migrateModelToCurrent } from './migrate';
export { computeDimensionValue, refreshDimensions } from './dimensions';
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
export { applyPatch } from './patch/apply';
export type { PatchApplyResult } from './patch/apply';
export { compileIntentToPatch } from './patch/intent-to-patch';

// Spatial Commit History
export * from './history/types';
export { createHistory, commitPatch, undo, redo } from './history/history';
export type { CommitPatchResult } from './history/history';

// Agent Runtime
export * from './runtime/capabilities';
export * from './runtime/receipts';
export * from './runtime/context';
export * from './runtime/state-machine';
