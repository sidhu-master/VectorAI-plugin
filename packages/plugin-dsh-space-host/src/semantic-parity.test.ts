// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { solveSpatialIntent } from '@vectorai/drawing-edit-core';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { InMemoryDrawingRepository } from './repository';
import { SemanticEditService } from './semantic-edit-service';

describe('DSH semantic edit production parity', () => {
  it('observes a current image and returns bounded vector/topology context', async () => {
    const drawings = new InMemoryDrawingRepository({
      drawingId: () => 'drawing-parity',
      vectorizer: {
        async vectorize({ drawingId }) {
          const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
          document.geometry = [
            {
              id: 'carrier' as GeometryId, type: 'circle', center: [0, 0], radius: 10,
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
            {
              id: 'connector' as GeometryId, type: 'line', start: [10, 0], end: [30, 0],
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          ];
          return {
            document,
            bounds: { minX: -10, minY: -10, maxX: 30, maxY: 10 },
            provisional: false,
          };
        },
      },
    });
    const attachment: ImageAttachmentRef = {
      attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 80, height: 40,
    };
    drawings.bindPending('session-parity', attachment);
    await drawings.importPending('session-parity', {
      data: new Uint8Array([1]), signal: new AbortController().signal,
    });
    let sequence = 0;
    const service = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-${++sequence}`,
      now: () => 100,
      digest: (value) => `sha256:${value.length}`,
    });
    const task = service.startTask('session-parity', {
      objective: 'Move the connected component upward',
      rootUserMessageDigest: 'sha256:user',
      policy: 'auto-safe',
    });

    const observation = await service.observe('session-parity', { taskId: task.taskId }) as unknown as {
      artifactRefs: unknown[];
    };
    expect(observation.artifactRefs).toHaveLength(1);

    const context = service.buildContext('session-parity', {
      taskId: task.taskId,
      observationId: (observation as unknown as { observationId: string }).observationId,
    }) as unknown as {
      geometryFacts: unknown[];
      connectedCarrierFacts: unknown[];
      knowledge: { status: string };
    };
    expect(context.geometryFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'carrier', type: 'circle' }),
      expect.objectContaining({ nodeId: 'connector', type: 'line' }),
    ]));
    expect(context.connectedCarrierFacts).toEqual([
      expect.objectContaining({ carrierNodeId: 'carrier', contactedPortCount: 1 }),
    ]);
    expect(context.knowledge.status).toBe('complete');
  });

  it('produces the same candidate digest through the Host adapter and shared core solver', async () => {
    const drawings = new InMemoryDrawingRepository({
      drawingId: () => 'drawing-parity', previewHandle: () => 'workspace-preview-1',
      vectorizer: {
        async vectorize({ drawingId }) {
          const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
          document.geometry = [{
            id: 'movable-component' as GeometryId, type: 'circle', center: [10, 5], radius: 2,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          }, {
            id: 'protected-component' as GeometryId, type: 'circle', center: [-10, 0], radius: 4,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          }];
          return { document, bounds: { minX: -20, minY: -10, maxX: 20, maxY: 20 }, provisional: false };
        },
      },
    });
    const attachment: ImageAttachmentRef = {
      attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 40, height: 30,
    };
    drawings.bindPending('session-parity', attachment);
    await drawings.importPending('session-parity', {
      data: new Uint8Array([1]), signal: new AbortController().signal,
    });
    let sequence = 0;
    const ports = {
      id: (kind: string) => `${kind}-${++sequence}`,
      now: () => 100,
      digest: (value: string) => `sha256:${value.length}:${checksum(value)}`,
    };
    const service = new SemanticEditService(drawings, ports);
    service.projectSelection('session-parity', {
      expectedRef: { drawingId: 'drawing-parity', revision: 1 }, nodeIds: ['movable-component'],
    });
    service.bindUserInstruction('session-parity', {
      rootUserMessageId: 'message-1', rootUserMessageDigest: 'sha256:user',
      objective: 'Move the selected component upward.', numericConstraints: [],
    });
    await service.observeCurrent('session-parity');
    service.selectCurrentParts('session-parity', {
      parts: [{ partKey: 'subject', label: 'selected component', references: [{ kind: 'current_selection' }] }],
    });
    const intent = {
      summary: 'move selected component upward',
      goals: [{ kind: 'direction' as const, subject: 'subject', direction: 'up' as const, magnitude: 'slight' as const }],
      preserve: [{ kind: 'protected_scope' as const }, { kind: 'minimum_deformation' as const }],
    };
    const snapshot = drawings.getSnapshot('session-parity');
    if (!snapshot) throw new Error('expected snapshot');
    const direct = solveSpatialIntent({
      document: snapshot.document, baseRef: snapshot.ref,
      parts: service.currentSelectedParts('session-parity'), intent, numericConstraints: [], ports,
    });
    const hosted = service.previewCurrentIntent('session-parity', intent);

    expect(hosted.candidateDigest).toBe(direct.candidateDigest);
    expect(hosted.effectDigest).toBe(direct.effectDigest);
  });

  it('keeps fixture identities, coordinates, and gesture-specific rules out of production code', async () => {
    const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const roots = [
      resolve(workspaceRoot, 'packages/drawing-edit-protocol/src'),
      resolve(workspaceRoot, 'packages/drawing-edit-core/src'),
      resolve(workspaceRoot, 'packages/plugin-dsh-space-host/src'),
    ];
    const forbidden = /right-hand|left-hand|doraemon|打招呼|wave[_-]?hand|crossed[_-]?hands|12\.7639320225|\[-3,\s*11\]/i;
    const violations: string[] = [];
    for (const root of roots) {
      for (const path of await productionTypeScriptFiles(root)) {
        const text = await readFile(path, 'utf8');
        const match = text.match(forbidden);
        if (match) violations.push(`${path}:${match[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

async function productionTypeScriptFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) output.push(...await productionTypeScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) output.push(path);
  }
  return output;
}

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}
