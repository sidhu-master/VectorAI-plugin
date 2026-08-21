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
import { renderDrawingObservation, type ObservationRenderManifest } from './review-renderer';

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
    const observationRenders: Array<{
      input: Parameters<typeof renderDrawingObservation>[0];
      manifest: ObservationRenderManifest;
      contentDigest: string;
    }> = [];
    const semantic = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-real-${++sequence}`,
      now: () => 1_000 + sequence,
      digest: (value) => `sha256:real-${value.length}-${sequence}`,
      renderObservation: async (input) => {
        const rendered = await renderDrawingObservation(input);
        observationRenders.push({
          input: structuredClone(input), manifest: rendered.manifest,
          contentDigest: rendered.contentDigest,
        });
        return {
          contentDigest: rendered.contentDigest,
          attachment: {
            attachmentId: `observation-${observationRenders.length}` as never,
            mediaType: 'image/png', bytes: rendered.png.byteLength,
            width: rendered.manifest.width, height: rendered.manifest.height,
          },
          width: rendered.manifest.width, height: rendered.manifest.height,
          worldToImage: rendered.manifest.worldToImage,
        };
      },
    });
    semantic.bindUserInstruction('session-real-selection', {
      rootUserMessageId: 'message-real-multipart',
      rootUserMessageDigest: 'sha256:message-real-multipart',
      objective: '把角色右手抬起来打招呼',
      numericConstraints: [],
    });

    const observed = await semantic.observeCurrent('session-real-selection');
    const rightHand = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('circle') && summary.includes('lower-left')
    ));
    const initialRender = observationRenders[0];
    expect(initialRender?.manifest.candidateMarkers.map(({ key }) => key))
      .toEqual(observed.selectionCandidates.map(({ key }) => key));
    const nodes = new Map(result.document.geometry.map((node) => [String(node.id), node]));
    const markerFor = (predicate: (node: typeof result.document.geometry[number]) => boolean) => (
      initialRender?.input.candidateMarkers?.find(({ nodeIds }) => (
        nodeIds.length === 1 && predicate(nodes.get(nodeIds[0]!)!)
      ))
    );
    const upperRightArm = markerFor((node) => {
      if (node.type !== 'line') return false;
      const xs = [node.start[0], node.end[0]];
      const ys = [node.start[1], node.end[1]];
      return Math.min(...xs) > 60 && Math.min(...xs) < 70
        && Math.max(...xs) > 120 && Math.max(...xs) < 130
        && Math.min(...ys) > 240 && Math.min(...ys) < 255
        && Math.max(...ys) > 280 && Math.max(...ys) < 300;
    });
    const lowerRightArm = markerFor((node) => {
      if (node.type !== 'line') return false;
      const xs = [node.start[0], node.end[0]];
      const ys = [node.start[1], node.end[1]];
      return Math.min(...xs) > 95 && Math.min(...xs) < 110
        && Math.max(...xs) > 115 && Math.max(...xs) < 125
        && Math.min(...ys) > 185 && Math.min(...ys) < 200
        && Math.max(...ys) > 200 && Math.max(...ys) < 215;
    });
    expect(rightHand?.key).toMatch(/^c\d+$/);
    expect(upperRightArm?.key).toMatch(/^c\d+$/);
    expect(lowerRightArm?.key).toMatch(/^c\d+$/);
    expect(JSON.stringify(observed)).not.toMatch(/node_vec_/);

    const selected = semantic.selectCurrentParts('session-real-selection', {
      parts: [{
        partKey: 'character-right-arm', label: 'character right hand and disconnected arm contours',
        references: [rightHand!, upperRightArm!, lowerRightArm!].map((candidate) => ({
          kind: 'candidate' as const, key: candidate.key,
        })),
      }],
    });
    expect(selected).toMatchObject({
      state: 'selected',
      parts: [{ partKey: 'character-right-arm', nodeCount: 3 }],
    });
    const selectionAttachment = await semantic.renderCurrentSelectionObservation('session-real-selection');
    expect(selectionAttachment?.attachmentId).toBe('observation-2');
    expect(observationRenders[1]?.manifest.selectedNodeCount).toBe(3);
    expect(observationRenders[1]?.contentDigest).not.toBe(observationRenders[0]?.contentDigest);
    semantic.confirmCurrentSelection('session-real-selection');

    const preview = semantic.previewCurrentIntent('session-real-selection', {
      summary: 'raise the character right arm and hand to wave',
      goals: [
        { kind: 'direction', subject: 'character-right-arm', direction: 'up', magnitude: 'strong' },
      ],
      preserve: [
        { kind: 'part_shape', partKey: 'character-right-arm' },
        { kind: 'minimum_deformation' },
      ],
    });
    expect(preview.candidateDigest).toMatch(/^sha256:/);
    expect(semantic.currentPreviewPresentation('session-real-selection').changedNodeCount)
      .toBeGreaterThan(0);
    const previewDocument = drawings.getPreview('session-real-selection')?.candidate.document;
    expect(previewDocument).toBeDefined();
    for (const marker of [upperRightArm!, lowerRightArm!]) {
      const nodeId = marker.nodeIds[0]!;
      const before = result.document.geometry.find(({ id }) => String(id) === nodeId);
      const after = previewDocument?.geometry.find(({ id }) => String(id) === nodeId);
      if (!before || before.type !== 'line' || !after || after.type !== 'line') {
        throw new Error('expected articulated line connector');
      }
      const changedEndpointCount = Number(JSON.stringify(before.start) !== JSON.stringify(after.start))
        + Number(JSON.stringify(before.end) !== JSON.stringify(after.end));
      expect(changedEndpointCount).toBe(1);
    }
    const faceCandidate = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('polyline') && summary.includes('middle-left')
    ));
    const faceNodeId = initialRender?.input.candidateMarkers
      ?.find(({ key }) => key === faceCandidate?.key)?.nodeIds[0];
    expect(faceNodeId).toBeDefined();
    expect(drawings.getPreview('session-real-selection')?.diff.updatedNodeIds)
      .not.toContain(faceNodeId);
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
