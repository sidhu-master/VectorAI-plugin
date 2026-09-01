// SPDX-License-Identifier: Apache-2.0

export { AnnotationWorkspace } from './AnnotationWorkspace';
export type { AnnotationWorkspaceProps } from './AnnotationWorkspace';
export { createAnnotationRemoteStateSource } from './annotation-state-source';
export type {
  AnnotationRemoteStateSource,
  DrawingAnnotationRemote,
} from './annotation-state-source';
export { ANNOTATION_REMOTE } from './remote';
export { createPartitionController } from './partition-controller';
export type { PartitionController, PartitionControllerState, PartitionRemote } from './partition-controller';
export { DimensionPlanInspector } from './DimensionPlanInspector';
export type { DimensionPlanInspectorProps } from './DimensionPlanInspector';
export { createToleranceController } from './tolerance-controller';
export type {
  ToleranceController,
  ToleranceControllerState,
  ToleranceRemote,
  ToleranceTarget,
} from './tolerance-controller';
export { TolerancePopup } from './TolerancePopup';
export type { TolerancePopupProps } from './TolerancePopup';

// DSH discovers the browser half only from Host Loader entries. Pure UI packages
// therefore need a valid no-op Host face in addition to exports["./client"].
export function apply(): void {}
