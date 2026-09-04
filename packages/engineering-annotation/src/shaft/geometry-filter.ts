// SPDX-License-Identifier: Apache-2.0

import type { GeometryNode } from '@vectorai/drawing-core';

const NON_PROFILE_ROLE = /(?:dimension|annotation|hatch|center(?:line)?|construction|标注|尺寸|剖面|中心|辅助|构造)/iu;
const CONVENTIONAL_DETAIL_ROLE = /(?:detail[-_\s]*(?:thread|gear[-_\s]*visible)|螺纹(?:小径|终止)|齿轮可见齿线)/iu;

export function isShaftProfileGeometry(node: GeometryNode): boolean {
  if (!node.visible || node.quality.status !== 'confirmed' || node.type === 'ray' || node.type === 'xline' || node.type === 'point') return false;
  const role = `${node.sourceRef?.objectType ?? ''} ${node.sourceRef?.layer ?? ''}`;
  return !NON_PROFILE_ROLE.test(role) && !CONVENTIONAL_DETAIL_ROLE.test(role);
}
