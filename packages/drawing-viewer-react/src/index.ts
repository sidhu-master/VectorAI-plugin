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
export { EntityRenderer } from './canvas/EntityRenderer';
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
export { WorkspaceToolbar } from './panels/WorkspaceToolbar';
