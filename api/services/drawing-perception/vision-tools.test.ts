import { describe, expect, it, vi } from 'vitest';

import {
  DrawingVisionOutputError,
  DrawingVisionTools,
  type DrawingVisionCompletion,
  type DrawingVisionToolInput,
} from './vision-tools.js';

const input: DrawingVisionToolInput = {
  runId: 'run_1',
  page: 1,
  modelName: 'doubao-seed-2.0-lite',
  image: 'aW1hZ2U=',
  mimeType: 'image/png',
  signal: new AbortController().signal,
  deadlineAt: Date.now() + 60_000,
};

describe('DrawingVisionTools', () => {
  it('establishes whole-view contour identity before regional detail reads', async () => {
    const tools = new DrawingVisionTools(async () => JSON.stringify({ contours: [{
      id: 'contour_outer', viewId: 'view_1', geometryFamily: 'circle',
      imageBounds: [0.1, 0.1, 0.8, 0.8], closed: true, confidence: 0.94,
      coarseParams: { center: [0.5, 0.5], radius: 0.4 },
    }] }));

    await expect(tools.detectGlobalContours({ ...input, viewId: 'view_1' })).resolves.toEqual([{
      id: 'contour_outer', viewId: 'view_1', geometryFamily: 'circle',
      imageBounds: [0.1, 0.1, 0.8, 0.8], closed: true, confidence: 0.94,
      coarseParams: { center: [0.5, 0.5], radius: 0.4 },
    }]);
  });

  it('rejects global contours with unsupported families or invalid whole-view bounds', async () => {
    const tools = new DrawingVisionTools(async () => JSON.stringify({ contours: [{
      id: 'contour_bad', viewId: 'view_1', geometryFamily: 'hatch',
      imageBounds: [0.8, 0.8, 0.4, 0.4], closed: true, confidence: 0.9,
    }] }));

    await expect(tools.detectGlobalContours({ ...input, viewId: 'view_1' }))
      .rejects.toBeInstanceOf(DrawingVisionOutputError);
  });

  it('extracts regional samples as evidence for an existing global contour', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async () => JSON.stringify({ evidence: [{
      id: 'evidence_outer_left', viewId: 'view_1_region_1',
      globalContourId: 'contour_outer', imageBounds: [0.8, 0.1, 0.2, 0.8],
      samplePoints: [[0.8, 0.1], [0.95, 0.5], [0.8, 0.9]],
      confidence: 0.9, touchesCropEdge: true,
    }] }));
    const tools = new DrawingVisionTools(complete);

    const evidence = await tools.detectContourEvidence(
      { ...input, viewId: 'view_1_region_1' },
      [{ id: 'contour_outer', geometryFamily: 'circle', imageBounds: [0.1, 0.1, 0.8, 0.8] }],
    );

    expect(evidence).toEqual([expect.objectContaining({
      id: 'evidence_outer_left', globalContourId: 'contour_outer', touchesCropEdge: true,
    })]);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'detect_contour_evidence',
      userPrompt: expect.stringContaining('contour_outer'),
    }));
  });

  it('restricts regional geometry reads to complete standalone entities', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async () => JSON.stringify({ observations: [] }));
    const tools = new DrawingVisionTools(complete);

    await tools.detectGeometry({ ...input, viewId: 'view_1_region_1' }, {
      mode: 'regional_standalone',
      globalContours: [{
        id: 'contour_outer', geometryFamily: 'circle', imageBounds: [0, 0.1, 1, 0.8],
      }],
    });

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'detect_geometry',
      userPrompt: expect.stringContaining('裁剪边缘结束'),
    }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      userPrompt: expect.stringContaining('contour_outer'),
    }));
  });

  it('reads standalone geometry and global contour evidence in one regional image request', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async () => JSON.stringify({
      observations: [{
        id: 'small_hole', viewId: 'view_1_region_1', type: 'circle',
        imageBounds: [0.2, 0.2, 0.1, 0.1],
        measuredParams: { center: [0.25, 0.25], radius: 0.05 }, confidence: 0.9,
      }],
      evidence: [{
        id: 'outer_fragment', viewId: 'view_1_region_1', globalContourId: 'outer',
        imageBounds: [0, 0.1, 0.2, 0.8], samplePoints: [[0, 0.1], [0.1, 0.5]],
        confidence: 0.88, touchesCropEdge: true,
      }],
    }));
    const tools = new DrawingVisionTools(complete);

    const result = await tools.detectRegionalGeometry(
      { ...input, viewId: 'view_1_region_1' },
      [{ id: 'outer', geometryFamily: 'circle', imageBounds: [0, 0.1, 0.2, 0.8] }],
    );

    expect(result.geometry).toHaveLength(1);
    expect(result.evidence).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'detect_regional_geometry',
      userPrompt: expect.stringContaining('outer'),
    }));
  });

  it('assesses whether a crop was fully read using a bounded observation summary', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async () => JSON.stringify({
      complete: false,
      confidence: 0.82,
      unreadBounds: [[0.6, 0.2, 0.3, 0.4]],
      reasons: ['右侧轮廓仍未参数化'],
    }));
    const tools = new DrawingVisionTools(complete);

    await expect(tools.assessCoverage({ ...input, viewId: 'view_1_region_1' }, {
      globalContours: [{
        id: 'contour_1', geometryFamily: 'line', imageBounds: [0.1, 0.1, 0.8, 0.01],
      }],
      contourEvidence: [{ globalContourId: 'contour_1', imageBounds: [0.1, 0.1, 0.4, 0.01] }],
      standaloneGeometry: [],
      annotations: [{ kind: 'linear', imageBounds: [0.2, 0.2, 0.1, 0.05] }],
    })).resolves.toEqual({
      complete: false,
      confidence: 0.82,
      unreadBounds: [[0.6, 0.2, 0.3, 0.4]],
      reasons: ['右侧轮廓仍未参数化'],
    });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'assess_coverage',
      userPrompt: expect.stringContaining('"contour_1"'),
    }));
  });

  it.each([
    { complete: 'yes', confidence: 0.8, unreadBounds: [], reasons: [] },
    { complete: true, confidence: 1.2, unreadBounds: [], reasons: [] },
    { complete: false, confidence: 0.8, unreadBounds: [[0.9, 0.9, 0.2, 0.2]], reasons: [] },
    { complete: false, confidence: 0.8, unreadBounds: [], reasons: [1] },
  ])('rejects an invalid coverage assessment %#', async (response) => {
    const tools = new DrawingVisionTools(async () => JSON.stringify(response));

    await expect(tools.assessCoverage({ ...input, viewId: 'view_1_region_1' }, {
      globalContours: [], contourEvidence: [], standaloneGeometry: [], annotations: [],
    })).rejects.toBeInstanceOf(DrawingVisionOutputError);
  });

  it('parses fenced sheet JSON and explicitly forwards model, media, and signal', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async () => `\`\`\`json
      {"unit":"mm","scale":2,"warnings":["title block unclear"]}
    \`\`\``);
    const tools = new DrawingVisionTools(complete);

    await expect(tools.analyzeSheet(input)).resolves.toEqual({
      unit: 'mm', scale: 2, warnings: ['title block unclear'],
    });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      modelName: 'doubao-seed-2.0-lite', image: 'aW1hZ2U=', mimeType: 'image/png',
      signal: input.signal,
      tool: 'analyze_sheet',
    }));
  });

  it('validates segmented views and geometry observations from recorded responses', async () => {
    const responses = [
      JSON.stringify({ views: [{
        id: 'view_1', kind: 'primary', imageBounds: [0.1, 0.1, 0.8, 0.7], confidence: 0.94,
      }] }),
      JSON.stringify({ observations: [{
        id: 'obs_geom_view_1_0001', viewId: 'view_1', type: 'circle',
        imageBounds: [0.2, 0.2, 0.2, 0.2], measuredParams: { center: [0.3, 0.3], radius: 0.1 },
        confidence: 0.9,
      }] }),
    ];
    const tools = new DrawingVisionTools(async () => responses.shift()!);

    expect(await tools.segmentViews(input)).toHaveLength(1);
    expect(await tools.detectGeometry({ ...input, viewId: 'view_1' })).toHaveLength(1);
  });

  it('preserves OCR engineering symbols and parsed tolerance', async () => {
    const tools = new DrawingVisionTools(async () => JSON.stringify({ annotations: [{
      id: 'obs_ann_view_1_0001', viewId: 'view_1', kind: 'diameter',
      rawText: 'Ø10 ±0.1 45° R5', value: 10, unit: 'mm',
      tolerance: { upper: 0.1, lower: -0.1 }, imageBounds: [0.1, 0.1, 0.3, 0.1],
      arrowheads: [[0.1, 0.15], [0.4, 0.15]], confidence: 0.86,
    }] }));

    const annotations = await tools.extractAnnotations({ ...input, viewId: 'view_1' });
    expect(annotations[0]).toMatchObject({
      rawText: 'Ø10 ±0.1 45° R5', tolerance: { upper: 0.1, lower: -0.1 },
    });
  });

  it('expands the observation contracts instead of referring to undeclared type names', async () => {
    const complete = vi.fn<DrawingVisionCompletion>(async ({ tool }) => tool === 'extract_annotations'
      ? '{"annotations":[]}'
      : '{"observations":[]}');
    const tools = new DrawingVisionTools(complete);

    await tools.detectGeometry({ ...input, viewId: 'view_1' });
    await tools.extractAnnotations({ ...input, viewId: 'view_1' });

    const prompts = complete.mock.calls.map(([call]) => call.userPrompt).join('\n');
    expect(prompts).toContain('"id"');
    expect(prompts).toContain('"viewId"');
    expect(prompts).toContain('"imageBounds"');
    expect(prompts).toContain('"measuredParams"');
    expect(prompts).toContain('"rawText"');
    expect(prompts).not.toContain('[GeometryObservation]');
    expect(prompts).not.toContain('[AnnotationObservation]');
  });

  it('reports only received field names when an observation uses the wrong shape', async () => {
    const tools = new DrawingVisionTools(async () => JSON.stringify({ observations: [{
      name: 'axis-1', geometry: { from: [0, 0], to: [1, 1] }, certainty: 0.9,
    }] }));

    const error = await tools.detectDatums({ ...input, viewId: 'view_1' })
      .catch((caught) => caught) as DrawingVisionOutputError;

    expect(error.errors).toContain('observations[0]: received fields [certainty, geometry, name]');
    expect(error.errors.join(' ')).not.toContain('axis-1');
  });

  it.each([
    ['unsupported CAD type', JSON.stringify({ observations: [{
      id: 'obs_1', viewId: 'view_1', type: 'hatch', imageBounds: [0, 0, 0.2, 0.2],
      measuredParams: {}, confidence: 0.8,
    }] })],
    ['media field', JSON.stringify({ observations: [{
      id: 'obs_1', viewId: 'view_1', type: 'line', imageBounds: [0, 0, 0.2, 0.2],
      measuredParams: { image: 'bytes' }, confidence: 0.8,
    }] })],
    ['malformed JSON', '{not-json'],
  ])('returns structured correction errors for %s', async (_name, response) => {
    const tools = new DrawingVisionTools(async () => response);

    const error = await tools.detectGeometry({ ...input, viewId: 'view_1' })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(DrawingVisionOutputError);
    expect(error.errors.length).toBeGreaterThan(0);
  });

  it('rejects an expired deadline before calling the model', async () => {
    const complete = vi.fn<DrawingVisionCompletion>();
    const tools = new DrawingVisionTools(complete, () => 10_000);

    await expect(tools.detectDatums({ ...input, deadlineAt: 9_999, viewId: 'view_1' }))
      .rejects.toThrow(/deadline/);
    expect(complete).not.toHaveBeenCalled();
  });
});
