// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LocalCleanLineVectorizer } from './vectorizer';

const fixturePath = resolve(import.meta.dirname, '../../../test2.png');

describe.skipIf(!existsSync(fixturePath))('LocalCleanLineVectorizer', () => {
  it('turns the uploaded image into real selectable geometry instead of four source-boundary lines', async () => {
    const data = await readFile(fixturePath);
    const attachment: ImageAttachmentRef = {
      attachmentId: 'test2' as ImageAttachmentRef['attachmentId'],
      mediaType: 'image/png',
      bytes: data.byteLength,
      width: 3058,
      height: 4103,
      name: 'test2.png',
    };
    const vectorizer = new LocalCleanLineVectorizer({ timeoutMs: 30_000 });

    const result = await vectorizer.vectorize({
      drawingId: 'drawing_test2',
      attachment,
      data,
      signal: new AbortController().signal,
    });

    const types = new Set(result.document.geometry.map((node) => node.type));
    expect(result.provisional).toBe(false);
    expect(result.document.geometry.length).toBeGreaterThan(20);
    expect(result.document.geometry.every((node) => !node.id.startsWith('source-boundary'))).toBe(true);
    expect(types.has('line')).toBe(true);
    expect(types.has('circle') || types.has('arc')).toBe(true);
    expect(result.document.relations.length).toBeGreaterThan(0);
    expect(result.document.features.length).toBeGreaterThan(0);
    const geometryIds = new Set(result.document.geometry.map((node) => node.id));
    expect(result.document.relations.every((relation) => (
      relation.type !== 'topology' || relation.nodeIds.every((id) => geometryIds.has(id as never))
    ))).toBe(true);
    expect(result.document.coordinateFrames).toContainEqual({
      id: 'frame_source_test2',
      kind: 'source',
      parentId: 'frame_document',
      transform: expect.arrayContaining([
        expect.any(Number),
        0,
        0,
        expect.any(Number),
        0,
        expect.any(Number),
      ]),
    });
  }, 35_000);
});
