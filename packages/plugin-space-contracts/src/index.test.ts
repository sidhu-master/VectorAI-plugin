// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type AnnotationId, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  allocateAxialDimensionLanes,
  drawingRefSchema,
  drawingDocumentSchema,
  drawingGroundingOverlaySchema,
  drawingQueryRequestSchema,
  drawingQueryResultSchema,
  finalizePreviewRequestSchema,
  drawingPreviewCreateRequestSchema,
  drawingPreviewSchema,
  drawingSelectionProjectionRequestSchema,
  drawingSelectionProjectionResultSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceCommitResultSchema,
  drawingWorkspaceSnapshotSchema,
  drawingMotionRigProjectionSchema,
  drawingMotionRigRebuildRequestSchema,
  drawingMotionRigResultSchema,
  drawingMotionRigDiscardRequestSchema,
  drawingMotionRigDiscardResultSchema,
  extensionPreviewCreateRequestSchema,
  extensionPreviewCreateResultSchema,
  extensionPreviewControlRequestSchema,
  annotationSessionStateSchema,
  drawingDxfImportRequestSchema,
  drawingObservationRequestSchema,
  drawingObservationResultSchema,
  partitionSessionSnapshotSchema,
  partitionDraftSchema,
  partitionEditCommandSchema,
  partitionDocumentSupplementRequestSchema,
  partitionImportRequestSchema,
  engineeringAnnotationDraftSchema,
  dimensionPlanSessionSnapshotSchema,
  dimensionSchemeEditCommandSchema,
  toleranceCatalogRequestSchema,
  toleranceCatalogResultSchema,
  toleranceEditCommandSchema,
  tolerancePreviewRequestSchema,
  tolerancePreviewResultSchema,
} from './index';

function axialScheme() {
  const drawingRef = { drawingId: 'drawing-1', revision: 1 };
  const station = (id: string, coordinate: number) => ({
    id, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
    kinds: ['shoulder' as const], geometryNodeIds: [`geometry:${id}`], evidenceIds: [],
  });
  return {
    version: 1 as const,
    drawingRef,
    policy: { id: 'shaft-hierarchical-dimensioning-v1' as const, version: '1' as const },
    inputDigest: 'sha256:scheme',
    topology: {
      drawingRef,
      axis: { origin: [0, 0] as [number, number], direction: [1, 0] as [number, number], normal: [0, 1] as [number, number], zMin: 0, zMax: 20, orientation: 'forward' as const },
      unit: 'mm' as const,
      stations: [station('s0', 0), station('s1', 10), station('s2', 20)],
      elementarySpans: [
        { id: 'span:a', startStationId: 's0', endStationId: 's1', nominalValue: 10, segmentIds: [], evidenceIds: [] },
        { id: 'span:b', startStationId: 's1', endStationId: 's2', nominalValue: 10, segmentIds: [], evidenceIds: [] },
      ],
    },
    evidence: [],
    candidates: [
      { id: 'candidate:overall', startStationId: 's0', endStationId: 's2', nominalValue: 20, roles: ['overall' as const], evidenceIds: [], required: true },
      { id: 'candidate:a', startStationId: 's0', endStationId: 's1', nominalValue: 10, roles: ['local' as const], evidenceIds: [], required: false },
      { id: 'candidate:b', startStationId: 's1', endStationId: 's2', nominalValue: 10, roles: ['closure' as const], evidenceIds: [], required: false },
    ],
    displayedCandidateIds: ['candidate:overall', 'candidate:a'], closureCandidateIds: ['candidate:b'],
    chains: [{ id: 'chain:overall', parentCandidateId: 'candidate:overall', childCandidateIds: ['candidate:a'], closureCandidateId: 'candidate:b', alternativeClosureCandidateIds: [], status: 'resolved' as const }],
    layout: { chainNormalOffsets: [], candidateNormalOffsets: [{ candidateId: 'candidate:a', normalOffset: 12.5 }] },
    decisions: [], diagnostics: [], status: 'resolved' as const,
  };
}

function snapshot() {
  return {
    version: 1 as const,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document: createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 }),
    source: {
      id: 'attachment-1',
      mediaType: 'image/png',
      bytes: 4,
      width: 120,
      height: 80,
      name: 'drawing.png',
    },
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    provisional: true,
  };
}

describe('DSH drawing workspace wire schemas', () => {
  it('allocates axial dimensions from short/inner to long/outer while packing equal spans', () => {
    const lanes = allocateAxialDimensionLanes([
      { id: 'long', span: 100, occupiedStart: 0, occupiedEnd: 100 },
      { id: 'short-left', span: 10, occupiedStart: 0, occupiedEnd: 10 },
      { id: 'short-right', span: 10, occupiedStart: 20, occupiedEnd: 30 },
      { id: 'short-overlap', span: 10, occupiedStart: 5, occupiedEnd: 15 },
    ]);

    expect(lanes.get('short-left')).toBe(0);
    expect(lanes.get('short-right')).toBe(0);
    expect(lanes.get('short-overlap')).toBe(1);
    expect(lanes.get('long')).toBe(2);
  });

  it('accepts a revision-bound functional partition rename', () => {
    const command = {
      type: 'semantic-group.rename',
      expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
      groupId: 'group:gear',
      name: '精加工齿轮段',
    };

    expect(partitionEditCommandSchema.parse(command)).toEqual(command);
  });

  it('accepts ordered immutable engineering document inputs', () => {
    const request = {
      dxf: { name: 'shaft.dxf', digest: `sha256:${'a'.repeat(64)}`, base64: 'WA==' },
      engineeringDocuments: [
        { name: 'limits.pdf', digest: `sha256:${'b'.repeat(64)}`, mediaType: 'application/pdf', base64: 'WA==' },
        { name: 'notes.txt', digest: `sha256:${'c'.repeat(64)}`, base64: 'WA==' },
      ],
    };
    expect(partitionImportRequestSchema.parse(request)).toEqual(request);
  });

  it('retains the legacy single text document input during migration', () => {
    const request = {
      dxf: { name: 'shaft.dxf', digest: `sha256:${'a'.repeat(64)}`, base64: 'WA==' },
      engineeringDocument: { name: 'notes.txt', text: '轴段' },
    };
    expect(partitionImportRequestSchema.parse(request)).toEqual(request);
  });

  it('accepts revision-bound documents that supplement an existing partition drawing', () => {
    const request = {
      expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
      engineeringDocuments: [
        { name: 'limits.pdf', digest: `sha256:${'b'.repeat(64)}`, mediaType: 'application/pdf', base64: 'WA==' },
      ],
    };
    expect(partitionDocumentSupplementRequestSchema.parse(request)).toEqual(request);
  });

  it('strictly carries revision-bound engineering annotation drafts', () => {
    const draft = {
      version: 1 as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      datums: [],
      intents: [],
      tolerances: [],
      fitAssignments: [],
      geometricTolerances: [],
      chains: [],
      dependencies: [],
      diagnostics: [],
    };
    expect(engineeringAnnotationDraftSchema.parse(draft)).toEqual(draft);
    expect(() => engineeringAnnotationDraftSchema.parse({ ...draft, formulaSource: 'return 0.1' })).toThrow();
    expect(() => engineeringAnnotationDraftSchema.parse({
      ...draft,
      chains: [{
        id: 'chain-1', drawingRef: draft.drawingRef, datumIds: [],
        members: [{ dimensionIntentId: 'intent-1', coefficient: 0, role: 'component' }],
        equation: { closureIntentId: 'intent-1' }, analysisMode: 'worst-case',
        status: 'candidate', evidenceIds: [], diagnostics: [],
      }],
    })).toThrow();
  });

  it('round-trips a standard-backed tolerance and paired fit', () => {
    const legacyDraft = {
      version: 1 as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      datums: [], intents: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
    };
    const parsed = engineeringAnnotationDraftSchema.parse({
      ...legacyDraft,
      tolerances: [{
        id: 'tol-1', dimensionIntentId: 'intent-1', mode: 'fit', source: 'manual',
        featureClass: 'external',
        selection: { designation: 'u6', source: 'manual', evidenceRefs: ['manual:tol-1'] },
        standardRef: { id: 'GB/T 1800', edition: '2020' },
        displayPreference: 'both',
        inputs: {}, resolved: { upperDeviation: .044, lowerDeviation: .033, inputDigest: 'sha256:x', evaluatedAt: 1 },
        status: 'resolved', evidenceIds: ['manual:tol-1'], diagnostics: [],
      }],
      fitAssignments: [{
        fitGroupId: 'fit-1', holeDimensionId: 'intent-hole', shaftDimensionId: 'intent-shaft', basis: 'hole',
        designation: 'H7/g6', fitType: 'clearance', minimumClearance: .01, maximumClearance: .04,
        standardRef: { id: 'GB/T 1800', edition: '2020' },
      }],
    });
    expect(parsed.tolerances[0]?.selection?.designation).toBe('u6');
    expect(parsed.fitAssignments[0]?.designation).toBe('H7/g6');
  });

  it('defaults fitAssignments for existing persisted version-1 drafts', () => {
    expect(engineeringAnnotationDraftSchema.parse({
      version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 },
      datums: [], intents: [], tolerances: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
    }).fitAssignments).toEqual([]);
  });

  it('strictly round-trips catalog and preview envelopes with dataset completeness', () => {
    const request = {
      expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
      dimensionIntentId: 'intent-1', featureClass: 'external',
    } as const;
    expect(toleranceCatalogRequestSchema.parse(request)).toEqual(request);
    const catalog = {
      drawingRef: request.expectedDrawingRef,
      dimensionIntentId: request.dimensionIntentId,
      featureClass: request.featureClass,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      datasetMetadata: {
        completeness: 'partial', catalogClassification: 'unverified',
        numericProvenance: [{ kind: 'plan-reference-vector', referenceId: 'plan', description: 'Partial dataset' }],
      },
      bands: [{ designation: 'u6', featureClass: 'external', category: 'unknown', available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' }],
      selection: {
        designation: 'u6', source: 'manual', evidenceRefs: ['manual:u6'], displayPreference: 'both',
        override: { upperDeviation: .05, lowerDeviation: .04 },
      },
    } as const;
    expect(toleranceCatalogResultSchema.parse(catalog)).toEqual(catalog);

    const previewRequest = {
      type: 'single', expectedDrawingRef: request.expectedDrawingRef, dimensionIntentId: 'intent-1',
      featureClass: 'external', designation: 'u6',
    } as const;
    expect(tolerancePreviewRequestSchema.parse(previewRequest)).toEqual(previewRequest);
    expect(tolerancePreviewRequestSchema.parse({
      type: 'fit', expectedDrawingRef: request.expectedDrawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    })).toMatchObject({ type: 'fit', designation: 'H7/g6' });
    expect(tolerancePreviewResultSchema.parse({
      type: 'single', drawingRef: request.expectedDrawingRef, dimensionIntentId: 'intent-1', status: 'resolved',
      result: {
        designation: 'u6', featureClass: 'external', basicSize: 20, unit: 'mm', upperDeviation: .044, lowerDeviation: .033,
        toleranceMagnitude: .011,
        upperLimitSize: 20.044, lowerLimitSize: 20.033, standardRef: catalog.standardRef,
        ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:x' },
      },
    })).toMatchObject({ status: 'resolved', result: { designation: 'u6' } });
  });

  it('strictly accepts valid tolerance edits and rejects incomplete manual deviations', () => {
    const manual = {
      type: 'manual.apply', expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
      dimensionIntentId: 'intent-1', mode: 'unilateral', upperDeviation: .02, evidenceRefs: [],
    } as const;
    expect(toleranceEditCommandSchema.parse(manual)).toMatchObject({ ...manual, displayPreference: 'deviations' });
    expect(() => toleranceEditCommandSchema.parse({ ...manual, mode: 'bilateral' })).toThrow();
    expect(() => toleranceEditCommandSchema.parse({ ...manual, upperDeviation: undefined })).toThrow();
    expect(() => toleranceEditCommandSchema.parse({
      type: 'standard.single.apply', expectedDrawingRef: manual.expectedDrawingRef, dimensionIntentId: 'intent-1',
      featureClass: 'external', designation: 'u6', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [], extra: true,
    })).toThrow();
    expect(toleranceEditCommandSchema.parse({
      type: 'standard.fit.apply', expectedDrawingRef: manual.expectedDrawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole', designation: 'H7/g6',
      selectionSource: 'rule', displayPreference: 'designation', evidenceRefs: [],
    })).toMatchObject({ type: 'standard.fit.apply' });
    expect(toleranceEditCommandSchema.parse({
      type: 'standard.override.set', expectedDrawingRef: manual.expectedDrawingRef,
      dimensionIntentId: 'intent-1', upperDeviation: .02, lowerDeviation: -.01,
    })).toMatchObject({ type: 'standard.override.set' });
    expect(toleranceEditCommandSchema.parse({
      type: 'standard.override.clear', expectedDrawingRef: manual.expectedDrawingRef, dimensionIntentId: 'intent-1',
    })).toMatchObject({ type: 'standard.override.clear' });
  });

  it('strictly carries durable dimension-plan session snapshots', () => {
    const snapshot = {
      version: 1 as const,
      phase: 'editing' as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      draft: {
        version: 1 as const,
        drawingRef: { drawingId: 'drawing-1', revision: 1 },
        datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
      },
      canUndo: true,
      canRedo: false,
      updatedAt: 7,
    };
    expect(dimensionPlanSessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() => dimensionPlanSessionSnapshotSchema.parse({ ...snapshot, formulaSource: 'return 0.1' })).toThrow();
    expect(() => dimensionPlanSessionSnapshotSchema.parse({ ...snapshot, updatedAt: Number.NaN })).toThrow();
  });

  it('round-trips a dimension plan with an axial inference scheme', () => {
    const value = {
      version: 1 as const, phase: 'editing' as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      draft: {
        version: 1 as const, drawingRef: { drawingId: 'drawing-1', revision: 1 },
        datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
        axialScheme: axialScheme(),
      },
      canUndo: true, canRedo: false, updatedAt: 7,
    };
    expect(dimensionPlanSessionSnapshotSchema.parse(value)).toEqual(value);
  });

  it('rejects model-supplied coordinates in a scheme edit', () => {
    const command = {
      type: 'candidate.display', candidateId: 'candidate:a', displayed: true, coordinate: 10,
      expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
    };
    expect(() => dimensionSchemeEditCommandSchema.parse(command)).toThrow();
  });

  it('accepts a finite manual normal offset for one dimension chain', () => {
    const command = {
      type: 'chain.layout', chainId: 'chain:overall', normalOffset: 12.5,
      expectedDrawingRef: { drawingId: 'drawing-1', revision: 1 },
    } as const;
    expect(dimensionSchemeEditCommandSchema.parse(command)).toEqual(command);
    expect(() => dimensionSchemeEditCommandSchema.parse({ ...command, normalOffset: Number.NaN })).toThrow();
  });

  it('round-trips portable tolerance and datum projections strictly', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-tolerance' }, now: () => 1 });
    document.annotations = [{
      id: 'dimension-1' as AnnotationId,
      type: 'dimension',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'linear',
      associationStatus: 'resolved',
      targets: [{ geometryId: 'line-1' as GeometryId, anchor: { kind: 'start' } }],
      computedValue: 20,
      unit: 'mm',
      toleranceProjection: {
        mode: 'fit', fitDesignation: 'H7', unit: 'mm', status: 'confirmed',
        source: 'standard', ruleRef: { id: 'iso-fit', version: '1', inputDigest: 'sha256:abc' },
        evidenceRefs: ['evidence:fit'],
      },
      datumReferences: [{
        datumId: 'datum-a', role: 'primary', geometryId: 'line-1' as GeometryId, anchor: { kind: 'start' },
      }],
      engineeringIntentId: 'intent-1',
      engineeringChainIds: ['chain-1'],
      generationOrder: 2,
      textPosition: [10, 5],
      definitionPoints: [[0, 0], [20, 0]],
    }];
    expect(drawingDocumentSchema.parse(document).annotations[0]).toMatchObject({
      engineeringIntentId: 'intent-1',
      toleranceProjection: { mode: 'fit', fitDesignation: 'H7' },
    });
    const invalid = structuredClone(document);
    (invalid.annotations[0] as { toleranceProjection?: { upperLimit?: number } }).toleranceProjection = {
      ...(invalid.annotations[0] as { toleranceProjection: object }).toleranceProjection,
      upperLimit: Number.POSITIVE_INFINITY,
    };
    expect(() => drawingDocumentSchema.parse(invalid)).toThrow();
  });

  it('round-trips a parametric DXF hatch without flattening it into display segments', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-hatch' }, now: () => 1 });
    document.annotations = [{
      id: 'hatch-1' as AnnotationId,
      type: 'section-hatch',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      pattern: 'ANSI31',
      angle: 45,
      spacing: 3.175,
      hatch: {
        version: 1,
        style: 'normal',
        elevation: 0,
        extrusion: [0, 0, 1],
        boundaryPaths: [{
          flags: 3,
          closed: true,
          edges: [
            { type: 'line', start: [0, 0], end: [20, 0] },
            { type: 'arc', center: [20, 5], radius: 5, startAngle: -90, endAngle: 90, counterClockwise: true },
            { type: 'line', start: [20, 10], end: [0, 10] },
            { type: 'line', start: [0, 10], end: [0, 0] },
          ],
        }],
        patternLines: [{
          angle: 45,
          base: [0, 0],
          offset: [-2.245064, 2.245064],
          dashLengths: [],
        }],
        patternAngle: 0,
        patternScale: 1,
        double: false,
      },
    }];

    const parsed = drawingDocumentSchema.parse(document);
    expect(parsed.annotations[0]).toEqual(document.annotations[0]);
    expect(parsed.annotations[0]).not.toHaveProperty('segments');
  });

  it('rejects a section hatch that has neither original semantics nor legacy segments', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-hatch' }, now: () => 1 });
    document.annotations = [{
      id: 'hatch-1' as AnnotationId,
      type: 'section-hatch',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      pattern: 'ANSI31',
      angle: 45,
      spacing: 3.175,
    } as never];

    expect(() => drawingDocumentSchema.parse(document)).toThrow();
  });

  it('strictly carries revision-bound partition state and edits', () => {
    const ref = { drawingId: 'drawing-1', revision: 1 };
    const command = { type: 'boundary.move', expectedDrawingRef: ref, boundaryIndex: 1, requestedZ: 12, snapTolerance: 0.5 };
    expect(partitionEditCommandSchema.parse(command)).toEqual(command);
    expect(partitionSessionSnapshotSchema.parse({
      version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 1,
    })).toMatchObject({ phase: 'idle' });
    expect(() => partitionEditCommandSchema.parse({ ...command, geometryCommand: 'move' })).toThrow();
    expect(partitionEditCommandSchema.parse({
      type: 'semantic-range.move', expectedDrawingRef: ref, groupId: 'group:G01', edge: 'start', requestedZ: 63.5, snapTolerance: 0.5,
    })).toMatchObject({ type: 'semantic-range.move', groupId: 'group:G01', edge: 'start' });
  });

  it('carries an optional dimension role on semantic partition groups', () => {
    const ref = { drawingId: 'drawing-1', revision: 1 };
    const draft = {
      version: 1 as const, drawingRef: ref,
      axis: { origin: [0, 0] as [number, number], direction: [1, 0] as [number, number], normal: [0, 1] as [number, number], zMin: 0, zMax: 10, orientation: 'forward' as const },
      segments: [{
        id: 'segment:0-10', zStart: 0, zEnd: 10,
        profile: { minRadius: 5, maxRadius: 5, sampleCount: 2 },
        semanticType: 'shoulder', boundaryConfidence: 1,
        geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
      }],
      semanticGroups: [{
        id: 'group:shoulder', segmentIds: ['segment:0-10'], range: { zStart: 0, zEnd: 10 },
        semanticType: 'shoulder', dimensionRole: 'process-datum', evidenceIds: [],
      }],
      stepCandidates: [], evidence: [], diagnostics: [],
    };

    expect(partitionDraftSchema.parse(draft).semanticGroups[0]?.dimensionRole).toBe('process-datum');
  });

  it('bounds extension DXF import and local observation requests without geometry commands', () => {
    const bytes = new Uint8Array([48, 10]);
    expect(drawingDxfImportRequestSchema.parse({
      bytes,
      digest: 'sha256:abc',
      name: 'shaft.dxf',
    })).toMatchObject({ bytes, digest: 'sha256:abc' });

    const request = {
      ref: { drawingId: 'drawing-1', revision: 1 },
      overlays: [{ id: 'segment:1', label: 'S1', polygon: [[0, 0], [2, 0], [2, 1]] }],
    };
    expect(drawingObservationRequestSchema.parse(request)).toEqual(request);
    expect(drawingObservationResultSchema.parse({
      status: 'rendered',
      png: bytes,
      contentDigest: 'sha256:image',
      width: 960,
      height: 720,
    })).toMatchObject({ status: 'rendered', contentDigest: 'sha256:image' });
    expect(() => drawingObservationRequestSchema.parse({
      ...request,
      overlays: [{ ...request.overlays[0], polygon: [[0, 0], [1, 1]] }],
    })).toThrow();
  });

  it('preserves DXF file, layer, and entity provenance through the strict document schema', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-dxf' }, now: () => 1 });
    document.sources = [{
      id: 'source:dxf',
      kind: 'dxf',
      mediaType: 'application/dxf',
      digest: 'sha256:abc',
      name: 'shaft.dxf',
      bytes: 123,
    }];
    document.geometry.push({
      id: 'line:10' as GeometryId,
      type: 'line',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      sourceRef: {
        sourceId: 'source:dxf',
        objectId: '10',
        objectType: 'LINE',
        layer: '1轮廓实线层',
      },
      start: [0, 0],
      end: [1, 0],
    });

    expect(drawingDocumentSchema.parse(document)).toEqual(document);
  });

  it('accepts a DXF workspace source without raster dimensions', () => {
    const value = {
      ...snapshot(),
      source: {
        id: 'source:dxf',
        mediaType: 'application/dxf',
        bytes: 123,
        name: 'shaft.dxf',
      },
    };

    expect(drawingWorkspaceSnapshotSchema.parse(value)?.source).toEqual(value.source);
  });

  it('re-exports strict provider-neutral semantic edit contracts', () => {
    const ref = { drawingId: 'drawing-1', revision: 3 };
    const request = {
      previewHandle: 'preview-1',
      previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1',
      finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    };

    expect(drawingRefSchema.parse(ref)).toEqual(ref);
    expect(finalizePreviewRequestSchema.parse(request)).toEqual(request);
    expect(() => finalizePreviewRequestSchema.parse({ ...request, approved: true })).toThrow();
  });

  it('accepts a complete Drawing snapshot without embedding raster bytes', () => {
    const parsed = drawingWorkspaceSnapshotSchema.parse(snapshot());

    expect(parsed?.document.protocol).toBe('VectorAI-Drawing');
    expect(parsed?.source).toMatchObject({ id: 'attachment-1', bytes: 4 });
    expect(parsed?.source).not.toHaveProperty('dataUrl');
  });

  it('strictly projects a bounded client selection without granting write authority', () => {
    const request = {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      nodeIds: ['right-hand'],
    };
    const result = {
      status: 'projected' as const,
      projection: {
        selectionProjectionId: 'selection-1',
        drawingRef: request.expectedRef,
        nodeIds: request.nodeIds,
        projectionDigest: 'sha256:selection',
        expiresAt: 1234,
      },
    };

    expect(drawingSelectionProjectionRequestSchema.parse(request)).toEqual(request);
    expect(drawingSelectionProjectionResultSchema.parse(result)).toEqual(result);
    expect(drawingSelectionProjectionRequestSchema.parse({ ...request, nodeIds: [] }).nodeIds).toEqual([]);
    expect(drawingSelectionProjectionResultSchema.parse({ status: 'cleared' })).toEqual({ status: 'cleared' });
    expect(() => drawingSelectionProjectionRequestSchema.parse({ ...request, writable: true })).toThrow();
  });

  it('validates revision-bound transient grounding overlays without write authority', () => {
    const overlay = {
      version: 1 as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      taskId: 'task-1',
      stateEpoch: 4,
      disposition: 'active' as const,
      groups: [{
        groundingId: 'ground-left',
        partKey: 'part-left',
        label: 'Part Left',
        role: 'target' as const,
        colorIndex: 0,
        nodeIds: ['carrier-left'],
        interfaces: [{
          interfaceId: 'connector-left:end',
          nodeId: 'connector-left',
          endpoint: 'end' as const,
        }],
      }, {
        groundingId: 'ground-right',
        partKey: 'part-right',
        label: 'Part Right',
        role: 'reference' as const,
        colorIndex: 1,
        nodeIds: ['carrier-right'],
        interfaces: [],
      }],
    };

    expect(drawingGroundingOverlaySchema.parse(overlay)).toEqual(overlay);
    expect(() => drawingGroundingOverlaySchema.parse({ ...overlay, writable: true })).toThrow();
    expect(() => drawingGroundingOverlaySchema.parse({
      ...overlay,
      groups: [overlay.groups[0], { ...overlay.groups[1], partKey: 'part-left' }],
    })).toThrow();
    expect(() => drawingGroundingOverlaySchema.parse({
      ...overlay,
      groups: [{ ...overlay.groups[0], endpoint: 'middle' }],
    })).toThrow();
    expect(drawingGroundingOverlaySchema.parse({
      ...overlay,
      stateEpoch: 5,
      disposition: 'committed',
      groups: [],
    })).toMatchObject({ disposition: 'committed', groups: [] });
    expect(() => drawingGroundingOverlaySchema.parse({
      ...overlay,
      disposition: 'discarded',
    })).toThrow();
  });

  it('rejects unknown snapshot and nested document fields', () => {
    expect(() => drawingWorkspaceSnapshotSchema.parse({ ...snapshot(), extra: true })).toThrow();
    expect(() => drawingWorkspaceSnapshotSchema.parse({
      ...snapshot(),
      document: { ...snapshot().document, extra: true },
    })).toThrow();
  });

  it('accepts only strict revision-aware workspace commands', () => {
    const request = {
      expectedRevision: 3,
      commands: [{
        type: 'node.update', id: 'line-1',
        changes: { visible: false }, expected: { visible: true },
      }],
    };

    expect(drawingWorkspaceCommitRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], unknown: true }],
    })).toThrow();
  });

  it('validates committed, conflict, and rejected results', () => {
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'committed', snapshot: snapshot(),
    }).status).toBe('committed');
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'conflict', message: 'stale', snapshot: snapshot(),
    }).status).toBe('conflict');
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'rejected', message: 'invalid', code: 'INVALID_COMMAND',
    }).status).toBe('rejected');
  });

  it('accepts strict revision-bound world-slice queries', () => {
    const request = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing-1', revision: 3 },
      bounds: { minX: 0, minY: 1, maxX: 10, maxY: 11 },
      planes: ['geometry', 'annotation'] as const,
      limit: 20,
    };

    expect(drawingQueryRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingQueryRequestSchema.parse({ ...request, unknown: true })).toThrow();
    expect(() => drawingQueryRequestSchema.parse({
      ...request,
      bounds: { ...request.bounds, unknown: true },
    })).toThrow();
  });

  it('validates strict query results containing Drawing nodes', () => {
    const line = {
      id: 'line-1',
      type: 'line' as const,
      start: [0, 0] as const,
      end: [10, 10] as const,
      visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };
    const result = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing-1', revision: 3 },
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      nodes: [{ plane: 'geometry' as const, node: line }],
      totalByPlane: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
      truncated: false,
    };

    expect(drawingQueryResultSchema.parse(result)).toEqual(result);
    expect(() => drawingQueryResultSchema.parse({
      ...result,
      nodes: [{ plane: 'geometry', node: { ...line, unknown: true } }],
    })).toThrow();
  });

  it('accepts node.create only with a matching strict plane node', () => {
    const text = {
      id: 'text-new',
      type: 'text' as const,
      content: '10',
      position: [5, 6] as const,
      height: 2,
      rotation: 0,
      alignment: 'center' as const,
      verticalAlignment: 'middle' as const,
      visible: true,
      quality: { status: 'candidate' as const, evidenceRefs: [] },
    };
    const request = {
      expectedRevision: 1,
      commands: [{ type: 'node.create' as const, plane: 'annotation' as const, node: text }],
    };

    expect(drawingWorkspaceCommitRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], plane: 'geometry' }],
    })).toThrow();
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], node: { ...text, unknown: true } }],
    })).toThrow();
  });

  it('validates strict Preview creation and candidate projection', () => {
    const request = {
      ref: { drawingId: 'drawing-1', revision: 1 },
      summary: 'hide one line',
      commands: [{
        type: 'node.update' as const,
        id: 'line-1',
        changes: { visible: false },
        expected: { visible: true },
      }],
    };
    const preview = {
      version: 1 as const,
      handle: 'preview-1',
      baseRef: request.ref,
      commands: request.commands,
      candidate: snapshot(),
      diff: {
        createdNodeIds: [],
        updatedNodeIds: ['line-1'],
        deletedNodeIds: [],
      },
      createdAt: 42,
      summary: request.summary,
    };

    expect(drawingPreviewCreateRequestSchema.parse(request)).toEqual(request);
    expect(drawingPreviewSchema.parse(preview)).toEqual(preview);
    expect(() => drawingPreviewCreateRequestSchema.parse({ ...request, unknown: true })).toThrow();
    expect(() => drawingPreviewSchema.parse({
      ...preview,
      diff: { ...preview.diff, unknown: true },
    })).toThrow();
  });

  it('validates strict revision-bound temporary motion-rig projections and controls', () => {
    const projection = {
      version: 1 as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      state: 'ready' as const,
      controlBodyNodeIds: ['hand'],
      connectors: [{ nodeId: 'arm', movingEndpoint: 'end' as const, fixedPoint: [0, 20] as const }],
      anchor: [0, 20] as const,
      handle: [20, 20] as const,
      keepAnchorFixed: true as const,
      keepControlBodyRigid: true as const,
      preserveConnectivity: true as const,
      allowControlRotation: false as const,
    };
    const rebuild = { ref: projection.drawingRef, nodeIds: ['hand'] };

    expect(drawingMotionRigProjectionSchema.parse(projection)).toEqual(projection);
    expect(drawingMotionRigRebuildRequestSchema.parse(rebuild)).toEqual(rebuild);
    expect(drawingMotionRigResultSchema.parse({ status: 'ready', projection })).toEqual({
      status: 'ready', projection,
    });
    expect(drawingMotionRigDiscardRequestSchema.parse({ ref: projection.drawingRef })).toEqual({
      ref: projection.drawingRef,
    });
    expect(drawingMotionRigDiscardResultSchema.parse({ status: 'discarded' })).toEqual({ status: 'discarded' });
    expect(() => drawingMotionRigProjectionSchema.parse({ ...projection, rigId: 'private' })).toThrow();
    expect(() => drawingMotionRigRebuildRequestSchema.parse({ ...rebuild, translation: [1, 2] })).toThrow();
  });

  it('validates opaque extension Preview ownership without exposing semantic handles', () => {
    const request = {
      extensionId: 'engineering-annotation',
      workflowId: 'workflow-1',
      ref: { drawingId: 'drawing-1', revision: 1 },
      targetNodeIds: ['circle-1'],
      interfaces: [],
      program: {
        baseRef: { drawingId: 'drawing-1', revision: 1 },
        targetHandle: 'extension-input',
        summary: 'add a diameter dimension',
        objective: '工程图纸自动标注',
        operations: [{
          kind: 'create_annotation_batch',
          annotations: [{ id: 'dimension-1', type: 'dimension' }],
          associations: [],
        }],
        preserveScopes: [],
        postconditions: [],
        evidenceRefs: ['planner-1'],
      },
    };
    const parsed = extensionPreviewCreateRequestSchema.parse(request);
    expect(parsed).toEqual(request);
    expect(() => extensionPreviewCreateRequestSchema.parse({ ...request, commitDirectly: true })).toThrow();

    const result = {
      status: 'previewed' as const,
      previewToken: 'opaque-token',
      candidateDigest: 'sha256:candidate',
      ref: request.ref,
      expiresAt: 1234,
    };
    expect(extensionPreviewCreateResultSchema.parse(result)).toEqual(result);
    expect(result).not.toHaveProperty('taskId');
    expect(result).not.toHaveProperty('previewHandle');

    const control = {
      extensionId: request.extensionId,
      workflowId: request.workflowId,
      ref: request.ref,
      previewToken: result.previewToken,
      candidateDigest: result.candidateDigest,
    };
    expect(extensionPreviewControlRequestSchema.parse(control)).toEqual(control);
    expect(() => extensionPreviewControlRequestSchema.parse({ ...control, workflowId: '' })).toThrow();
    expect(() => extensionPreviewControlRequestSchema.parse({ ...control, approved: true })).toThrow();
  });

  it('validates a sticky annotation workspace claim projection', () => {
    const state = {
      version: 1 as const,
      workspaceClaimed: true,
      activationEpoch: 42,
      workflow: { status: 'completed' as const, workflowId: 'workflow-1' },
    };
    expect(annotationSessionStateSchema.parse(state)).toEqual(state);
    expect(() => annotationSessionStateSchema.parse({ ...state, releaseAfterTask: true })).toThrow();
  });
});
