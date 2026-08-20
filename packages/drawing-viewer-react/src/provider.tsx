// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceStore } from '@vectorai/drawing-workspace';
import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from 'react';

const DrawingWorkspaceStoreContext = createContext<DrawingWorkspaceStore | null>(null);

export interface DrawingWorkspaceProviderProps extends PropsWithChildren {
  store: DrawingWorkspaceStore;
  autoLoad?: boolean;
}

export function DrawingWorkspaceProvider({
  store,
  autoLoad = true,
  children,
}: DrawingWorkspaceProviderProps) {
  useEffect(() => {
    if (autoLoad) void store.getState().load();
    return () => store.getState().destroy();
  }, [autoLoad, store]);

  return (
    <DrawingWorkspaceStoreContext.Provider value={store}>
      {children}
    </DrawingWorkspaceStoreContext.Provider>
  );
}

export function useDrawingWorkspaceStore(): DrawingWorkspaceStore {
  const store = useContext(DrawingWorkspaceStoreContext);
  if (store === null) {
    throw new Error('Drawing workspace components require DrawingWorkspaceProvider');
  }
  return store;
}
