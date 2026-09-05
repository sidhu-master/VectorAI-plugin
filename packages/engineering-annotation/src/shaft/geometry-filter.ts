// SPDX-License-Identifier: Apache-2.0

import type { GeometryNode } from '@vectorai/drawing-core';

const NON_PROFILE_ROLE = /(?:dimension|annotation|hatch|center(?:line)?|construction|标注|尺寸|剖面|中心|辅助|构造)/iu;
const CONVENTIONAL_DETAIL_ROLE = /(?:detail[-_\s]*(?:thread|gear[-_\s]*visible)|螺纹(?:小径|终止)|齿轮可见齿线)/iu;
const SHAFT_AXIS_ROLE = /(?:^|[-_\s])(?:centerline|axis|中心线)(?:$|[-_\s])/iu;

export function isShaftAxisLine(node: GeometryNode): node is Extract<GeometryNode, { type: 'line' }> {
  return node.type === 'line'
    && node.visible
    && node.quality.status === 'confirmed'
    && Math.hypot(node.end[0] - node.start[0], node.end[1] - node.start[1]) > 1e-9
    && SHAFT_AXIS_ROLE.test(`${node.sourceRef?.objectType ?? ''} ${node.sourceRef?.layer ?? ''}`);
}

export function isShaftProfileGeometry(node: GeometryNode): boolean {
  if (!node.visible || node.quality.status !== 'confirmed' || node.type === 'ray' || node.type === 'xline' || node.type === 'point') return false;
  const role = `${node.sourceRef?.objectType ?? ''} ${node.sourceRef?.layer ?? ''}`;
  return !NON_PROFILE_ROLE.test(role) && !CONVENTIONAL_DETAIL_ROLE.test(role);
}
