// SPDX-License-Identifier: Apache-2.0

import type { GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type {
  EngineeringAnnotationDraft,
  EngineeringDatum,
  GeometricCharacteristic,
  GeometricToleranceIntent,
  MaterialCondition,
  SurfaceTextureIntent,
  ToleranceZoneShape,
} from '@vectorai/engineering-annotation';
import type { DrawingWorkspaceSnapshot } from '@vectorai/drawing-workspace';
import type { GdtClarificationQuestion } from './shaft-gdt-rules';

export interface GdtRecommendation {
  datums: Array<{ name: string; geometryId: string; role: EngineeringDatum['role'] }>;
  controls: Array<{
    id: string;
    characteristic: GeometricCharacteristic;
    geometryIds: string[];
    datumNames: string[];
    toleranceZoneShape: ToleranceZoneShape;
    materialCondition?: MaterialCondition;
  }>;
  surfaceTextures?: Array<{
    id: string;
    geometryIds: string[];
    parameter: SurfaceTextureIntent['parameter'];
    value: number;
    materialRemoval: SurfaceTextureIntent['materialRemoval'];
    source: 'process-rule' | 'ai-candidate';
    confidence: number;
    ruleRef?: { id: string; version: string };
  }>;
  coverage?: {
    complete: boolean;
    requiredDatumCount: number;
    requiredControlCount: number;
    status?: 'resolved' | 'needs-user-input';
    questions?: GdtClarificationQuestion[];
  };
}

export function groundGdtRecommendation(
  snapshot: DrawingWorkspaceSnapshot,
  recommendation: GdtRecommendation,
): Pick<EngineeringAnnotationDraft, 'datums' | 'geometricTolerances' | 'surfaceTextures'> {
  const geometry = new Map(snapshot.document.geometry.map((node) => [String(node.id), node]));
  const datums: EngineeringDatum[] = recommendation.datums.map((item) => {
    const node = requireGeometry(geometry, item.geometryId);
    return {
      id: `datum:${item.name}`,
      drawingRef: structuredClone(snapshot.ref),
      name: item.name,
      geometryId: node.id,
      anchor: { kind: 'nearest', point: representativePoint(node) },
      role: item.role,
      source: 'ai-candidate',
      status: 'candidate',
      evidenceIds: node.quality.evidenceRefs.map(String),
    };
  });
  const datumsByName = new Map(datums.map((datum) => [datum.name, datum]));
  const geometricTolerances: GeometricToleranceIntent[] = recommendation.controls.map((item) => {
    const nodes = item.geometryIds.map((id) => requireGeometry(geometry, id));
    const datumReferenceFrame = item.datumNames.map((name) => {
      const datum = datumsByName.get(name);
      if (!datum) throw new Error(`GDT_DATUM_UNKNOWN:${name}`);
      return { datumId: datum.id };
    });
    return {
      id: item.id,
      drawingRef: structuredClone(snapshot.ref),
      characteristic: item.characteristic,
      controlledTargets: nodes.map((node) => ({
        geometryId: node.id,
        anchor: { kind: 'nearest' as const, point: representativePoint(node) },
      })),
      toleranceZone: {
        shape: item.toleranceZoneShape,
        ...(item.materialCondition === undefined ? {} : { materialCondition: item.materialCondition }),
      },
      datumReferenceFrame,
      computed: { status: 'pending', unit: 'mm', diagnostics: [] },
      source: 'ai-candidate',
      status: 'pending-calculation',
      evidenceIds: [...new Set(nodes.flatMap(({ quality }) => quality.evidenceRefs.map(String)))],
    };
  });
  const surfaceTextures: SurfaceTextureIntent[] = (recommendation.surfaceTextures ?? []).map((item) => {
    const nodes = item.geometryIds.map((id) => requireGeometry(geometry, id));
    return {
      id: item.id,
      drawingRef: structuredClone(snapshot.ref),
      controlledTargets: nodes.map((node) => ({
        geometryId: node.id,
        anchor: { kind: 'nearest' as const, point: representativePoint(node) },
      })),
      parameter: item.parameter,
      value: item.value,
      unit: 'um',
      materialRemoval: item.materialRemoval,
      source: item.source,
      status: 'candidate',
      evidenceIds: [...new Set(nodes.flatMap(({ quality }) => quality.evidenceRefs.map(String)))],
      ...(item.ruleRef === undefined ? {} : { ruleRef: structuredClone(item.ruleRef) }),
    };
  });
  return { datums, geometricTolerances, surfaceTextures };
}

function requireGeometry(geometry: ReadonlyMap<string, GeometryNode>, id: string): GeometryNode {
  const node = geometry.get(id);
  if (!node || !node.visible) throw new Error(`GDT_GEOMETRY_UNKNOWN:${id}`);
  return node;
}

function representativePoint(node: GeometryNode): Vec2 {
  switch (node.type) {
    case 'point': return [node.x, node.y];
    case 'line': return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case 'ray': case 'xline': return [...node.origin];
    case 'circle': case 'arc': return [node.center[0] + node.radius, node.center[1]];
    case 'ellipse': return [node.center[0] + node.majorAxis[0], node.center[1] + node.majorAxis[1]];
    case 'polyline': return node.vertices[0]?.point ? [...node.vertices[0].point] : [0, 0];
    case 'spline': return node.controlPoints[0] ? [...node.controlPoints[0]] : [0, 0];
  }
}
