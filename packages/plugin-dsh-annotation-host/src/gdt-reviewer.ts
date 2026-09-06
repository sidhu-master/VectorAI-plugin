// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  EngineeringDecisionAuthority,
  GeometricCharacteristic,
  PartitionDraft,
  PartitionRevision,
  ShaftPartitionSegment,
} from '@vectorai/engineering-annotation';
import type { GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { DrawingSpaceExtensionHost } from '@vectorai/plugin-space-contracts';
import type { GdtRecommendation } from './gdt-grounding';
import {
  resolveShaftGdtRules,
  extractPartitionFeatures,
  type GdtClarificationQuestion,
  type ReviewedShaftFeature,
} from './shaft-gdt-rules';
import {
  recognitionDigest,
  type RecognitionPipeline,
  type RecognitionPipelineRunner,
} from './recognition-runtime';

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'renderObservation'>;
type ShaftPartition = PartitionDraft | PartitionRevision;

export interface AutomaticGdtReviewInput {
  agent: Agent;
  partition: ShaftPartition;
  signal?: AbortSignal;
}

export type AutomaticGdtReviewer = (input: AutomaticGdtReviewInput) => Promise<GdtRecommendation>;

export const GDT_SEMANTIC_PIPELINE_ID = 'shaft-gdt-semantic-review';
export const GDT_SEMANTIC_PIPELINE_VERSION = '1';

export type DatumFunction = 'axis-support' | 'axial-stop' | 'clocking';

export interface ReviewedSemanticRecommendation {
  datums: Array<{ segmentId: string; function: DatumFunction; confidence: number }>;
  controls: Array<{
    id: string;
    characteristic: GeometricCharacteristic;
    segmentIds: string[];
    surfaceRole?: 'segment-surface' | 'positive-locating-shoulder';
    boundary?: 'start' | 'end';
    datumSegmentIds: string[];
    toleranceZoneShape: 'linear' | 'diametrical' | 'spherical';
    materialCondition?: 'rfs' | 'mmc' | 'lmc';
    confidence: number;
  }>;
}

export interface SemanticRecommendation {
  datums: Array<{
    name: string;
    segmentId: string;
    role: 'primary' | 'secondary' | 'tertiary' | 'origin';
    confidence: number;
    decisionAuthority?: EngineeringDecisionAuthority;
    evidenceIds?: string[];
  }>;
  controls: Array<{
    id: string;
    characteristic: GeometricCharacteristic;
    segmentIds: string[];
    surfaceRole?: 'segment-surface' | 'positive-locating-shoulder';
    boundary?: 'start' | 'end';
    datumNames: string[];
    toleranceZoneShape: 'linear' | 'diametrical' | 'spherical';
    materialCondition?: 'rfs' | 'mmc' | 'lmc';
    confidence: number;
    decisionAuthority?: EngineeringDecisionAuthority;
    evidenceIds?: string[];
  }>;
  surfaceTextures?: Array<{
    id: string;
    segmentIds: string[];
    parameter: 'Ra' | 'Rz' | 'Rq' | 'Rt';
    value: number;
    materialRemoval: 'required' | 'prohibited' | 'unspecified';
    source: 'document' | 'manual' | 'process-rule' | 'ai-candidate';
    confidence: number;
    decisionAuthority?: EngineeringDecisionAuthority;
    evidenceIds?: string[];
    ruleRef?: { id: string; version: string };
  }>;
}

export function createAutomaticGdtPipeline(
  space: SpacePort,
  options: { timeoutMs?: number } = {},
): RecognitionPipeline<AutomaticGdtReviewInput, GdtRecommendation> {
  return {
    id: GDT_SEMANTIC_PIPELINE_ID,
    version: GDT_SEMANTIC_PIPELINE_VERSION,
    async execute({ agent, partition }, context) {
    const drawing = space.getSnapshot(agent);
    if (!drawing) throw new Error('DRAWING_REQUIRED');
    if (!sameRef(drawing.ref, partition.drawingRef)) throw new Error('GDT_PARTITION_STALE');
    const segments = partition.segments.slice(0, 64);
    if (segments.length === 0) throw new Error('GDT_PARTITION_REQUIRED');
    const localResolution = resolveShaftGdtRules(partition);
    if (localResolution.status === 'resolved'
      || localResolution.questions.some(({ code }) => code === 'GDT_ENGINEERING_REQUIREMENTS_REQUIRED')) {
      const grounded = {
        ...groundSegmentRecommendation(drawing.document.geometry, partition, localResolution.recommendation),
        coverage: evaluateShaftGdtCoverage(partition, localResolution.recommendation, localResolution.questions),
      };
      context.record({
        id: 'gdt-local-resolution', kind: 'deterministic', status: 'completed',
        digest: recognitionDigest({ status: localResolution.status, questionCount: localResolution.questions.length }),
      });
      return grounded;
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('AI_GDT_REVIEW_TIMEOUT')), options.timeoutMs ?? 60_000);
    const reviewSignal = combineSignals(context.signal, timeout.signal);
    try {
      const overlays = segments.map((segment, index) => ({
        id: `gdt-observation:${segment.id}`,
        label: `S${index + 1} ${segment.name ?? segment.semanticType ?? '轴段'}`,
        polygon: segmentPolygon(partition.axis, segment.zStart, segment.zEnd, Math.max(segment.profile.maxRadius, 0.1) * 1.08),
      }));
      const rendered = await abortable(space.renderObservation(agent, { ref: partition.drawingRef, overlays }, reviewSignal), reviewSignal);
      if (rendered.status !== 'rendered') throw new Error(`AI_GDT_OBSERVATION_${rendered.status.toUpperCase()}`);
      context.record({
        id: 'gdt-observation', kind: 'deterministic', status: 'completed', digest: rendered.contentDigest,
      });
      const payload = JSON.stringify({
        instruction: '只识别轴段的功能角色，不选择形位公差特征、基准名称、公差值或坐标。function 只能是 axis-support（建立旋转轴线的圆柱支承面）、rotary-functional（齿轮、花键等旋转配合功能区）、axial-stop（轴向定位端面）或 clocking（键槽、平面等周向定位特征）。同一功能特征允许包含多个相邻 segmentId。只有可由图像和语义共同支持时才返回；confidence 必须反映真实把握，低于 0.8 也要保留，交由系统询问用户。形位控制集合和基准顺序全部由本地规则计算。',
        segments: segments.map((segment, index) => ({
          segmentId: segment.id,
          visualLabel: `S${index + 1}`,
          name: segment.name,
          semanticType: segment.semanticType,
          width: clean(segment.zEnd - segment.zStart),
          diameter: clean(segment.profile.maxRadius * 2),
        })),
        observationDigest: rendered.contentDigest,
      });
      const result = await abortable(context.review<{ features: ReviewedShaftFeature[] }>({
        pipelineId: GDT_SEMANTIC_PIPELINE_ID,
        pipelineVersion: GDT_SEMANTIC_PIPELINE_VERSION,
        parentSessionId: String(agent.id),
        signal: reviewSignal,
        maxDepth: 1,
        timeoutMs: options.timeoutMs ?? 60_000,
        persona: 'You are a bounded shaft functional-feature classifier. Return only functional roles and confidence. Never choose GD&T controls, coordinates or tolerance values.',
        prompt: [
          { type: 'text', text: payload },
          { type: 'image', data: rendered.png, mediaType: 'image/png', name: 'shaft-gdt-observation.png' },
        ],
        outputSchema: featureReviewSchema,
      }), reviewSignal);
      context.record({
        id: 'gdt-model-review', kind: 'model',
        status: result.stopReason === 'completed' ? 'completed' : 'failed',
        digest: recognitionDigest({ stopReason: result.stopReason, observationCount: result.observations.length }),
      });
      const semantic = result.stopReason === 'completed' ? validateFeatureReview(result.structured, segments) : null;
      const resolution = resolveShaftGdtRules(partition, semantic?.features ?? []);
      const grounded = {
        ...groundSegmentRecommendation(drawing.document.geometry, partition, resolution.recommendation),
        coverage: evaluateShaftGdtCoverage(partition, resolution.recommendation, resolution.questions),
      };
      context.record({
        id: 'gdt-rule-grounding', kind: 'grounding', status: 'completed',
        digest: recognitionDigest({
          datumCount: grounded.datums.length,
          controlCount: grounded.controls.length,
          complete: grounded.coverage?.complete ?? false,
        }),
      });
      return grounded;
    } catch (error) {
      // Semantic review is an optional enrichment step. A provider timeout or
      // observation failure must not tear down the deterministic annotation
      // transaction; preserve the grounded local result and its clarification
      // state so the caller can continue or ask the user for missing semantics.
      if (context.signal?.aborted) throw error;
      return {
        ...groundSegmentRecommendation(
          drawing.document.geometry,
          partition,
          localResolution.recommendation,
        ),
        coverage: evaluateShaftGdtCoverage(
          partition,
          localResolution.recommendation,
          localResolution.questions,
        ),
      };
    } finally {
      clearTimeout(timer);
    }
    },
    normalize: (output) => structuredClone(output),
  };
}

export function createAutomaticGdtReviewer(
  runner: RecognitionPipelineRunner,
): AutomaticGdtReviewer {
  return async (input) => (
    await runner.run<AutomaticGdtReviewInput, GdtRecommendation>(
      GDT_SEMANTIC_PIPELINE_ID,
      input,
      input.signal,
    )
  ).output;
}

/** Compatibility normalizer for explicit/manual semantic recommendations. */
export function completeShaftGdtRecommendation(
  partition: ShaftPartition,
  reviewed: ReviewedSemanticRecommendation,
): SemanticRecommendation {
  const reviewedCandidates = dedupeDatumCandidates(reviewed.datums);
  const normalizedControls = reviewed.controls.map((control) => ({
    ...structuredClone(control),
    datumSegmentIds: selectControlDatumSegments(control, reviewedCandidates, partition),
  }));
  const referenced = new Set(normalizedControls.flatMap(({ datumSegmentIds }) => datumSegmentIds));
  const candidates = reviewedCandidates
    .filter(({ segmentId }) => referenced.has(segmentId))
    .sort((left, right) => compareDatumCandidates(left, right, partition));
  const datums = candidates.map((candidate, index) => ({
    name: datumName(index),
    segmentId: candidate.segmentId,
    role: datumRole(index),
    confidence: candidate.confidence,
  }));
  const nameBySegment = new Map(datums.map(({ segmentId, name }) => [segmentId, name]));
  const orderByName = new Map(datums.map(({ name }, index) => [name, index]));
  const controls = normalizedControls.map(({ datumSegmentIds, ...control }) => ({
    ...structuredClone(control),
    datumNames: [...new Set(datumSegmentIds.flatMap((segmentId) => {
      const name = nameBySegment.get(segmentId);
      return name === undefined ? [] : [name];
    }))].sort((left, right) => orderByName.get(left)! - orderByName.get(right)!),
  }));
  return { datums, controls };
}

export function evaluateShaftGdtCoverage(
  partition: ShaftPartition,
  recommendation: SemanticRecommendation,
  questions: readonly GdtClarificationQuestion[] = [],
): {
  complete: boolean;
  requiredDatumCount: number;
  requiredControlCount: number;
  status?: 'needs-user-input';
  questions?: GdtClarificationQuestion[];
} {
  const segmentIds = new Set(partition.segments.map(({ id }) => id));
  const datumNames = new Set(recommendation.datums.map(({ name }) => name));
  const structurallyValid = recommendation.datums.every(({ segmentId }) => segmentIds.has(segmentId))
    && recommendation.controls.every((control) => (
      control.segmentIds.length > 0
      && control.segmentIds.every((segmentId) => segmentIds.has(segmentId))
      && control.datumNames.every((name) => datumNames.has(name))
    ));
  return {
    complete: questions.length === 0 && recommendation.controls.length > 0 && structurallyValid,
    requiredDatumCount: recommendation.datums.length,
    requiredControlCount: recommendation.controls.length,
    ...(questions.length === 0 ? {} : {
      status: 'needs-user-input' as const,
      questions: questions.map((question) => structuredClone(question)),
    }),
  };
}

export function groundSegmentRecommendation(
  geometry: readonly GeometryNode[],
  partition: ShaftPartition,
  recommendation: SemanticRecommendation,
): GdtRecommendation {
  const segmentById = new Map(partition.segments.map((segment) => [segment.id, segment]));
  const nodeById = new Map(geometry.filter(({ visible }) => visible).map((node) => [String(node.id), node]));
  const supportFeatures = extractPartitionFeatures(partition).filter(({ function: value }) => value === 'axis-support');
  const workingSegments = (segmentIds: readonly string[]) => {
    const selected = new Set(segmentIds);
    for (const feature of supportFeatures) {
      if (!feature.segmentIds.every((id) => selected.has(id))) continue;
      const working = feature.segmentIds.map((id) => requireSegment(segmentById, id))
        .sort((a, b) => (b.zEnd - b.zStart) - (a.zEnd - a.zStart) || a.id.localeCompare(b.id))[0];
      // A complete bearing feature includes transition segments. Its cylindrical
      // control belongs to the working span, not the chamfer and through bore.
      feature.segmentIds.forEach((id) => selected.delete(id));
      selected.add(working.id);
    }
    return [...selected].map((id) => requireSegment(segmentById, id));
  };
  const datums = recommendation.datums.map((item) => {
    const segment = requireSegment(segmentById, item.segmentId);
    return {
      name: item.name,
      geometryId: selectRepresentativeGeometry(segment, nodeById, partition.axis, 'axis-parallel-bottom'),
      role: item.role,
      ...(item.decisionAuthority === undefined ? {} : { decisionAuthority: item.decisionAuthority }),
      ...(item.evidenceIds === undefined ? {} : { evidenceIds: [...item.evidenceIds] }),
    };
  });
  const controls = recommendation.controls.map((item) => {
    const segments = item.segmentIds.map((segmentId) => requireSegment(segmentById, segmentId));
    const geometryIds = item.surfaceRole === 'positive-locating-shoulder'
      ? [selectLocatingShoulderGeometry(segments, partition, nodeById, item.boundary)]
      : (prefersRadialFace(item.characteristic) ? segments : workingSegments(item.segmentIds)).map((segment) => selectRepresentativeGeometry(
        segment, nodeById, partition.axis,
        prefersRadialFace(item.characteristic) ? 'radial-face' : 'axis-parallel-top',
      ));
    return {
      id: item.id,
      characteristic: item.characteristic,
      geometryIds: [...new Set(geometryIds)],
      datumNames: [...item.datumNames],
      toleranceZoneShape: item.toleranceZoneShape,
      ...(item.materialCondition === undefined ? {} : { materialCondition: item.materialCondition }),
      ...(item.decisionAuthority === undefined ? {} : { decisionAuthority: item.decisionAuthority }),
      ...(item.evidenceIds === undefined ? {} : { evidenceIds: [...item.evidenceIds] }),
    };
  });
  const surfaceTextures = (recommendation.surfaceTextures ?? []).map((item) => ({
    ...structuredClone(item),
    geometryIds: [...new Set(workingSegments(item.segmentIds).map((segment) => {
      // A journal's surface texture controls the cylindrical working surface.
      // In an axial section that surface is represented by a line parallel to
      // the shaft axis; a radial line is an end/shoulder face instead.
      return selectRepresentativeGeometry(segment, nodeById, partition.axis, 'axis-parallel-top');
    }))],
  }));
  return {
    datums,
    controls,
    ...(surfaceTextures.length === 0 ? {} : { surfaceTextures }),
  };
}

function selectLocatingShoulderGeometry(
  features: readonly ShaftPartitionSegment[],
  partition: ShaftPartition,
  nodes: ReadonlyMap<string, GeometryNode>,
  boundary: 'start' | 'end' | undefined,
): string {
  const axis = partition.axis;
  const feature = boundaryFeatureSegment(features, boundary ?? 'end');
  const stationTolerance = Math.max(Number.EPSILON * 1e6, Math.abs(axis.zMax - axis.zMin) * 1e-6);
  const shoulder = adjacentShoulderSegments(partition, features, boundary ?? 'end', stationTolerance);
  if (shoulder.length === 0) {
    return selectRadialFaceAtFeatureBoundary(feature, nodes, axis, boundary, stationTolerance);
  }
  const candidateIds = new Set(shoulder.flatMap(({ geometryNodeIds }) => geometryNodeIds.map(String)));
  const range = {
    zStart: Math.min(...shoulder.map(({ zStart }) => zStart)),
    zEnd: Math.max(...shoulder.map(({ zEnd }) => zEnd)),
  };
  const stations: Array<{
    z: number;
    positive: number;
    negative: number;
    candidates: Array<{ node: GeometryNode & { type: 'line' }; radialSpan: number; signedRadius: number }>;
  }> = [];
  for (const id of candidateIds) {
    const node = nodes.get(id);
    if (node.type !== 'line') continue;
    const delta: Vec2 = [node.end[0] - node.start[0], node.end[1] - node.start[1]];
    const axialSpan = Math.abs(dot(delta, axis.direction));
    const radialSpan = Math.abs(dot(delta, axis.normal));
    if (radialSpan <= axialSpan * 2 || radialSpan < stationTolerance) continue;
    const midpoint: Vec2 = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    const midpointZ = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.direction);
    if (midpointZ < range.zStart - stationTolerance || midpointZ > range.zEnd + stationTolerance) continue;
    const signedRadius = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.normal);
    let station = stations.find(({ z }) => Math.abs(z - midpointZ) <= stationTolerance);
    if (!station) {
      station = { z: midpointZ, positive: 0, negative: 0, candidates: [] };
      stations.push(station);
    }
    station.candidates.push({ node, radialSpan, signedRadius });
    if (signedRadius >= 0) station.positive += radialSpan;
    else station.negative += radialSpan;
  }
  const selectedStation = stations.sort((left, right) => {
    const paired = Number(right.positive > stationTolerance && right.negative > stationTolerance)
      - Number(left.positive > stationTolerance && left.negative > stationTolerance);
    if (paired !== 0) return paired;
    const span = right.positive + right.negative - left.positive - left.negative;
    if (span !== 0) return span;
    return (boundary ?? 'end') === 'end' ? right.z - left.z : left.z - right.z;
  })[0];
  const selected = selectedStation?.candidates.sort((left, right) => (
    right.radialSpan - left.radialSpan
    || right.signedRadius - left.signedRadius
    || String(left.node.id).localeCompare(String(right.node.id))
  ))[0];
  return selected ? String(selected.node.id) : selectRepresentativeGeometry(feature, nodes, axis, 'radial-face');
}

function boundaryFeatureSegment(features: readonly ShaftPartitionSegment[], boundary: 'start' | 'end') {
  if (features.length === 0) throw new Error('GDT_SEGMENT_GEOMETRY_REQUIRED');
  return [...features].sort((left, right) => boundary === 'start'
    ? left.zStart - right.zStart
    : right.zEnd - left.zEnd)[0]!;
}

function adjacentShoulderSegments(
  partition: ShaftPartition,
  features: readonly ShaftPartitionSegment[],
  boundary: 'start' | 'end',
  tolerance: number,
): ShaftPartitionSegment[] {
  const featureStation = boundary === 'start'
    ? Math.min(...features.map(({ zStart }) => zStart))
    : Math.max(...features.map(({ zEnd }) => zEnd));
  const segmentById = new Map(partition.segments.map((segment) => [segment.id, segment]));
  const groups = partition.semanticGroups.filter(({ semanticType }) => semanticType === 'shoulder').map((group) => {
    const segments = group.segmentIds.map((id) => segmentById.get(id)).filter((segment) => segment !== undefined);
    const range = group.range ?? (segments.length === 0 ? undefined : {
      zStart: Math.min(...segments.map(({ zStart }) => zStart)),
      zEnd: Math.max(...segments.map(({ zEnd }) => zEnd)),
    });
    return { segments, range };
  }).filter(({ segments, range }) => segments.length > 0 && range !== undefined);
  const adjacent = groups.filter(({ range }) => boundary === 'start'
    ? Math.abs(range!.zEnd - featureStation) <= tolerance
    : Math.abs(range!.zStart - featureStation) <= tolerance);
  if (adjacent.length !== 1) return [];
  return adjacent[0]!.segments;
}

function selectRadialFaceAtFeatureBoundary(
  feature: ShaftPartitionSegment,
  nodes: ReadonlyMap<string, GeometryNode>,
  axis: ShaftPartition['axis'],
  boundary: 'start' | 'end' | undefined,
  stationTolerance: number,
): string {
  const stations = boundary === 'start' ? [feature.zStart]
    : boundary === 'end' ? [feature.zEnd]
      : [feature.zStart, feature.zEnd];
  let selected: { node: GeometryNode & { type: 'line' }; score: number } | null = null;
  for (const node of nodes.values()) {
    if (node.type !== 'line') continue;
    const delta: Vec2 = [node.end[0] - node.start[0], node.end[1] - node.start[1]];
    const axialSpan = Math.abs(dot(delta, axis.direction));
    const radialSpan = Math.abs(dot(delta, axis.normal));
    if (radialSpan <= axialSpan * 2 || radialSpan < stationTolerance) continue;
    const midpoint: Vec2 = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    const midpointZ = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.direction);
    const stationError = Math.min(...stations.map((station) => Math.abs(midpointZ - station)));
    if (stationError > stationTolerance) continue;
    const score = radialSpan - axialSpan - stationError;
    if (!selected || score > selected.score) selected = { node, score };
  }
  return selected ? String(selected.node.id) : selectRepresentativeGeometry(feature, nodes, axis, 'radial-face');
}

type RepresentativeSurfacePreference = 'axis-parallel-top' | 'axis-parallel-bottom' | 'radial-face';

function selectRepresentativeGeometry(
  segment: ShaftPartitionSegment,
  nodes: ReadonlyMap<string, GeometryNode>,
  axis: ShaftPartition['axis'],
  preference: RepresentativeSurfacePreference,
): string {
  const candidates = segment.geometryNodeIds.map((id) => nodes.get(String(id))).filter((node) => node !== undefined);
  if (candidates.length === 0) throw new Error(`GDT_SEGMENT_GEOMETRY_REQUIRED:${segment.id}`);
  return String([...candidates].sort((left, right) => compareRepresentativeNodes(left, right, axis, segment, preference))[0]!.id);
}

interface RepresentativeNodeMetrics {
  line: boolean;
  alignmentError: number;
  surfaceRadiusError: number;
  inside: boolean;
  outsideDistance: number;
  overflow: number;
  preferredSpan: number;
  crossSpan: number;
  signedRadius: number;
}

function compareRepresentativeNodes(
  left: GeometryNode,
  right: GeometryNode,
  axis: ShaftPartition['axis'],
  segment: ShaftPartitionSegment,
  preference: RepresentativeSurfacePreference,
): number {
  const a = representativeNodeMetrics(left, axis, segment, preference);
  const b = representativeNodeMetrics(right, axis, segment, preference);
  // The fitted axis can drift slightly across the drawing. Both section
  // generators of the same cylinder must count as matching its radius, so
  // the requested top/bottom attachment is not decided by that fit noise.
  const radiusContact = Math.abs(axis.zMax - axis.zMin) * 2e-5;
  const radiusRank = (error: number) => Math.max(0, error - radiusContact);
  return Number(b.line) - Number(a.line)
    || Math.round(a.alignmentError / 1e-6) - Math.round(b.alignmentError / 1e-6)
    || radiusRank(a.surfaceRadiusError) - radiusRank(b.surfaceRadiusError)
    || Number(b.inside) - Number(a.inside)
    || a.outsideDistance - b.outsideDistance
    || Math.round(a.overflow / Math.max(radiusContact, 1e-9)) - Math.round(b.overflow / Math.max(radiusContact, 1e-9))
    || (preference === 'axis-parallel-bottom'
      ? a.signedRadius - b.signedRadius
      : preference === 'axis-parallel-top' ? b.signedRadius - a.signedRadius : 0)
    || b.preferredSpan - a.preferredSpan
    || a.crossSpan - b.crossSpan
    || String(left.id).localeCompare(String(right.id));
}

function representativeNodeMetrics(
  node: GeometryNode,
  axis: ShaftPartition['axis'],
  segment: ShaftPartitionSegment,
  preference: RepresentativeSurfacePreference,
): RepresentativeNodeMetrics {
  if (node.type !== 'line') {
    return {
      line: false,
      alignmentError: Number.POSITIVE_INFINITY,
      surfaceRadiusError: Number.POSITIVE_INFINITY,
      inside: false,
      outsideDistance: Number.POSITIVE_INFINITY,
      overflow: Number.POSITIVE_INFINITY,
      preferredSpan: 0,
      crossSpan: 0,
      signedRadius: 0,
    };
  }
  const delta: Vec2 = [node.end[0] - node.start[0], node.end[1] - node.start[1]];
  const axial = Math.abs(dot(delta, axis.direction));
  const radial = Math.abs(dot(delta, axis.normal));
  const length = Math.max(Math.hypot(axial, radial), Number.EPSILON);
  const midpoint: Vec2 = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
  const midpointZ = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.direction);
  const segmentWidth = Math.max(segment.zEnd - segment.zStart, 1e-6);
  const outsideDistance = midpointZ < segment.zStart ? segment.zStart - midpointZ
    : midpointZ > segment.zEnd ? midpointZ - segment.zEnd : 0;
  const signedRadius = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.normal);
  return {
    line: true,
    // A datum established by a journal belongs to its cylindrical working
    // surface. In an axial section that surface is axis-parallel; containment
    // inside a partition interval is only a secondary signal because source
    // CAD commonly keeps one continuous profile line across several segments.
    alignmentError: (preference === 'radial-face' ? axial : radial) / length,
    surfaceRadiusError: preference === 'radial-face'
      ? 0
      : Math.abs(Math.abs(signedRadius) - segment.profile.maxRadius),
    inside: outsideDistance === 0,
    outsideDistance,
    overflow: Math.max(0, axial - segmentWidth),
    preferredSpan: preference === 'radial-face' ? radial : axial,
    crossSpan: preference === 'radial-face' ? axial : radial,
    signedRadius,
  };
}

function prefersRadialFace(value: GeometricCharacteristic): boolean {
  return value === 'flatness' || value === 'perpendicularity' || value === 'angularity' || value === 'parallelism';
}

function requireSegment(values: ReadonlyMap<string, ShaftPartitionSegment>, id: string): ShaftPartitionSegment {
  const value = values.get(id);
  if (!value) throw new Error(`GDT_SEGMENT_UNKNOWN:${id}`);
  return value;
}

function validateFeatureReview(
  value: unknown,
  segments: readonly ShaftPartitionSegment[],
): { features: ReviewedShaftFeature[] } | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { features?: ReviewedShaftFeature[] };
  if (!Array.isArray(candidate.features)) return null;
  const allowedSegments = new Set(segments.map(({ id }) => id));
  const features = candidate.features.filter((item) => item
    && typeof item.id === 'string'
    && Array.isArray(item.segmentIds)
    && item.segmentIds.length > 0
    && item.segmentIds.every((id) => allowedSegments.has(id))
    && FEATURE_FUNCTIONS.has(item.function)
    && Number.isFinite(item.confidence));
  return { features: structuredClone(features) };
}

const FEATURE_FUNCTIONS = new Set<ReviewedShaftFeature['function']>([
  'axis-support', 'rotary-functional', 'axial-stop', 'clocking',
]);
const DATUM_FUNCTION_ORDER: Record<DatumFunction, number> = {
  'axis-support': 0,
  'axial-stop': 1,
  clocking: 2,
};

function dedupeDatumCandidates(values: readonly ReviewedSemanticRecommendation['datums'][number][]): ReviewedSemanticRecommendation['datums'] {
  const bySegment = new Map<string, ReviewedSemanticRecommendation['datums'][number]>();
  for (const value of values) {
    const current = bySegment.get(value.segmentId);
    if (!current || value.confidence > current.confidence) bySegment.set(value.segmentId, structuredClone(value));
  }
  return [...bySegment.values()];
}

const DATUM_FREE_CHARACTERISTICS = new Set<GeometricCharacteristic>([
  'straightness', 'flatness', 'circularity', 'cylindricity',
]);
const AXIS_DATUM_CHARACTERISTICS = new Set<GeometricCharacteristic>([
  'coaxiality', 'circular-runout', 'total-runout',
]);

function selectControlDatumSegments(
  control: ReviewedSemanticRecommendation['controls'][number],
  candidates: readonly ReviewedSemanticRecommendation['datums'][number][],
  partition: ShaftPartition,
): string[] {
  if (DATUM_FREE_CHARACTERISTICS.has(control.characteristic)) return [];
  const requested = new Set(control.datumSegmentIds);
  const eligible = candidates.filter(({ segmentId, function: datumFunction }) => (
    requested.has(segmentId)
    && (!AXIS_DATUM_CHARACTERISTICS.has(control.characteristic) || datumFunction === 'axis-support')
  ));
  const axisSupports = selectStableAxisSupports(eligible.filter(({ function: value }) => value === 'axis-support'), partition);
  const axialStop = highestConfidence(eligible.filter(({ function: value }) => value === 'axial-stop'));
  const clocking = highestConfidence(eligible.filter(({ function: value }) => value === 'clocking'));
  return [
    ...axisSupports,
    ...(AXIS_DATUM_CHARACTERISTICS.has(control.characteristic) ? [] : [axialStop, clocking]),
  ].filter((value) => value !== undefined)
    .sort((left, right) => compareDatumCandidates(left, right, partition))
    .map(({ segmentId }) => segmentId);
}

function selectStableAxisSupports(
  candidates: readonly ReviewedSemanticRecommendation['datums'][number][],
  partition: ShaftPartition,
): ReviewedSemanticRecommendation['datums'] {
  if (candidates.length <= 2) return [...candidates];
  const stations = new Map(partition.segments.map((segment) => [segment.id, (segment.zStart + segment.zEnd) / 2]));
  let selected: [ReviewedSemanticRecommendation['datums'][number], ReviewedSemanticRecommendation['datums'][number]] | undefined;
  let separation = -1;
  let confidence = -1;
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const pair: [ReviewedSemanticRecommendation['datums'][number], ReviewedSemanticRecommendation['datums'][number]] = [
        candidates[left]!, candidates[right]!,
      ];
      const pairSeparation = Math.abs((stations.get(pair[0].segmentId) ?? 0) - (stations.get(pair[1].segmentId) ?? 0));
      const pairConfidence = pair[0].confidence + pair[1].confidence;
      if (pairSeparation > separation || pairSeparation === separation && pairConfidence > confidence) {
        selected = pair;
        separation = pairSeparation;
        confidence = pairConfidence;
      }
    }
  }
  return selected ?? [];
}

function highestConfidence(
  values: readonly ReviewedSemanticRecommendation['datums'][number][],
): ReviewedSemanticRecommendation['datums'][number] | undefined {
  return [...values].sort((left, right) => right.confidence - left.confidence || left.segmentId.localeCompare(right.segmentId))[0];
}

function compareDatumCandidates(
  left: ReviewedSemanticRecommendation['datums'][number],
  right: ReviewedSemanticRecommendation['datums'][number],
  partition: ShaftPartition,
): number {
  const functionOrder = DATUM_FUNCTION_ORDER[left.function] - DATUM_FUNCTION_ORDER[right.function];
  if (functionOrder !== 0) return functionOrder;
  const segments = new Map(partition.segments.map((segment) => [segment.id, segment]));
  const leftSegment = segments.get(left.segmentId);
  const rightSegment = segments.get(right.segmentId);
  const leftStation = leftSegment ? (leftSegment.zStart + leftSegment.zEnd) / 2 : 0;
  const rightStation = rightSegment ? (rightSegment.zStart + rightSegment.zEnd) / 2 : 0;
  const direction = partition.axis.orientation === 'reversed' ? -1 : 1;
  return (leftStation - rightStation) * direction || left.segmentId.localeCompare(right.segmentId);
}

function datumName(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function datumRole(index: number): 'primary' | 'secondary' | 'tertiary' {
  return index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary';
}

const featureReviewSchema = {
  type: 'object', additionalProperties: false, required: ['features'],
  properties: {
    features: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'segmentIds', 'function', 'confidence'], properties: {
        id: { type: 'string' },
        segmentIds: { type: 'array', items: { type: 'string' } },
        function: { type: 'string', enum: ['axis-support', 'rotary-functional', 'axial-stop', 'clocking'] },
        confidence: { type: 'number' },
      } } },
  },
} as const;

function segmentPolygon(axis: ShaftPartition['axis'], zStart: number, zEnd: number, radius: number): Array<[number, number]> {
  const at = (z: number, r: number): [number, number] => [
    axis.origin[0] + axis.direction[0] * z + axis.normal[0] * r,
    axis.origin[1] + axis.direction[1] * z + axis.normal[1] * r,
  ];
  return [at(zStart, -radius), at(zEnd, -radius), at(zEnd, radius), at(zStart, radius)];
}

function combineSignals(first: AbortSignal | undefined, second: AbortSignal): AbortSignal {
  if (!first) return second;
  const controller = new AbortController();
  const abort = (source: AbortSignal) => controller.abort(source.reason);
  if (first.aborted) abort(first); else first.addEventListener('abort', () => abort(first), { once: true });
  if (second.aborted) abort(second); else second.addEventListener('abort', () => abort(second), { once: true });
  return controller.signal;
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)).catch(() => undefined);
  });
}

function dot(left: Vec2, right: Vec2): number { return left[0] * right[0] + left[1] * right[1]; }
function clean(value: number): number { return Number(value.toFixed(6)); }
function sameRef(left: { drawingId: string; revision: number }, right: { drawingId: string; revision: number }): boolean {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}
