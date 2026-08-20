// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceState } from '@vectorai/drawing-workspace';
import { useSyncExternalStore } from 'react';

import { useDrawingWorkspaceStore } from './provider';

export function useDrawingWorkspace<T>(
  selector: (state: DrawingWorkspaceState) => T,
): T {
  const store = useDrawingWorkspaceStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
