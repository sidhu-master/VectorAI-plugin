// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';

export const ANNOTATION_PARTITION_LAYER_ID = 'vectorai.annotation.partition';

export const ANNOTATION_PARTITION_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_PARTITION_LAYER_ID,
  label: '智能分区',
  category: 'engineering',
  icon: 'partition',
  order: 100,
  defaultVisible: true,
};

