// SPDX-License-Identifier: Apache-2.0

import type { StepCandidate } from '../partition/types';
import type { ShaftProfile } from './profile';

export function detectShaftSteps(profile: ShaftProfile): StepCandidate[] {
  const tolerance = Math.max(Math.abs(profile.axis.zMax - profile.axis.zMin) * 1e-5, 1e-6);
  const candidates = [
    { z: profile.axis.zMin, score: 1, geometryNodeIds: [] as string[] },
    ...profile.topology.transitions.map(({ z, radialSpan, geometryNodeIds, confidence }) => ({
      z, score: confidence, geometryNodeIds, confidenceBreakdown: confidenceAt(profile, z, radialSpan),
    })),
    { z: profile.axis.zMax, score: 1, geometryNodeIds: [] as string[] },
  ].sort((a, b) => a.z - b.z);
  const clustered: typeof candidates = [];
  for (const candidate of candidates) {
    const previous = clustered.at(-1);
    if (previous && Math.abs(previous.z - candidate.z) <= tolerance) {
      if (candidate.score > previous.score) previous.score = candidate.score;
      previous.geometryNodeIds = [...new Set([...previous.geometryNodeIds, ...candidate.geometryNodeIds])];
    } else clustered.push({ ...candidate });
  }
  return clustered.map(({ z, score, geometryNodeIds, ...metadata }, index) => {
    const coordinate = index === 0 ? profile.axis.zMin : index === clustered.length - 1 ? profile.axis.zMax : z;
    return {
      id: `step:${canonical(coordinate)}`,
      z: Number(canonical(coordinate)), score,
      evidenceIds: geometryNodeIds.map((id) => `geometry:${id}`),
      accepted: index === 0 || index === clustered.length - 1 || score >= 0.45,
      policyVersion: 'shaft-step-confidence-v1' as const,
      ...metadata,
    };
  });
}

function confidenceAt(profile: ShaftProfile, z: number, radialSpan: number) {
  const tolerance = Math.max((profile.axis.zMax - profile.axis.zMin) * 1e-5, 1e-6);
  const touches = (items: ShaftProfile['topology']['positiveProfile']) => items.filter((span) => (
    Math.abs(span.zStart - z) <= tolerance * 12 || Math.abs(span.zEnd - z) <= tolerance * 12
  ));
  const positive = touches(profile.topology.positiveProfile);
  const negative = touches(profile.topology.negativeProfile);
  const adjacent = [...positive, ...negative];
  const residence = adjacent.length === 0 ? 0 : Math.min(1,
    Math.min(...adjacent.map((span) => span.zEnd - span.zStart))
      / Math.max((profile.axis.zMax - profile.axis.zMin) * 0.03, tolerance));
  return {
    contourContinuity: Math.min(1, adjacent.length / 4),
    bilateralCorrespondence: Math.min(1, Math.min(positive.length, negative.length) / 2),
    axialResidence: residence,
    radiusChange: Math.min(1, radialSpan / Math.max(profile.maxRadius * 0.2, tolerance)),
    entityQuality: adjacent.length === 0 ? 0 : adjacent.reduce((sum, span) => sum + span.confidence, 0) / adjacent.length,
  };
}

function canonical(value: number): string { return Number(value.toFixed(6)).toString(); }
