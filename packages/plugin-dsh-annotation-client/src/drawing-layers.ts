// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';

export const ANNOTATION_PARTITION_LAYER_ID = 'vectorai.annotation.partition';
export const ANNOTATION_OPENING_ANGLE_LAYER_ID = 'vectorai.annotation.opening-angle';
export const ANNOTATION_DIMENSION_CHAIN_LAYER_ID = 'vectorai.annotation.dimension-chain';

export const ANNOTATION_PARTITION_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_PARTITION_LAYER_ID,
  label: '智能分区',
  category: 'engineering',
  icon: 'partition',
  order: 100,
  defaultVisible: true,
};

export const ANNOTATION_OPENING_ANGLE_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_OPENING_ANGLE_LAYER_ID,
  label: '开角标注',
  category: 'engineering',
  icon: 'angle',
  order: 110,
  defaultVisible: true,
};

export const ANNOTATION_DIMENSION_CHAIN_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_DIMENSION_CHAIN_LAYER_ID,
  label: '尺寸链',
  category: 'engineering',
  icon: 'dimension',
  order: 120,
  defaultVisible: true,
};
