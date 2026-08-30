// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent';
import type {
  GeometricCharacteristic,
  PartitionDraft,
  PartitionRevision,
  ShaftPartitionSegment,
} from '@vectorai/engineering-annotation';
import type { GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { DrawingSpaceExtensionHost } from '@vectorai/plugin-space-contracts';
import type { GdtRecommendation } from './gdt-grounding';

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'renderObservation'>;
type ShaftPartition = PartitionDraft | PartitionRevision;

export type AutomaticGdtReviewer = (input: {
  agent: Agent;
  partition: ShaftPartition;
  signal?: AbortSignal;
}) => Promise<GdtRecommendation>;

export interface SemanticRecommendation {
  datums: Array<{ name: string; segmentId: string; role: 'primary' | 'secondary' | 'tertiary' | 'origin'; confidence: number }>;
  controls: Array<{
    id: string;
    characteristic: GeometricCharacteristic;
    segmentIds: string[];
    surfaceRole?: 'segment-surface' | 'positive-locating-shoulder';
    datumNames: string[];
    toleranceZoneShape: 'linear' | 'diametrical' | 'spherical';
    materialCondition?: 'rfs' | 'mmc' | 'lmc';
    confidence: number;
  }>;
}

export function createAutomaticGdtReviewer(
  ctx: Context & { subagents: SubagentRuntime },
  space: SpacePort,
  options: { timeoutMs?: number } = {},
): AutomaticGdtReviewer {
  return async ({ agent, partition, signal }) => {
    const drawing = space.getSnapshot(agent);
    if (!drawing) throw new Error('DRAWING_REQUIRED');
    if (!sameRef(drawing.ref, partition.drawingRef)) throw new Error('GDT_PARTITION_STALE');
    const segments = partition.segments.slice(0, 64);
    if (segments.length === 0) throw new Error('GDT_PARTITION_REQUIRED');
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('AI_GDT_REVIEW_TIMEOUT')), options.timeoutMs ?? 60_000);
    const reviewSignal = combineSignals(signal, timeout.signal);
    try {
      const overlays = segments.map((segment, index) => ({
        id: `gdt-observation:${segment.id}`,
        label: `S${index + 1} ${segment.name ?? segment.semanticType ?? '轴段'}`,
        polygon: segmentPolygon(partition.axis, segment.zStart, segment.zEnd, Math.max(segment.profile.maxRadius, 0.1) * 1.08),
      }));
      const rendered = await abortable(space.renderObservation(agent, { ref: partition.drawingRef, overlays }, reviewSignal), reviewSignal);
      if (rendered.status !== 'rendered') throw new Error(`AI_GDT_OBSERVATION_${rendered.status.toUpperCase()}`);
      const attachment = await abortable(ctx.attachments.saveImage({
        data: rendered.png, mediaType: 'image/png', name: 'shaft-gdt-observation.png',
      }), reviewSignal);
      const parent = ctx.agents.get(String(agent.id) as SessionId);
      const providerName = ctx.subagents.list()[0];
      if (!parent || !providerName) throw new Error('AI_GDT_REVIEW_UNAVAILABLE');
      const provider = ctx.subagents.getProvider(providerName);
      if (!provider?.capabilities.outputSchema || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) {
        throw new Error('AI_GDT_REVIEW_ISOLATION_REQUIRED');
      }
      const payload = JSON.stringify({
        instruction: '根据编号轴段图和工程语义，审核轴类零件的基准与形位公差类型。优先用轴承位建立主/次基准；检查每个轴承位的圆度、圆柱度和相对公共基准的圆跳动，以及齿轮、花键等旋转功能面的圆跳动。只选择 S 标签对应的 segmentId，不返回坐标、几何 ID或任何公差数值。datum 名称使用 A/B/C。confidence 低于 0.8 的项目不要返回。',
        segments: segments.map((segment, index) => ({
          segmentId: segment.id,
          visualLabel: `S${index + 1}`,
          name: segment.name,
          semanticType: segment.semanticType,
          width: clean(segment.zEnd - segment.zStart),
          diameter: clean(segment.profile.maxRadius * 2),
        })),
        allowedCharacteristics: CHARACTERISTICS,
        observationDigest: rendered.contentDigest,
      });
      const run = await abortable(ctx.subagents.start(providerName, {
        label: 'shaft-gdt-semantic-reviewer', parent, signal: reviewSignal, maxDepth: 1,
        toolFilter: { allow: [] },
        persona: provider.capabilities.persona
          ? 'You are a bounded shaft GD&T recommender. Return only the requested structured result. Never invent coordinates or tolerance values.'
          : undefined,
        prompt: [{ type: 'text', text: payload }, { type: 'image', attachment }],
        outputSchema: recommendationSchema as never,
      }), reviewSignal);
      try {
        const result = await abortable(run.result, reviewSignal);
        const semantic = result.stopReason === 'completed' ? validateRecommendation(result.structured, segments) : null;
        if (!semantic) throw new Error('AI_GDT_REVIEW_INVALID');
        const completed = completeShaftGdtRecommendation(partition, semantic);
        return {
          ...groundSegmentRecommendation(
          drawing.document.geometry,
          partition,
          completed,
          ),
          coverage: evaluateShaftGdtCoverage(partition, completed),
        };
      } finally {
        await abortable(run.dispose(), reviewSignal).catch(() => undefined);
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Enforces the generic shaft GD&T coverage policy after AI semantic review.
 * The policy is driven only by functional segment roles; it contains no
 * sample drawing identities, coordinates, or tolerance magnitudes.
 */
export function completeShaftGdtRecommendation(
  partition: ShaftPartition,
  reviewed: SemanticRecommendation,
): SemanticRecommendation {
  const features = classifyPolicyFeatures(partition.segments);
  if (features.bearings.length < 2) return structuredClone(reviewed);
  const left = features.bearings[0]!;
  const right = features.bearings.at(-1)!;
  const datums: SemanticRecommendation['datums'] = [
    { name: 'A', segmentId: right.id, role: 'primary', confidence: 1 },
    { name: 'B', segmentId: left.id, role: 'secondary', confidence: 1 },
  ];
  const controls: SemanticRecommendation['controls'] = [];
  for (const segment of features.bearings) {
    controls.push(policyControl(segment, 'circularity', []));
    controls.push(policyControl(segment, 'cylindricity', []));
    controls.push(policyControl(segment, 'circular-runout', ['A', 'B']));
  }
  for (const segment of features.rotary) {
    controls.push(policyControl(segment, 'circular-runout', ['A', 'B'], 'positive-locating-shoulder'));
  }
  return { datums, controls };
}

export function evaluateShaftGdtCoverage(
  partition: ShaftPartition,
  recommendation: SemanticRecommendation,
): { complete: boolean; requiredDatumCount: number; requiredControlCount: number } {
  const expected = completeShaftGdtRecommendation(partition, { datums: [], controls: [] });
  const actualDatums = new Set(recommendation.datums.map(({ name, segmentId }) => `${name}:${segmentId}`));
  const actualControls = new Set(recommendation.controls.map(controlIdentity));
  return {
    complete: expected.datums.every(({ name, segmentId }) => actualDatums.has(`${name}:${segmentId}`))
      && expected.controls.every((control) => actualControls.has(controlIdentity(control))),
    requiredDatumCount: expected.datums.length,
    requiredControlCount: expected.controls.length,
  };
}

function classifyPolicyFeatures(segments: readonly ShaftPartitionSegment[]): {
  bearings: ShaftPartitionSegment[];
  rotary: ShaftPartitionSegment[];
} {
  const ordered = [...segments].sort((left, right) => left.zStart - right.zStart);
  const bearings = ordered.filter((segment) => semanticRole(segment) === 'bearing');
  const rotary = ordered.filter((segment) => {
    const role = semanticRole(segment);
    return role === 'gear' || role === 'spline';
  });
  return { bearings, rotary };
}

function semanticRole(segment: ShaftPartitionSegment): 'bearing' | 'gear' | 'spline' | 'other' {
  const value = `${segment.semanticType ?? ''} ${segment.name ?? ''}`.toLowerCase();
  if (value.includes('bearing') || value.includes('轴承')) return 'bearing';
  if (value.includes('gear') || value.includes('齿轮')) return 'gear';
  if (value.includes('spline') || value.includes('花键')) return 'spline';
  return 'other';
}

function policyControl(
  segment: ShaftPartitionSegment,
  characteristic: GeometricCharacteristic,
  datumNames: string[],
  surfaceRole: SemanticRecommendation['controls'][number]['surfaceRole'] = 'segment-surface',
): SemanticRecommendation['controls'][number] {
  return {
    id: `gdt:shaft:${stableId(segment.id)}:${characteristic}:${surfaceRole}`,
    characteristic,
    segmentIds: [segment.id],
    surfaceRole,
    datumNames,
    toleranceZoneShape: 'linear',
    confidence: 1,
  };
}

function stableId(value: string): string { return value.replace(/[^a-zA-Z0-9_.-]+/g, '-'); }
function controlIdentity(control: SemanticRecommendation['controls'][number]): string {
  return `${control.characteristic}:${control.surfaceRole ?? 'segment-surface'}:${[...control.segmentIds].sort().join(',')}:${control.datumNames.join(',')}`;
}

export function groundSegmentRecommendation(
  geometry: readonly GeometryNode[],
  partition: ShaftPartition,
  recommendation: SemanticRecommendation,
): GdtRecommendation {
  const segmentById = new Map(partition.segments.map((segment) => [segment.id, segment]));
  const nodeById = new Map(geometry.filter(({ visible }) => visible).map((node) => [String(node.id), node]));
  const datums = recommendation.datums.map((item) => {
    const segment = requireSegment(segmentById, item.segmentId);
    return {
      name: item.name,
      geometryId: selectRepresentativeGeometry(segment, nodeById, partition.axis, 'axial-bottom'),
      role: item.role,
    };
  });
  const controls = recommendation.controls.map((item) => ({
    id: item.id,
    characteristic: item.characteristic,
    geometryIds: [...new Set(item.segmentIds.map((segmentId) => {
      const segment = requireSegment(segmentById, segmentId);
      return item.surfaceRole === 'positive-locating-shoulder'
        ? selectPositiveLocatingShoulderGeometry(segment, partition.segments, nodeById, partition.axis)
        : selectRepresentativeGeometry(
          segment, nodeById, partition.axis,
          prefersRadialSurface(item.characteristic) ? 'radial' : 'axial',
        );
    }))],
    datumNames: [...item.datumNames],
    toleranceZoneShape: item.toleranceZoneShape,
    ...(item.materialCondition === undefined ? {} : { materialCondition: item.materialCondition }),
  }));
  return { datums, controls };
}

function selectPositiveLocatingShoulderGeometry(
  feature: ShaftPartitionSegment,
  segments: readonly ShaftPartitionSegment[],
  nodes: ReadonlyMap<string, GeometryNode>,
  axis: ShaftPartition['axis'],
): string {
  const station = positiveLocatingShoulderStation(feature, segments);
  const stationTolerance = Math.max(0.05, Math.abs(axis.zMax - axis.zMin) * 0.0015);
  let selected: { node: GeometryNode & { type: 'line' }; score: number } | null = null;
  for (const node of nodes.values()) {
    if (node.type !== 'line') continue;
    const delta: Vec2 = [node.end[0] - node.start[0], node.end[1] - node.start[1]];
    const axialSpan = Math.abs(dot(delta, axis.direction));
    const radialSpan = Math.abs(dot(delta, axis.normal));
    if (radialSpan <= axialSpan * 2 || radialSpan < stationTolerance) continue;
    const midpoint: Vec2 = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    const midpointZ = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.direction);
    const stationError = Math.abs(midpointZ - station);
    if (stationError > stationTolerance) continue;
    // A complete annular shoulder projects as the longest radial line at the
    // selected station. This naturally rejects tooth edges, fillets and
    // relief details without encoding any drawing-specific coordinates.
    const score = radialSpan - axialSpan - stationError * 1_000;
    if (!selected || score > selected.score) selected = { node, score };
  }
  if (selected) return String(selected.node.id);
  return selectRepresentativeGeometry(feature, nodes, axis, 'radial');
}

function positiveLocatingShoulderStation(
  feature: ShaftPartitionSegment,
  segments: readonly ShaftPartitionSegment[],
): number {
  const ordered = [...segments].sort((left, right) => left.zStart - right.zStart);
  const index = ordered.findIndex(({ id }) => id === feature.id);
  const next = index < 0 ? undefined : ordered[index + 1];
  if (!next || Math.abs(next.zStart - feature.zEnd) > Math.max(0.05, (feature.zEnd - feature.zStart) * 0.005)) {
    return feature.zEnd;
  }
  const transitionWidth = next.zEnd - next.zStart;
  const maximumReliefWidth = Math.max(0.5, Math.min(8, (feature.zEnd - feature.zStart) * 0.2));
  return semanticRole(next) === 'other' && transitionWidth <= maximumReliefWidth
    ? next.zEnd
    : feature.zEnd;
}

function selectRepresentativeGeometry(
  segment: ShaftPartitionSegment,
  nodes: ReadonlyMap<string, GeometryNode>,
  axis: ShaftPartition['axis'],
  preference: 'axial' | 'axial-bottom' | 'radial',
): string {
  const candidates = segment.geometryNodeIds.map((id) => nodes.get(String(id))).filter((node) => node !== undefined);
  if (candidates.length === 0) throw new Error(`GDT_SEGMENT_GEOMETRY_REQUIRED:${segment.id}`);
  return String(candidates.reduce((best, node) => scoreNode(node, axis, segment, preference) > scoreNode(best, axis, segment, preference) ? node : best).id);
}

function scoreNode(
  node: GeometryNode,
  axis: ShaftPartition['axis'],
  segment: ShaftPartitionSegment,
  preference: 'axial' | 'axial-bottom' | 'radial',
): number {
  if (node.type !== 'line') return 0.01;
  const delta: Vec2 = [node.end[0] - node.start[0], node.end[1] - node.start[1]];
  const axial = Math.abs(dot(delta, axis.direction));
  const radial = Math.abs(dot(delta, axis.normal));
  const midpoint: Vec2 = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
  const midpointZ = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.direction);
  const segmentWidth = Math.max(segment.zEnd - segment.zStart, 1e-6);
  const outsideDistance = midpointZ < segment.zStart ? segment.zStart - midpointZ
    : midpointZ > segment.zEnd ? midpointZ - segment.zEnd : 0;
  const excessAxialSpan = Math.max(0, axial - segmentWidth * 1.25);
  const locality = (outsideDistance === 0 ? 1_000 : -outsideDistance * 100) - excessAxialSpan * 10;
  if (preference === 'radial') return locality + radial - axial * 0.1;
  const signedRadius = dot([midpoint[0] - axis.origin[0], midpoint[1] - axis.origin[1]], axis.normal);
  return locality + axial - radial * 0.1 + (preference === 'axial-bottom' ? -signedRadius * 0.001 : 0);
}

function prefersRadialSurface(value: GeometricCharacteristic): boolean {
  return value === 'flatness' || value === 'perpendicularity' || value === 'angularity' || value === 'parallelism';
}

function requireSegment(values: ReadonlyMap<string, ShaftPartitionSegment>, id: string): ShaftPartitionSegment {
  const value = values.get(id);
  if (!value) throw new Error(`GDT_SEGMENT_UNKNOWN:${id}`);
  return value;
}

function validateRecommendation(value: unknown, segments: readonly ShaftPartitionSegment[]): SemanticRecommendation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SemanticRecommendation>;
  if (!Array.isArray(candidate.datums) || !Array.isArray(candidate.controls)) return null;
  const allowedSegments = new Set(segments.map(({ id }) => id));
  const datums = candidate.datums.filter((item) => item && item.confidence >= 0.8 && allowedSegments.has(item.segmentId));
  const datumNames = new Set(datums.map(({ name }) => name));
  const controls = candidate.controls.filter((item) => item && item.confidence >= 0.8
    && item.segmentIds.length > 0 && item.segmentIds.every((id) => allowedSegments.has(id))
    && item.datumNames.every((name) => datumNames.has(name)));
  if (datums.length === 0 || controls.length === 0) return null;
  return { datums: structuredClone(datums), controls: structuredClone(controls) };
}

const CHARACTERISTICS = [
  'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface',
  'parallelism', 'perpendicularity', 'angularity', 'position', 'coaxiality', 'symmetry',
  'circular-runout', 'total-runout',
] as const;

const recommendationSchema = {
  type: 'object', additionalProperties: false, required: ['datums', 'controls'],
  properties: {
    datums: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['name', 'segmentId', 'role', 'confidence'], properties: {
        name: { type: 'string' }, segmentId: { type: 'string' },
        role: { type: 'string', enum: ['primary', 'secondary', 'tertiary', 'origin'] }, confidence: { type: 'number' },
      } } },
    controls: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'characteristic', 'segmentIds', 'datumNames', 'toleranceZoneShape', 'confidence'], properties: {
        id: { type: 'string' }, characteristic: { type: 'string', enum: CHARACTERISTICS },
        segmentIds: { type: 'array', items: { type: 'string' } }, datumNames: { type: 'array', items: { type: 'string' } },
        toleranceZoneShape: { type: 'string', enum: ['linear', 'diametrical', 'spherical'] },
        materialCondition: { type: 'string', enum: ['rfs', 'mmc', 'lmc'] }, confidence: { type: 'number' },
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
