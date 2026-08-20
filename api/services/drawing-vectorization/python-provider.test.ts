import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_VECTORIZATION_TIMEOUT_MS,
  PythonVectorizationProvider,
} from './python-provider.js';

const providers: PythonVectorizationProvider[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map((provider) => provider.close()));
  await Promise.all(directories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('PythonVectorizationProvider', () => {
  it('allows the bounded line vectorizer to run beyond the UI feedback target', () => {
    expect(DEFAULT_VECTORIZATION_TIMEOUT_MS).toBe(120_000);
  });

  it('reuses one healthy process and maps a bounded vectorization response', async () => {
    const fixture = await workerFixture(`
import json, sys
count = 0
for line in sys.stdin:
    request = json.loads(line)
    if request["operation"] == "health":
        value = {"pipelineVersion": "fixture-v1"}
    else:
        count += 1
        value = {
            "sourceId": request["sourceId"], "pipelineVersion": f"fixture-v{count}",
            "width": 100, "height": 80, "analysisScale": 1,
            "medianLineWidthPx": 4, "processCount": count,
            "chains": [{
                "id": "chain_0123456789abcdef0123", "closed": False,
                "samples": [[10, 20], [90, 20]],
                "simplified": [[10, 20], [90, 20]],
                "bounds": [10, 20, 80, 0.5],
                "pieces": [{"id": "piece_0123456789abcdef0123",
                    "sampleRange": [0, 1], "wraps": False, "closed": False,
                    "simplified": [[10, 20], [90, 20]], "bounds": [10, 20, 80, 0.5],
                    "candidate": {"type": "line", "parameters": {
                        "start": [10, 20], "end": [90, 20]},
                        "fitErrorMean": 0, "fitErrorP95": 0, "fitErrorMax": 0,
                        "confidence": 0.99}}],
                "segmentation": {"algorithmVersion": "fixture-v2",
                    "drawingDiagonalPx": 128.062485, "chainLengthPx": 80,
                    "fitTolerancePx": 2, "nearWindowPx": 8, "farWindowPx": 16,
                    "minimumSpanPx": 16, "splitPenalty": 1.5, "decisions": []}
            }]
        }
    print(json.dumps({"id": request["id"], "ok": True, "value": value}), flush=True)
`);
    const provider = await createProvider(fixture);

    const first = await provider.vectorize(request());
    const second = await provider.vectorize(request());

    expect(first).toMatchObject({
      sourceId: 'source_test', width: 100, height: 80,
      chains: [{
        id: 'chain_0123456789abcdef0123',
        bounds: { x: 10, y: 20, width: 80, height: 0.5 },
        pieces: [{ sampleRange: [0, 1], candidate: { type: 'line' } }],
      }],
    });
    expect(first.pipelineVersion).toBe('fixture-v1');
    expect(second.pipelineVersion).toBe('fixture-v2');
  });

  it('rejects overlapping piece ranges', async () => {
    const fixture = await workerFixture(`
import json, sys
for line in sys.stdin:
    request = json.loads(line)
    value = {"pipelineVersion": "fixture"}
    if request["operation"] != "health":
        value = {"sourceId": request["sourceId"], "pipelineVersion": "fixture-v2",
          "width": 100, "height": 80, "analysisScale": 1, "medianLineWidthPx": 4,
          "chains": [{"id": "chain_0123456789abcdef0123", "closed": False,
            "samples": [[0, 0], [50, 0], [100, 0]], "simplified": [[0, 0], [100, 0]],
            "bounds": [0, 0, 100, 0.5],
            "pieces": [
              {"id": "piece_0123456789abcdef0123", "sampleRange": [0, 2], "wraps": False,
               "closed": False, "simplified": [[0, 0], [100, 0]], "bounds": [0, 0, 100, 0.5], "candidate": None},
              {"id": "piece_abcdef0123456789abcd", "sampleRange": [1, 2], "wraps": False,
               "closed": False, "simplified": [[50, 0], [100, 0]], "bounds": [50, 0, 50, 0.5], "candidate": None}],
            "segmentation": {"algorithmVersion": "fixture-v2", "drawingDiagonalPx": 128,
              "chainLengthPx": 100, "fitTolerancePx": 2, "nearWindowPx": 8,
              "farWindowPx": 16, "minimumSpanPx": 16, "splitPenalty": 1.5, "decisions": []}}]}
    print(json.dumps({"id": request["id"], "ok": True, "value": value}), flush=True)
`);
    const provider = await createProvider(fixture);

    await expect(provider.vectorize(request())).rejects.toThrow('PYTHON_VECTORIZATION_CHAIN_INVALID');
  });

  it('rejects a timed out request without echoing media bytes', async () => {
    const fixture = await workerFixture(`
import json, sys, time
for line in sys.stdin:
    request = json.loads(line)
    if request["operation"] == "health":
        print(json.dumps({"id": request["id"], "ok": True, "value": {"pipelineVersion": "fixture"}}), flush=True)
    else:
        time.sleep(1)
`);
    const provider = await createProvider(fixture, 30);

    let error: Error | undefined;
    try {
      await provider.vectorize(request());
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toContain('PYTHON_VECTORIZATION_TIMEOUT');
    expect(error!.message).not.toContain('c2VjcmV0LWltYWdl');
  });

  it('honors AbortSignal while a request is pending', async () => {
    const fixture = await workerFixture(`
import json, sys, time
for line in sys.stdin:
    request = json.loads(line)
    if request["operation"] == "health":
        print(json.dumps({"id": request["id"], "ok": True, "value": {"pipelineVersion": "fixture"}}), flush=True)
    else:
        time.sleep(1)
`);
    const provider = await createProvider(fixture, 2_000);
    const controller = new AbortController();
    const pending = provider.vectorize(request(controller.signal));
    controller.abort(new Error('cancelled by test'));

    await expect(pending).rejects.toThrow('cancelled by test');
  });

  it('rejects pending work when the worker exits', async () => {
    const fixture = await workerFixture(`
import json, os, sys
for line in sys.stdin:
    request = json.loads(line)
    if request["operation"] == "health":
        print(json.dumps({"id": request["id"], "ok": True, "value": {"pipelineVersion": "fixture"}}), flush=True)
    else:
        os._exit(7)
`);
    const provider = await createProvider(fixture, 2_000);

    await expect(provider.vectorize(request())).rejects.toThrow('PYTHON_VECTORIZATION_EXITED');
  });
});

async function workerFixture(body: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'vectorai-python-provider-'));
  directories.push(directory);
  const path = join(directory, 'worker.py');
  await writeFile(path, body);
  return path;
}

async function createProvider(scriptPath: string, timeoutMs = 500) {
  const provider = await PythonVectorizationProvider.create({
    pythonPath: process.env.PYTHON || 'python3',
    scriptPath,
    timeoutMs,
  });
  providers.push(provider);
  return provider;
}

function request(signal = new AbortController().signal) {
  return {
    source: {
      sourceId: 'source_test', mimeType: 'image/png',
      bytes: Uint8Array.from(Buffer.from('secret-image')),
      width: 100, height: 80,
    },
    maxPixels: 100_000,
    signal,
  };
}
