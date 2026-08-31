// SPDX-License-Identifier: Apache-2.0

import type { StepCandidate } from '../partition/types';
import type { ShaftProfile } from './profile';

export function detectShaftSteps(profile: ShaftProfile): StepCandidate[] {
  const tolerance = Math.max(Math.abs(profile.axis.zMax - profile.axis.zMin) * 1e-5, 1e-6);
  const candidates = [
    { z: profile.axis.zMin, score: 1, geometryNodeIds: [] as string[] },
    ...profile.shoulders.map(({ z, radialSpan, geometryNodeIds }) => ({
      z, score: Math.min(0.99, 0.35 + radialSpan / Math.max(profile.maxRadius, 1) * 0.65), geometryNodeIds,
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
  return clustered.map(({ z, score, geometryNodeIds }, index) => {
    const coordinate = index === 0 ? profile.axis.zMin : index === clustered.length - 1 ? profile.axis.zMax : z;
    return {
      id: `step:${canonical(coordinate)}`,
      z: Number(canonical(coordinate)), score,
      evidenceIds: geometryNodeIds.map((id) => `geometry:${id}`),
      accepted: index === 0 || index === clustered.length - 1 || score >= 0.45,
    };
  });
}

function canonical(value: number): string { return Number(value.toFixed(6)).toString(); }
