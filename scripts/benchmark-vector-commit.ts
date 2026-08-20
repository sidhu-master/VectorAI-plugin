import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import sharp from 'sharp';

import {
  createEmptyDrawing,
  type DrawingTransaction,
  type EvidenceId,
} from '../src/drawing/index.js';
import { FileDrawingRepository } from '../api/services/drawing-application/file-drawing-repository.js';
import { buildVectorizationSteps } from '../api/services/drawing-vectorization/build-steps.js';
import { PythonVectorizationProvider } from '../api/services/drawing-vectorization/python-provider.js';
import type { PersistedCleanLineVectorizationResult } from '../api/services/drawing-vectorization/types.js';

const sourcePath = resolve(process.cwd(), process.argv[2] ?? 'test2.png');
const bytes = await readFile(sourcePath);
const metadata = await sharp(bytes).metadata();
if (!metadata.width || !metadata.height) throw new Error('BENCHMARK_IMAGE_SIZE_UNAVAILABLE');

const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-vector-commit-'));
const provider = await PythonVectorizationProvider.create();
try {
  const vectorStartedAt = performance.now();
  const result = await provider.vectorize({
    source: {
      sourceId: `benchmark_${basename(sourcePath).replace(/[^a-zA-Z0-9]+/g, '_')}`,
      mimeType: sourcePath.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      bytes,
      width: metadata.width,
      height: metadata.height,
    },
    maxPixels: 4_000_000,
    signal: new AbortController().signal,
  });
  const vectorizationMs = performance.now() - vectorStartedAt;
  const steps = buildVectorizationSteps(persist(result));
  const repository = new FileDrawingRepository({ rootDirectory });
  let current = await repository.create(createEmptyDrawing());
  const batchDurationsMs: number[] = [];
  const commitStartedAt = performance.now();
  for (const step of steps) {
    const transaction: DrawingTransaction = {
      id: `transaction_batch_${step.batchIndex}`,
      baseRevision: current.revision,
      actor: { type: 'AI', id: 'benchmark' },
      commands: step.commands,
      preconditions: [],
      postconditions: [],
      evidenceRefs: step.chains.map((chain) => (
        chain.slotObservation.evidence.handle as EvidenceId
      )),
    };
    const batchStartedAt = performance.now();
    const committed = await repository.commit(transaction);
    batchDurationsMs.push(performance.now() - batchStartedAt);
    if (committed.status !== 'committed') {
      throw new Error(`BENCHMARK_BATCH_REJECTED:${JSON.stringify(committed)}`);
    }
    current = { document: committed.document, revision: committed.revision };
  }
  const commitMs = performance.now() - commitStartedAt;
  const snapshotBytes = (await readFile((await snapshotPath(rootDirectory)))).byteLength;
  process.stdout.write(`${JSON.stringify({
    source: sourcePath,
    chainCount: result.chains.length,
    batchCount: steps.length,
    vectorNodeCount: current.document.geometry.length,
    vectorizationMs: round(vectorizationMs),
    firstBatchCommitMs: round(batchDurationsMs[0] ?? 0),
    commitMs: round(commitMs),
    totalMs: round(vectorizationMs + commitMs),
    maxBatchCommitMs: round(Math.max(0, ...batchDurationsMs)),
    snapshotBytes,
  }, null, 2)}\n`);
} finally {
  await provider.close();
  await rm(rootDirectory, { recursive: true, force: true });
}

function persist(
  result: Awaited<ReturnType<PythonVectorizationProvider['vectorize']>>,
): PersistedCleanLineVectorizationResult {
  return {
    ...result,
    chains: result.chains.map((chain) => ({
      ...chain,
      evidence: {
        handle: `evidence_${chain.id}`,
        sourceId: result.sourceId,
        regionId: `vector_${chain.id}`,
        kind: 'polyline-candidate',
        bounds: { ...chain.bounds },
        confidence: chain.pieces[0]?.candidate?.confidence ?? 0.8,
        touchesRegionEdge: false,
        sampleCount: chain.samples.length,
      },
    })),
  };
}

async function snapshotPath(rootDirectory: string): Promise<string> {
  const name = (await readdir(rootDirectory)).find((entry) => entry.endsWith('.json'));
  if (!name) throw new Error('BENCHMARK_SNAPSHOT_MISSING');
  return join(rootDirectory, name);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
