import { createHash } from 'node:crypto';

import type {
  EvidenceId,
  FeatureId,
  GeometryId,
  GeometryNode,
  SemanticFeature,
  Vec2,
} from '../../../src/drawing/index.js';
import type { EngineeringDocument, EngineeringRegion } from './engineering-document.js';
import type { DxfProjection } from './projector.js';
import type { DxfEntityRecord, DxfManifest, DxfPair } from './types.js';

export interface DxfRegionRecognition {
  id: string;
  type: string;
  status: 'confirmed' | 'candidate' | 'conflict';
  reasons: string[];
  expected: { centerZ: number; width: number; outerDiameter?: number };
  observed: { centerZ?: number; width?: number; outerDiameter?: number };
}

export interface DxfRecognition {
  unit: 'mm' | 'cm' | 'm';
  mainAxis: {
    origin: Vec2;
    direction: Vec2;
    y: number;
    status: 'confirmed' | 'candidate';
    evidence: 'explicit-centerline' | 'geometry-envelope';
  };
  overallLength: number;
  geometry: GeometryNode[];
  features: SemanticFeature[];
  regions: DxfRegionRecognition[];
}

interface DimensionFact {
  handle?: string;
  orientation: 'axial' | 'diameter';
  value: number;
  first: number;
  second: number;
  x: number;
  text?: string;
}

export function recognizeDxfFacts(input: {
  sourceId: string;
  manifest: DxfManifest;
  projection: DxfProjection;
  engineeringDocument?: EngineeringDocument;
  engineeringSourceId?: string;
}): DxfRecognition {
  const sourceEvidence = `dxf:${input.sourceId}:manifest` as EvidenceId;
  const engineeringEvidence = input.engineeringSourceId
    ? `engineering-document:${input.engineeringSourceId}` as EvidenceId
    : undefined;
  const facts = dimensionFacts(input.manifest.entities);
  const axialFacts = facts.filter((fact) => fact.orientation === 'axial');
  const envelope = projectionBounds(input.projection.geometry);
  const overallFact = [...axialFacts].sort((left, right) => right.value - left.value)[0];
  const left = overallFact ? Math.min(overallFact.first, overallFact.second) : envelope.minX;
  const right = overallFact ? Math.max(overallFact.first, overallFact.second) : envelope.maxX;
  const overallLength = clean(right - left);
  const explicitAxis = longestExplicitAxis(input.manifest.entities);
  const axisY = explicitAxis?.y ?? clean((envelope.minY + envelope.maxY) / 2);
  const axisStatus = explicitAxis ? 'confirmed' as const : 'candidate' as const;
  const axisId = stableId('geometry', `${input.sourceId}:main-axis`) as GeometryId;
  const axisGeometry: GeometryNode = {
    id: axisId,
    type: 'xline',
    visible: true,
    quality: {
      status: axisStatus,
      confidence: explicitAxis ? 1 : 0.8,
      evidenceRefs: [sourceEvidence],
    },
    origin: [left, axisY],
    direction: [1, 0],
  };
  const unit = dxfUnit(input.manifest);
  const regions = input.engineeringDocument
    ? recognizeRegions({
      regions: input.engineeringDocument.regions,
      facts,
      leftOrigin: left,
      overallLength,
    })
    : [];
  const baseEvidence = engineeringEvidence
    ? [sourceEvidence, engineeringEvidence]
    : [sourceEvidence];
  const features: SemanticFeature[] = [
    feature({
      sourceId: input.sourceId,
      key: 'import',
      semanticType: 'dxf-import',
      status: 'confirmed',
      evidenceRefs: [sourceEvidence],
      properties: {
        sourceId: input.sourceId,
        unit,
        blockCount: input.manifest.blocks.length,
        modelSpaceEntityCount: input.manifest.entities.length,
        projectedGeometryCount: input.projection.geometry.length,
        projectedAnnotationCount: input.projection.annotations.length,
        xdataApplications: xdataApplications(input.manifest),
      },
    }),
    feature({
      sourceId: input.sourceId,
      key: 'main-axis',
      semanticType: 'main-axis',
      status: axisStatus,
      evidenceRefs: [sourceEvidence],
      geometryIds: [axisId],
      properties: {
        recognitionStatus: axisStatus,
        origin: [left, axisY],
        direction: [1, 0],
        evidence: explicitAxis ? 'explicit-centerline' : 'geometry-envelope',
      },
    }),
    feature({
      sourceId: input.sourceId,
      key: 'axial-envelope',
      semanticType: 'axial-envelope',
      status: overallFact ? 'confirmed' : 'candidate',
      evidenceRefs: [sourceEvidence],
      properties: {
        recognitionStatus: overallFact ? 'confirmed' : 'candidate',
        left,
        right,
        length: overallLength,
        evidence: overallFact ? 'explicit-dimension' : 'geometry-envelope',
      },
    }),
    ...regions.map((region) => feature({
      sourceId: input.sourceId,
      key: `region:${region.id}`,
      semanticType: 'engineering-region',
      status: region.status === 'confirmed' ? 'confirmed' : 'candidate',
      evidenceRefs: baseEvidence,
      properties: {
        regionId: region.id,
        regionType: region.type,
        recognitionStatus: region.status,
        expected: region.expected,
        observed: region.observed,
        reasons: region.reasons,
      },
    })),
  ];

  return {
    unit,
    mainAxis: {
      origin: [left, axisY],
      direction: [1, 0],
      y: axisY,
      status: axisStatus,
      evidence: explicitAxis ? 'explicit-centerline' : 'geometry-envelope',
    },
    overallLength,
    geometry: [axisGeometry],
    features,
    regions,
  };
}

function recognizeRegions(input: {
  regions: EngineeringRegion[];
  facts: DimensionFact[];
  leftOrigin: number;
  overallLength: number;
}): DxfRegionRecognition[] {
  const positionTolerance = Math.max(0.05, input.overallLength * 0.002);
  const valueTolerance = Math.max(0.05, input.overallLength * 0.001);
  const axial = input.facts.filter((fact) => fact.orientation === 'axial');
  const diameters = input.facts.filter((fact) => fact.orientation === 'diameter');

  return input.regions.map((region) => {
    const reasons: string[] = [];
    const observed: DxfRegionRecognition['observed'] = {};
    let conflict = false;
    let widthConfirmed = false;
    let diameterConfirmed = region.outerDiameter === undefined;
    const expectedLeft = input.leftOrigin + region.centerZ - region.width / 2;
    const expectedRight = input.leftOrigin + region.centerZ + region.width / 2;
    const widthFact = axial
      .filter((fact) => Math.abs(fact.value - region.width) <= valueTolerance)
      .sort((first, second) => Math.abs(first.value - region.width) - Math.abs(second.value - region.width))[0];
    if (widthFact) {
      const centerZ = clean((widthFact.first + widthFact.second) / 2 - input.leftOrigin);
      observed.width = clean(widthFact.value);
      observed.centerZ = centerZ;
      widthConfirmed = Math.abs(widthFact.value - region.width) <= valueTolerance
        && Math.abs(centerZ - region.centerZ) <= positionTolerance;
      if (widthConfirmed) {
        reasons.push(`轴向宽度 ${format(widthFact.value)} 与中心 ${format(centerZ)} 已由显式尺寸核验`);
      } else {
        conflict = true;
        reasons.push(
          `文档中心 ${format(region.centerZ)}，显式宽度尺寸中心 ${format(centerZ)} 不一致`,
        );
      }
    } else {
      reasons.push('未找到可唯一核验的轴向宽度尺寸');
    }

    if (region.outerDiameter !== undefined) {
      const localDiameterFacts = diameters
        .filter((fact) => fact.x >= expectedLeft - positionTolerance
          && fact.x <= expectedRight + positionTolerance)
        .sort((first, second) => Math.abs(first.value - (region.outerDiameter ?? 0))
          - Math.abs(second.value - (region.outerDiameter ?? 0)));
      const diameterFact = localDiameterFacts[0];
      if (diameterFact) {
        observed.outerDiameter = clean(diameterFact.value);
        diameterConfirmed = Math.abs(diameterFact.value - region.outerDiameter) <= valueTolerance;
        if (diameterConfirmed) {
          reasons.push(`外径 ${format(diameterFact.value)} 已由显式直径尺寸核验`);
        } else {
          conflict = true;
          reasons.push(
            `文档外径 ${format(region.outerDiameter)}，显式直径 ${format(diameterFact.value)} 不一致`,
          );
        }
      } else {
        reasons.push('未找到位于目标区间内的显式直径尺寸');
      }
    }

    return {
      id: region.id,
      type: region.type,
      status: conflict ? 'conflict' : widthConfirmed && diameterConfirmed ? 'confirmed' : 'candidate',
      reasons,
      expected: {
        centerZ: region.centerZ,
        width: region.width,
        ...(region.outerDiameter === undefined ? {} : { outerDiameter: region.outerDiameter }),
      },
      observed,
    };
  });
}

function dimensionFacts(entities: DxfEntityRecord[]): DimensionFact[] {
  return entities.flatMap((entity): DimensionFact[] => {
    if (entity.type !== 'DIMENSION') return [];
    const kind = integerValue(entity.pairs, 70, 0) & 7;
    if (kind !== 0 && kind !== 1) return [];
    const first = point(entity.pairs, 13, 23);
    const second = point(entity.pairs, 14, 24);
    if (!first || !second) return [];
    const angle = numberValue(entity.pairs, 50, 0) * Math.PI / 180;
    const axial = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle));
    const measured = axial ? Math.abs(second[0] - first[0]) : Math.abs(second[1] - first[1]);
    if (!(measured > 1e-8)) return [];
    return [{
      ...(entity.handle ? { handle: entity.handle } : {}),
      orientation: axial ? 'axial' : 'diameter',
      value: clean(measured),
      first: axial ? first[0] : first[1],
      second: axial ? second[0] : second[1],
      x: clean((first[0] + second[0]) / 2),
      ...(value(entity.pairs, 1) ? { text: value(entity.pairs, 1) } : {}),
    }];
  });
}

function longestExplicitAxis(entities: DxfEntityRecord[]): { y: number; length: number } | undefined {
  return entities.flatMap((entity) => {
    if (entity.type !== 'LINE') return [];
    const layer = value(entity.pairs, 8) ?? '';
    if (!/中心|center|centre|axis/i.test(layer)) return [];
    const start = point(entity.pairs, 10, 20);
    const end = point(entity.pairs, 11, 21);
    if (!start || !end) return [];
    const dx = Math.abs(end[0] - start[0]);
    const dy = Math.abs(end[1] - start[1]);
    if (dx <= 0 || dy > dx * 1e-5) return [];
    return [{ y: clean((start[1] + end[1]) / 2), length: dx }];
  }).sort((left, right) => right.length - left.length)[0];
}

function projectionBounds(geometry: GeometryNode[]) {
  const points: Vec2[] = [];
  for (const node of geometry) {
    switch (node.type) {
      case 'point': points.push([node.x, node.y]); break;
      case 'line': points.push(node.start, node.end); break;
      case 'circle':
      case 'arc':
        points.push(
          [node.center[0] - node.radius, node.center[1] - node.radius],
          [node.center[0] + node.radius, node.center[1] + node.radius],
        );
        break;
      case 'ellipse': {
        const radius = Math.hypot(...node.majorAxis);
        points.push(
          [node.center[0] - radius, node.center[1] - radius],
          [node.center[0] + radius, node.center[1] + radius],
        );
        break;
      }
      case 'polyline': points.push(...node.vertices.map((vertex) => vertex.point)); break;
      case 'spline': points.push(...node.controlPoints); break;
      case 'ray':
      case 'xline':
        break;
    }
  }
  if (points.length === 0) throw new Error('DXF_RECOGNITION_GEOMETRY_EMPTY');
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function dxfUnit(manifest: DxfManifest): 'mm' | 'cm' | 'm' {
  const raw = manifest.header.$INSUNITS?.find((pair) => pair.code === 70)?.value;
  const code = raw === undefined ? 0 : Number.parseInt(raw.trim(), 10);
  if (code === 5) return 'cm';
  if (code === 6) return 'm';
  return 'mm';
}

function xdataApplications(manifest: DxfManifest): string[] {
  return [...new Set([
    ...manifest.entities,
    ...manifest.blocks.flatMap((block) => block.entities),
  ].flatMap((entity) => entity.xdata.map((segment) => segment.application)))].sort();
}

function feature(input: {
  sourceId: string;
  key: string;
  semanticType: string;
  status: 'confirmed' | 'candidate';
  evidenceRefs: EvidenceId[];
  geometryIds?: GeometryId[];
  properties: Record<string, unknown>;
}): SemanticFeature {
  return {
    id: stableId('feature', `${input.sourceId}:${input.key}`) as FeatureId,
    type: 'feature',
    visible: true,
    quality: {
      status: input.status,
      confidence: input.status === 'confirmed' ? 1 : 0.65,
      evidenceRefs: input.evidenceRefs,
    },
    semanticType: input.semanticType,
    geometryIds: input.geometryIds ?? [],
    annotationIds: [],
    relationIds: [],
    properties: input.properties,
  };
}

function stableId(plane: 'geometry' | 'feature', seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 24);
  return `${plane === 'geometry' ? 'geo' : 'feature'}_dxf_${digest}`;
}

function point(pairs: DxfPair[], xCode: number, yCode: number): Vec2 | undefined {
  const x = numberValue(pairs, xCode, Number.NaN);
  const y = numberValue(pairs, yCode, Number.NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

function value(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}

function numberValue(pairs: DxfPair[], code: number, fallback: number): number {
  const raw = value(pairs, code);
  const parsed = raw === undefined ? Number.NaN : Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(pairs: DxfPair[], code: number, fallback: number): number {
  return Math.trunc(numberValue(pairs, code, fallback));
}

function clean(input: number): number {
  if (Math.abs(input) < 1e-12) return 0;
  const nearest = Math.round(input);
  return Math.abs(input - nearest) < 1e-10 ? nearest : input;
}

function format(input: number): string {
  return String(Math.round(input * 1000) / 1000);
}
