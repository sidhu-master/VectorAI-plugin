// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';

import { LocalCleanLineVectorizer } from './vectorizer';
import { InMemoryDrawingRepository } from './repository';
import { SemanticEditService } from './semantic-edit-service';
import { FileDrawingRepositoryStorage } from './repository-storage';

const fixturePath = resolve(import.meta.dirname, '../../../test2.png');

describe.skipIf(!existsSync(fixturePath))('LocalCleanLineVectorizer', () => {
  it('vectorizes a real upload and completes semantic selection, multi-part commit, and Undo', async () => {
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

    const storageRoot = await mkdtemp(join(tmpdir(), 'vectorai-real-semantic-'));
    onTestFinished(() => rm(storageRoot, { recursive: true, force: true }));
    const drawings = new InMemoryDrawingRepository({
      drawingId: () => 'drawing_test2',
      vectorizer: { async vectorize() { return structuredClone(result); } },
      storage: new FileDrawingRepositoryStorage(storageRoot),
    });
    drawings.bindPending('session-real-selection', attachment);
    await drawings.importPending('session-real-selection', {
      data, signal: new AbortController().signal,
    });
    let sequence = 0;
    const semantic = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-real-${++sequence}`,
      now: () => 1_000 + sequence,
      digest: (value) => `sha256:real-${value.length}-${sequence}`,
    });
    semantic.bindUserInstruction('session-real-selection', {
      rootUserMessageId: 'message-real-multipart',
      rootUserMessageDigest: 'sha256:message-real-multipart',
      objective: '把画面左右两侧的圆形部件向内并向上移动',
      numericConstraints: [],
    });

    const observed = await semantic.observeCurrent('session-real-selection');
    const left = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('circle') && summary.includes('lower-left')
    ));
    const right = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('circle') && summary.includes('lower-right')
    ));
    const rightArm = [
      observed.selectionCandidates.find(({ summary }) => (
        summary.includes('polyline') && summary.includes('middle-right')
      )),
      observed.selectionCandidates.find(({ summary }) => (
        summary.includes('line') && summary.includes('lower-right')
      )),
    ];
    expect(left?.key).toMatch(/^c\d+$/);
    expect(right?.key).toMatch(/^c\d+$/);
    expect(rightArm.every((candidate) => candidate?.key !== undefined)).toBe(true);
    expect(JSON.stringify(observed)).not.toMatch(/node_vec_/);

    const selected = semantic.selectCurrentParts('session-real-selection', {
      parts: [{
        partKey: 'left-part', label: 'left circular part',
        references: [{ kind: 'candidate', key: left!.key }],
      }, {
        partKey: 'right-part', label: 'right multi-element part',
        references: [right!, ...rightArm].map((candidate) => ({
          kind: 'candidate' as const, key: candidate!.key,
        })),
      }],
    });
    expect(selected).toMatchObject({
      state: 'selected',
      parts: [{ partKey: 'left-part', nodeCount: 1 }, { partKey: 'right-part', nodeCount: 3 }],
    });

    const preview = semantic.previewCurrentIntent('session-real-selection', {
      summary: 'move both side components inward and upward as one edit',
      goals: [
        { kind: 'direction', subject: 'left-part', direction: 'right', magnitude: 'strong' },
        { kind: 'direction', subject: 'left-part', direction: 'up', magnitude: 'moderate' },
        { kind: 'direction', subject: 'right-part', direction: 'left', magnitude: 'strong' },
        { kind: 'direction', subject: 'right-part', direction: 'up', magnitude: 'moderate' },
        { kind: 'alignment', subject: 'left-part', reference: { kind: 'part', partKey: 'right-part' }, axis: 'y' },
      ],
      preserve: [
        { kind: 'part_shape', partKey: 'left-part' },
        { kind: 'part_shape', partKey: 'right-part' },
        { kind: 'minimum_deformation' },
      ],
    });
    expect(preview.candidateDigest).toMatch(/^sha256:/);
    expect(semantic.currentPreviewPresentation('session-real-selection').changedNodeCount)
      .toBeGreaterThan(0);
    await semantic.evaluateCurrentPreview('session-real-selection');
    expect(semantic.finalizeCurrentPreview('session-real-selection')).toMatchObject({
      status: 'rejected', disposition: 'confirmation_required',
    });
    const committed = semantic.finalizeCurrentPreview('session-real-selection', true);
    expect(committed).toMatchObject({ status: 'committed', ref: { revision: 2 } });
    if (committed.status !== 'committed') throw new Error('expected committed real selection');
    const undone = semantic.undoAuthorized('session-real-selection', {
      targetCommitId: committed.commitId,
      expectedCurrentRef: committed.ref,
    });
    expect(undone).toMatchObject({ status: 'committed', resultingRef: { revision: 3 } });
  }, 35_000);
});
