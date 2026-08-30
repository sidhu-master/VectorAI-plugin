// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';

export const ANNOTATION_PARTITION_LAYER_ID = 'vectorai.annotation.partition';
export const ANNOTATION_OPENING_ANGLE_LAYER_ID = 'vectorai.annotation.opening-angle';
export const ANNOTATION_DIAMETER_LAYER_ID = 'vectorai.annotation.diameter';
export const ANNOTATION_DIMENSION_CHAIN_LAYER_ID = 'vectorai.annotation.dimension-chain';
export const ANNOTATION_DATUM_LAYER_ID = 'vectorai.annotation.datum';
export const ANNOTATION_GDT_LAYER_ID = 'vectorai.annotation.gdt';

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

export const ANNOTATION_DIAMETER_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_DIAMETER_LAYER_ID,
  label: '直径标注',
  category: 'engineering',
  icon: 'dimension',
  order: 115,
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

export const ANNOTATION_DATUM_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_DATUM_LAYER_ID,
  label: '基准',
  category: 'engineering',
  icon: 'dimension',
  order: 125,
  defaultVisible: true,
};

export const ANNOTATION_GDT_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_GDT_LAYER_ID,
  label: '形位公差',
  category: 'engineering',
  icon: 'dimension',
  order: 130,
  defaultVisible: true,
};
