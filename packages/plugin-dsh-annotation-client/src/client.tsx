// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { DrawingSurfaceRegistry } from '@vectorai/drawing-surface-api';
import '@vectorai/drawing-viewer-react/styles.css';
import './client.css';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import { createAnnotationRemoteStateSource } from './annotation-state-source';
import { ANNOTATION_REMOTE } from './remote';
import { createPartitionController } from './partition-controller';
import { createDimensionChainController } from './dimension-chain-controller';
import { createGdtController } from './gdt-controller';
import { EngineeringDropBridge } from './EngineeringDropBridge';
import {
  ANNOTATION_DIMENSION_CHAIN_LAYER,
  ANNOTATION_DIAMETER_LAYER,
  ANNOTATION_OPENING_ANGLE_LAYER,
  ANNOTATION_PARTITION_LAYER,
  ANNOTATION_DATUM_LAYER,
  ANNOTATION_GDT_LAYER,
} from './drawing-layers';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSurfaceRegistry: DrawingSurfaceRegistry;
  }
}

export const inject = ['remote', 'drawingSurfaceRegistry', 'drawingFileExport', 'slots'];

export async function apply(ctx: Context) {
  const remote = ctx.get('remote');
  const disposeRemote = await remote.$mount(ANNOTATION_REMOTE);
  const fiber = ctx.inject(
    ['remote.drawingAnnotation', 'drawingSurfaceRegistry', 'drawingFileExport', 'slots'],
    (scope) => {
      const annotationRemote = scope.get('remote').drawingAnnotation;
      const registry = scope.get('drawingSurfaceRegistry');
      const drawingFileExport = scope.get('drawingFileExport');
      const slots = scope.get('slots');
      const stateSource = createAnnotationRemoteStateSource(annotationRemote);
      const partitionControllers = new Map<string, ReturnType<typeof createPartitionController>>();
      const dimensionControllers = new Map<string, ReturnType<typeof createDimensionChainController>>();
      const gdtControllers = new Map<string, ReturnType<typeof createGdtController>>();
      const partitionFor = (sessionId: string) => {
        const current = partitionControllers.get(sessionId);
        if (current) return current;
        const controller = createPartitionController(
          sessionId,
          annotationRemote,
        );
        partitionControllers.set(sessionId, controller);
        void controller.actions.refresh();
        return controller;
      };
      const dimensionsFor = (sessionId: string) => {
        const current = dimensionControllers.get(sessionId);
        if (current) return current;
        const controller = createDimensionChainController(
          sessionId,
          annotationRemote,
        );
        dimensionControllers.set(sessionId, controller);
        void controller.actions.refresh();
        return controller;
      };
      const gdtFor = (sessionId: string) => {
        const current = gdtControllers.get(sessionId);
        if (current) return current;
        const controller = createGdtController(sessionId, annotationRemote);
        gdtControllers.set(sessionId, controller);
        void controller.actions.refresh();
        return controller;
      };
      const layerRegistration = registry.registerLayer(ANNOTATION_PARTITION_LAYER);
      const openingAngleLayerRegistration = registry.registerLayer(ANNOTATION_OPENING_ANGLE_LAYER);
      const diameterLayerRegistration = registry.registerLayer(ANNOTATION_DIAMETER_LAYER);
      const dimensionChainLayerRegistration = registry.registerLayer(ANNOTATION_DIMENSION_CHAIN_LAYER);
      const datumLayerRegistration = registry.registerLayer(ANNOTATION_DATUM_LAYER);
      const gdtLayerRegistration = registry.registerLayer(ANNOTATION_GDT_LAYER);
      const registration = registry.registerWorkspace({
        id: 'engineering-annotation',
        apiVersion: 1,
        priority: 100,
        claimSource: stateSource.claimSource,
        Component: (props) => <AnnotationWorkspace
          {...props}
          state={stateSource.observeState(props.sessionId)}
          partition={partitionFor(props.sessionId)}
          dimensionChain={dimensionsFor(props.sessionId)}
          gdt={gdtFor(props.sessionId)}
          drawingFileExport={drawingFileExport}
        />,
      });
      const dropFiber = slots.inject('conversation.input.dock', () => slots.register({
        name: 'conversation.input.dock',
        id: 'vectorai-engineering-import-drop',
        order: -200,
        inject: (sessionId) => {
          const id = String(sessionId);
          return {
            partition: partitionFor(id),
            refreshClaim: () => stateSource.refresh(id),
          };
        },
      }, EngineeringDropBridge));
      return async () => {
        await dropFiber.dispose();
        registration.dispose();
        openingAngleLayerRegistration.dispose();
        diameterLayerRegistration.dispose();
        dimensionChainLayerRegistration.dispose();
        datumLayerRegistration.dispose();
        gdtLayerRegistration.dispose();
        layerRegistration.dispose();
        stateSource.dispose();
        for (const controller of partitionControllers.values()) controller.dispose();
        partitionControllers.clear();
        for (const controller of dimensionControllers.values()) controller.dispose();
        dimensionControllers.clear();
        for (const controller of gdtControllers.values()) controller.dispose();
        gdtControllers.clear();
      };
    },
  );
  return async () => {
    await fiber.dispose();
    await disposeRemote();
  };
}
