import type { WorldModelKnowledgeStateKind } from '../drawing-world-model/types.js';
import type { ModelDrawingToolDefinition } from '../drawing-tools/types.js';

const DIRECT_ACTIONS = new Set([
  'measure_geometry', 'preview_spatial_program', 'preview_transaction',
]);

const WORLD_DISCOVERY_ENTRY = 'build_world_slice';
const SEMANTIC_GROUNDING = 'ground_semantic_entities';
const ACTION_PROPOSAL = 'propose_spatial_actions';
const CODE_COMPUTED_CONNECTED_TRANSFORM = 'preview_connected_transform';

const EVIDENCE_REFINEMENT = new Set([
  'render_drawing', 'query_nodes', 'inspect_nodes', 'inspect_world_slice',
]);

const TOPOLOGY_ADAPTERS = new Set([
  'build_topology', 'trace_paths', 'find_interfaces', 'inspect_fragment', 'materialize_split',
]);

const SOURCE_TOOLS = new Set([
  'inspect_source_overview', 'create_observation_region', 'inspect_source_crop',
  'extract_cv_evidence', 'read_cv_evidence',
]);
const SOURCE_RECONSTRUCTION_TOOLS = new Set([
  'redraw_region', 'vectorize_image', 'preview_vectorization_batch', 'fit_geometry',
]);

const PREVIEW_TOOLS = new Set([
  'revise_preview', 'evaluate_preview', 'inspect_counterfactual_world',
]);
const RUNTIME_ONLY_TOOLS = new Set(['commit_preview']);

export function selectModelToolCatalog<T extends Pick<ModelDrawingToolDefinition, 'name'>>(
  catalog: T[],
  context: {
    hasSource: boolean;
    currentPreview: boolean;
    latestTool?: string;
    knowledgeState: WorldModelKnowledgeStateKind;
    hasDiagnostics: boolean;
    decisionSequence: number;
    completedTools?: string[];
    pendingVectorizationBatches?: boolean;
    hasExplicitSelection?: boolean;
    allowSourceReconstruction?: boolean;
  },
): T[] {
  const completedTools = new Set(context.completedTools ?? []);
  const evidenceRefinementAllowed = context.decisionSequence > 1;
  const worldSliceAvailable = completedTools.has(WORLD_DISCOVERY_ENTRY)
    || context.latestTool === WORLD_DISCOVERY_ENTRY
    || context.latestTool === 'inspect_world_slice';
  const semanticGroundingAvailable = completedTools.has(SEMANTIC_GROUNDING)
    || context.latestTool === SEMANTIC_GROUNDING
    || context.latestTool === 'refine_semantic_entity';
  const topologyRelevant = evidenceRefinementAllowed && (context.knowledgeState !== 'resolved'
    || TOPOLOGY_ADAPTERS.has(context.latestTool ?? ''));
  return catalog.filter((tool) => !RUNTIME_ONLY_TOOLS.has(tool.name) && (
    DIRECT_ACTIONS.has(tool.name)
    || tool.name === WORLD_DISCOVERY_ENTRY
    || worldSliceAvailable && tool.name === SEMANTIC_GROUNDING
    || semanticGroundingAvailable && tool.name === ACTION_PROPOSAL
    || semanticGroundingAvailable && tool.name === 'refine_semantic_entity'
    || tool.name === CODE_COMPUTED_CONNECTED_TRANSFORM
    || evidenceRefinementAllowed && EVIDENCE_REFINEMENT.has(tool.name)
    || topologyRelevant && TOPOLOGY_ADAPTERS.has(tool.name)
    || context.hasSource && SOURCE_TOOLS.has(tool.name)
    || context.hasSource && context.allowSourceReconstruction === true
      && SOURCE_RECONSTRUCTION_TOOLS.has(tool.name)
    || context.currentPreview && PREVIEW_TOOLS.has(tool.name)
  ) && (tool.name !== 'preview_vectorization_batch'
    || context.pendingVectorizationBatches !== false)
  && (!context.currentPreview
    || (tool.name !== 'preview_connected_transform' && tool.name !== 'materialize_split'))
  && (!context.currentPreview || tool.name !== 'preview_vectorization_batch')
  && ((tool.name === 'preview_spatial_program'
    || tool.name === 'preview_transaction'
    || tool.name === 'revise_preview'
    || tool.name === CODE_COMPUTED_CONNECTED_TRANSFORM
    || tool.name === 'preview_vectorization_batch')
    || tool.name === 'evaluate_preview'
    || !completedTools.has(tool.name)));
}
