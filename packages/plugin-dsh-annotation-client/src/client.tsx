// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { DrawingSurfaceRegistry } from '@vectorai/drawing-surface-api';
import '@vectorai/drawing-viewer-react/styles.css';
import './client.css';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import { createAnnotationRemoteStateSource } from './annotation-state-source';
import { ANNOTATION_REMOTE } from './remote';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSurfaceRegistry: DrawingSurfaceRegistry;
  }
}

export const inject = ['remote', 'drawingSurfaceRegistry'];

export async function apply(ctx: Context) {
  const remote = ctx.get('remote');
  const disposeRemote = await remote.$mount(ANNOTATION_REMOTE);
  const fiber = ctx.inject(
    ['remote.drawingAnnotation', 'drawingSurfaceRegistry'],
    (scope) => {
      const annotationRemote = scope.get('remote').drawingAnnotation;
      const registry = scope.get('drawingSurfaceRegistry');
      const stateSource = createAnnotationRemoteStateSource(annotationRemote);
      const registration = registry.registerWorkspace({
        id: 'engineering-annotation',
        apiVersion: 1,
        priority: 100,
        claimSource: stateSource.claimSource,
        Component: (props) => <AnnotationWorkspace
          {...props}
          state={stateSource.observeState(props.sessionId)}
        />,
      });
      return () => {
        registration.dispose();
        stateSource.dispose();
      };
    },
  );
  return async () => {
    await fiber.dispose();
    await disposeRemote();
  };
}
