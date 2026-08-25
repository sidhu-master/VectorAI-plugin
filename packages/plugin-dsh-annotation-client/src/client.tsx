// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { DrawingSurfaceRegistry } from '@vectorai/drawing-surface-api';
import '@vectorai/drawing-viewer-react/styles.css';
import './client.css';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import { createAnnotationRemoteStateSource } from './annotation-state-source';
import { ANNOTATION_REMOTE } from './remote';
import { createPartitionController } from './partition-controller';
import { EngineeringDropBridge } from './EngineeringDropBridge';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSurfaceRegistry: DrawingSurfaceRegistry;
  }
}

export const inject = ['remote', 'drawingSurfaceRegistry', 'slots'];

export async function apply(ctx: Context) {
  const remote = ctx.get('remote');
  const disposeRemote = await remote.$mount(ANNOTATION_REMOTE);
  const fiber = ctx.inject(
    ['remote.drawingAnnotation', 'drawingSurfaceRegistry', 'slots'],
    (scope) => {
      const annotationRemote = scope.get('remote').drawingAnnotation;
      const registry = scope.get('drawingSurfaceRegistry');
      const slots = scope.get('slots');
      const stateSource = createAnnotationRemoteStateSource(annotationRemote);
      const partitionControllers = new Map<string, ReturnType<typeof createPartitionController>>();
      const partitionFor = (sessionId: string) => {
        const current = partitionControllers.get(sessionId);
        if (current) return current;
        const controller = createPartitionController(sessionId, annotationRemote);
        partitionControllers.set(sessionId, controller);
        void controller.actions.refresh();
        return controller;
      };
      const registration = registry.registerWorkspace({
        id: 'engineering-annotation',
        apiVersion: 1,
        priority: 100,
        claimSource: stateSource.claimSource,
        Component: (props) => <AnnotationWorkspace
          {...props}
          state={stateSource.observeState(props.sessionId)}
          partition={partitionFor(props.sessionId)}
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
        stateSource.dispose();
        for (const controller of partitionControllers.values()) controller.dispose();
        partitionControllers.clear();
      };
    },
  );
  return async () => {
    await fiber.dispose();
    await disposeRemote();
  };
}
