// SPDX-License-Identifier: Apache-2.0

export { DrawingWorkspace } from './DrawingWorkspace';
export { DrawingSurface } from './surface/DrawingSurface';
export type { DrawingSurfaceProps } from './surface/DrawingSurface';
export {
  AnnotationLayer,
  AxesLayer,
  GeometryLayer,
  GridLayer,
  PreviewLayer,
  RelationLayer,
  SelectionLayer,
  SourceLayer,
} from './surface/layers';
export {
  dispatchPrimaryPointerEvent,
  PanZoomController,
  SelectionController,
} from './surface/controllers';
export type {
  DrawingPointerController,
  DrawingPointerDispatchResult,
} from './surface/controllers';
export { Canvas } from './canvas/Canvas';
export { EntityRenderer, formatPortableTolerance } from './canvas/EntityRenderer';
export { ScreenSpaceLabel } from './canvas/ScreenSpaceLabel';
export { estimateScreenTextWidth, screenSpaceTransform } from './canvas/screen-space';
export { cancelFrame, scheduleFrame } from './frame-scheduler';
export type { ScreenSpaceLabelProps } from './canvas/ScreenSpaceLabel';
export {
  drawingBounds,
  fitViewportToDrawing,
  nodeBounds,
  nodesInWorldBox,
  screenToWorld,
  worldToScreen,
  zoomViewportAt,
} from './canvas/geometry';
export type { Bounds2D, DrawingRenderable } from './canvas/geometry';
export type {
  DeepReadonly,
  DrawingWorkspaceProps,
  PreviewOverlayContext,
  PreviewOverlayContribution,
} from './DrawingWorkspace';
export { useDrawingWorkspace } from './hooks';
export {
  DrawingWorkspaceProvider,
  useDrawingWorkspaceStore,
} from './provider';
export type { DrawingWorkspaceProviderProps } from './provider';
export { ObjectList } from './panels/ObjectList';
export { PropertyInspector } from './panels/PropertyInspector';
export { WorkspaceStatus } from './panels/WorkspaceStatus';
export { WorkspaceToolbar, WorkspaceToolbarView } from './panels/WorkspaceToolbar';
export type { WorkspaceToolbarHistory, WorkspaceToolbarProps, WorkspaceToolbarViewProps } from './panels/WorkspaceToolbar';
export { WorkspaceActivityBar } from './panels/WorkspaceActivityBar';
export type { WorkspaceActivityBarProps, WorkspacePanelDefinition, WorkspacePanelId } from './panels/WorkspaceActivityBar';
export { DrawingLayerManager } from './panels/DrawingLayerManager';
export type { DrawingLayerManagerItem, DrawingLayerManagerProps } from './panels/DrawingLayerManager';
