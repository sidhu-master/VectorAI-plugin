// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';
import { apply, inject } from './client';

describe('client apply', () => {
  it('declares every alpha shell service used by its injected fibers', () => {
    expect(inject).toEqual(['slots', 'remote', 'conversation', 'uiConversation']);
  });

  it('captures injected services before callbacks run outside the plugin fiber', async () => {
    const getSnapshot = vi.fn(async () => ({ ok: true as const, value: null }));
    const stageInteractiveEdit = vi.fn();
    const stageUndo = vi.fn();
    const getOperation = vi.fn();
    const execute = vi.fn();
    const resolveImage = vi.fn();
    const createDrafts = vi.fn();
    const releaseDraftAttachments = vi.fn();
    const disposeRemote = vi.fn();
    const disposeRegistry = vi.fn();
    const disposeFileExport = vi.fn();
    const disposeRootFiber = vi.fn();
    const disposeViewFiber = vi.fn();
    const registrations = new Map<string, {
      name?: string;
      priority?: number;
      children?: Record<string, unknown>;
      inject(sessionId: string): {
        workspacePort: { load(): Promise<unknown> };
        conversation: {
          createDrafts: typeof createDrafts;
          releaseDraftAttachments: typeof releaseDraftAttachments;
        };
        releaseSources(): void;
      };
    }>();

    let pluginActive = true;
    const drawingSpace = { getSnapshot, stageInteractiveEdit, stageUndo, getOperation };
    const conversation = { createDrafts, releaseDraftAttachments };
    const uiConversation = { imageUrl: resolveImage };
    const remote = {
      $mount: vi.fn(async () => disposeRemote),
      get drawingSpace() {
        if (!pluginActive) {
          throw new Error('remote namespace accessed outside inject');
        }
        return drawingSpace;
      },
      get commands() {
        if (!pluginActive) throw new Error('remote namespace accessed outside inject');
        return { execute };
      },
    };
    const slots = {
      inject: vi.fn((_name: string, callback: () => unknown) => callback()),
      register: vi.fn((descriptor: { name: string }) => {
        registrations.set(descriptor.name, descriptor as never);
        return vi.fn();
      }),
    };
    const ctx = {
      provide: vi.fn((name: string, value: unknown) => {
        if (name === 'drawingSurfaceRegistry') {
          expect(value).toMatchObject({ registerWorkspace: expect.any(Function) });
          return disposeRegistry;
        }
        expect(name).toBe('drawingFileExport');
        expect(value).toMatchObject({ download: expect.any(Function) });
        return disposeFileExport;
      }),
      get(name: string) {
        if (name === 'remote') return remote;
        if (name === 'slots') return slots;
        if (name === 'conversation') return conversation;
        if (name === 'uiConversation') return uiConversation;
        throw new Error(`unexpected service ${name}`);
      },
      inject(deps: string[], callback: (scope: Context) => unknown) {
        callback(ctx);
        if (deps.length === 1) {
          expect(deps).toEqual(['remote.drawingSpace']);
          return { dispose: disposeRootFiber };
        }
        expect(deps).toEqual(['remote.drawingSpace', 'remote.commands', 'conversation', 'uiConversation']);
        return { dispose: disposeViewFiber };
      },
      get remote(): never {
        throw new Error('remote property accessed outside inject');
      },
      get slots(): never {
        throw new Error('slots property accessed outside inject');
      },
    } as unknown as Context;

    const dispose = await apply(ctx);
    expect(slots.inject).toHaveBeenCalledWith(
      'shell.overlay',
      expect.any(Function),
    );
    const rootRegistration = registrations.get('shell.overlay');
    expect(rootRegistration).toMatchObject({
      name: 'shell.overlay',
      id: 'vectorai-drawing-workspace',
      children: {
        'vectorai.drawing.workspace': { kind: 'single', scope: 'session' },
      },
    });
    expect(rootRegistration).not.toHaveProperty('label');
    pluginActive = false;
    const registration = registrations.get('vectorai.drawing.workspace');
    const injected = registration?.inject('session-1');
    expect(injected?.workspacePort.load).toBeTypeOf('function');
    await expect(injected?.workspacePort.load()).resolves.toBeNull();
    expect(getSnapshot).toHaveBeenCalledWith('session-1');
    expect(injected).toMatchObject({ conversation });
    injected?.releaseSources();

    await dispose();
    expect(disposeViewFiber).toHaveBeenCalledOnce();
    expect(disposeRootFiber).toHaveBeenCalledOnce();
    expect(disposeRemote).toHaveBeenCalledOnce();
    expect(disposeRegistry).toHaveBeenCalledOnce();
    expect(disposeFileExport).toHaveBeenCalledOnce();
  });
});
