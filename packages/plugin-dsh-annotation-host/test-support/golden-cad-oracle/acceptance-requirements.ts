// SPDX-License-Identifier: Apache-2.0
/**
 * TEST-ONLY explicit engineering requirements transcribed from the user-provided
 * golden drawing. No paper coordinates, target DXF geometry, or oracle imports.
 * These values are NOT contained in engineering-data.ini and are NOT defaults.
 */
export const GOLDEN_REQUIREMENTS = {
  evidenceId: 'requirement:user-golden-reference-2026-09-05',
  authority: 'user-confirmed-acceptance-fixture-only',
  dimensions: [
    { id: 'bearing.left.diameter', kind: 'diameter', nominal: 35, interval: [0, 17], deviations: [0.033, 0.017] },
    { id: 'bearing.right.diameter', kind: 'diameter', nominal: 35, interval: [150, 173], deviations: [0.033, 0.017] },
    { id: 'spline.outer-span', kind: 'diameter', nominal: 44.59, interval: [17, 41.5], deviations: [0, -0.15] },
    { id: 'spline.root-span', kind: 'diameter', nominal: 42.21, interval: [17, 41.5], deviations: [0, -0.2] },
    { id: 'relief.diameter38', kind: 'diameter', nominal: 38, interval: [41.5, 45] },
    { id: 'shoulder.diameter51', kind: 'diameter', nominal: 51, interval: [45, 53], deviations: [0, -0.2] },
    { id: 'middle.diameter40', kind: 'diameter', nominal: 40, interval: [53, 92] },
    { id: 'relief.diameter48', kind: 'diameter', nominal: 48, interval: [147, 150] },
    { id: 'bore.diameter20', kind: 'diameter', nominal: 20, interval: [3, 170] },
    { id: 'gear.outer-span', kind: 'linear', nominal: 57.03, interval: [92, 147], deviations: [0, -0.1], transverse: true },
  ],
  axial: [
    { id: 'axial.left-bearing-width', interval: [0, 17], nominal: 17, deviations: [0, -0.15] },
    { id: 'axial.spline-width', interval: [17, 41.5], nominal: 24.5, deviations: [0.1, -0.1] },
    { id: 'axial.left-stack', interval: [17, 45], nominal: 28, deviations: [-0.1, -0.2] },
    { id: 'axial.shoulder-width', interval: [45, 53], nominal: 8 },
    { id: 'axial.main-stack', interval: [45, 150], nominal: 105, deviations: [0, -0.15] },
    { id: 'axial.gear-width', interval: [92, 147], nominal: 55, deviations: [0.1, -0.1] },
    { id: 'axial.relief-width', interval: [147, 150], nominal: 3 },
    { id: 'axial.overall', interval: [0, 173], nominal: 173, deviations: [0, -0.2] },
  ],
  omittedClosureIntervals: [[41.5, 45], [53, 92], [150, 173]],
  openingDepths: [
    { id: 'left-opening.depth1', interval: [0, 1], nominal: 1 },
    { id: 'left-opening.depth3', interval: [0, 3], nominal: 3 },
    { id: 'right-opening.depth1', interval: [172, 173], nominal: 1 },
    { id: 'right-opening.depth3', interval: [170, 173], nominal: 3 },
  ],
  datums: [
    { id: 'datum:right', name: 'A', feature: 'right-bearing', role: 'primary' },
    { id: 'datum:left', name: 'B', feature: 'left-bearing', role: 'secondary' },
  ],
  gdt: [
    { feature: 'right-bearing', characteristic: 'circularity', value: 0.003, commonDatum: false },
    { feature: 'right-bearing', characteristic: 'cylindricity', value: 0.005, commonDatum: false },
    { feature: 'right-bearing', characteristic: 'total-runout', value: 0.01, commonDatum: true },
    { feature: 'left-bearing', characteristic: 'circularity', value: 0.003, commonDatum: false },
    { feature: 'left-bearing', characteristic: 'cylindricity', value: 0.005, commonDatum: false },
    { feature: 'left-bearing', characteristic: 'total-runout', value: 0.01, commonDatum: true },
    { feature: 'left-shoulder-face', characteristic: 'circular-runout', value: 0.015, commonDatum: true },
    { feature: 'right-shoulder-face', characteristic: 'circular-runout', value: 0.015, commonDatum: true },
  ],
  roughness: [
    { feature: 'left-bearing', value: 0.8 }, { feature: 'right-bearing', value: 0.8 },
    { feature: 'left-shoulder-face', value: 0.8 }, { feature: 'right-shoulder-face', value: 0.8 },
    { feature: 'left-opening', value: 1.6 }, { feature: 'right-opening', value: 1.6 },
    { feature: 'gear', value: 0.8 },
  ],
  notes: [
    { id: 'left-chamfer', text: 'C0.5', feature: 'left-chamfer' },
    { id: 'gear-chamfer-both-sides', text: 'C0.5两侧', feature: 'gear-chamfer' },
    { id: 'spline-dual-radius1', text: 'R1', feature: 'spline-relief', requiredArrowTips: 2 },
  ],
  details: [{ text: 'Ⅰ', feature: 'upper-right-shoulder-transition' }, { text: 'Ⅱ', feature: 'left-bearing-relief' }],
  referenceCallouts: [
    { text: '[B]1', associatedDimension: 'bearing.left.diameter' },
    { text: '[B]2', associatedDimension: 'bearing.right.diameter' },
    { text: '[B]3', associatedDimension: 'gear.outer-span' },
    { text: '[B]4', associatedDimension: 'axial.main-stack' },
    { text: '[B]5', associatedDimension: 'axial.gear-width' },
    { text: '[B]6', associatedFeature: 'left-bearing' },
    { text: '[B]7', associatedFeature: 'right-bearing' },
    { text: '[B]8', associatedFeature: 'left-shoulder-face' },
    { text: '[B]9', associatedFeature: 'right-shoulder-face' },
  ],
} as const;
