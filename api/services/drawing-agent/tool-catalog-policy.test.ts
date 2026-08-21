import { describe, expect, it } from 'vitest';

import type { ModelDrawingToolDefinition } from '../drawing-tools/types.js';
import { selectModelToolCatalog } from './tool-catalog-policy.js';

describe('selectModelToolCatalog', () => {
  const catalog = [
    'render_drawing', 'query_nodes', 'inspect_nodes', 'measure_geometry',
    'build_world_slice', 'inspect_world_slice', 'ground_semantic_entities',
    'refine_semantic_entity', 'propose_spatial_actions', 'inspect_counterfactual_world',
    'build_topology', 'trace_paths', 'find_interfaces', 'inspect_fragment', 'materialize_split',
    'preview_spatial_program', 'preview_connected_transform', 'preview_transaction', 'revise_preview',
    'evaluate_preview', 'commit_preview',
    'inspect_source_overview', 'create_observation_region', 'inspect_source_crop',
    'extract_cv_evidence', 'read_cv_evidence', 'redraw_region', 'vectorize_image',
    'preview_vectorization_batch', 'fit_geometry',
    'recompute_annotations',
  ].map(tool);

  it('exposes both task programs and code-computed connected transforms on the first turn', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: undefined,
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 1,
    });

    expect(selected.map((item) => item.name)).toEqual([
      'measure_geometry', 'build_world_slice', 'preview_spatial_program',
      'preview_connected_transform', 'preview_transaction',
    ]);
    expect(selected.map((item) => item.name)).not.toEqual(expect.arrayContaining([
      'query_nodes', 'inspect_nodes', 'inspect_world_slice', 'refine_semantic_entity',
      'ground_semantic_entities', 'propose_spatial_actions',
      'trace_paths', 'materialize_split',
      'commit_preview', 'extract_cv_evidence',
    ]));
  });

  it('unlocks task programs immediately for an explicit user selection', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: undefined,
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 1,
      hasExplicitSelection: true,
    });

    expect(selected.map((item) => item.name)).toContain('preview_spatial_program');
  });

  it('unlocks exact inspection only after the model requests new world evidence', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: 'build_world_slice',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 2,
    });

    expect(selected.map((item) => item.name)).toEqual(expect.arrayContaining([
      'query_nodes', 'inspect_nodes', 'inspect_world_slice', 'ground_semantic_entities',
    ]));
    expect(selected.map((item) => item.name)).not.toContain('propose_spatial_actions');
  });

  it('unlocks action proposals after semantic grounding while keeping connected transform available', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: 'ground_semantic_entities',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 3,
      completedTools: ['build_world_slice', 'ground_semantic_entities'],
    });

    expect(selected.map((item) => item.name)).toEqual(expect.arrayContaining([
      'refine_semantic_entity', 'propose_spatial_actions', 'preview_connected_transform',
    ]));
  });

  it('does not expose a successful read tool again in the same revision', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: 'measure_geometry',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 2,
      completedTools: ['measure_geometry'],
    });

    expect(selected.map((item) => item.name)).not.toContain('measure_geometry');
    expect(selected.map((item) => item.name)).toContain('preview_transaction');
  });

  it('unlocks topology adapters only when spatial evidence is incomplete or explicitly inspected', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: false, currentPreview: false, latestTool: 'build_world_slice',
      knowledgeState: 'partial', hasDiagnostics: false, decisionSequence: 2,
    });

    expect(selected.map((item) => item.name)).toEqual(expect.arrayContaining([
      'trace_paths', 'find_interfaces', 'inspect_fragment', 'materialize_split',
    ]));
  });

  it('adds source tools only for source-backed work and preview inspection only for a candidate', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: true, currentPreview: true, latestTool: 'preview_transaction',
      knowledgeState: 'resolved', hasDiagnostics: true, decisionSequence: 2,
      allowSourceReconstruction: true,
    });

    expect(selected.map((item) => item.name)).toEqual(expect.arrayContaining([
      'inspect_source_overview', 'extract_cv_evidence', 'redraw_region',
      'revise_preview', 'evaluate_preview', 'inspect_counterfactual_world',
    ]));
    expect(selected.map((item) => item.name)).not.toContain('commit_preview');
    expect(selected.map((item) => item.name)).not.toContain('preview_connected_transform');
    expect(selected.map((item) => item.name)).not.toContain('materialize_split');
  });

  it('keeps source inspection but hides reconstruction tools for a reference attachment', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: true, currentPreview: false, latestTool: undefined,
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 1,
      allowSourceReconstruction: false,
    }).map((item) => item.name);

    expect(selected).toContain('inspect_source_overview');
    expect(selected).not.toEqual(expect.arrayContaining([
      'redraw_region', 'vectorize_image', 'preview_vectorization_batch', 'fit_geometry',
    ]));
  });

  it('keeps the next vectorization batch available while hiding completed source extraction', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: true, currentPreview: false, latestTool: 'commit_preview',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 3,
      allowSourceReconstruction: true,
      completedTools: ['vectorize_image', 'preview_vectorization_batch'],
    }).map((tool) => tool.name);

    expect(selected).not.toContain('vectorize_image');
    expect(selected).toContain('preview_vectorization_batch');
  });

  it('hides vectorization batches while a Preview is waiting for commit', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: true, currentPreview: true, latestTool: 'preview_vectorization_batch',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 3,
      allowSourceReconstruction: true,
      completedTools: ['vectorize_image'],
    }).map((tool) => tool.name);

    expect(selected).not.toContain('preview_vectorization_batch');
    expect(selected).toContain('evaluate_preview');
  });

  it('hides the batch tool after every vectorization batch has been committed', () => {
    const selected = selectModelToolCatalog(catalog, {
      hasSource: true, currentPreview: false, latestTool: 'commit_preview',
      knowledgeState: 'resolved', hasDiagnostics: false, decisionSequence: 4,
      allowSourceReconstruction: true,
      completedTools: ['vectorize_image', 'preview_vectorization_batch'],
      pendingVectorizationBatches: false,
    }).map((tool) => tool.name);

    expect(selected).not.toContain('preview_vectorization_batch');
  });
});

function tool(name: string): ModelDrawingToolDefinition {
  return {
    name, version: '1.0.0', access: 'read', timeoutMs: 1_000,
    parseInput: (value) => value,
    execute: async () => ({ output: {} }),
  };
}
