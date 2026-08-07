/**
 * RepresentationAdapter 接口定义
 *
 * 表示层是 Spatial Core 的能力之一。
 * Geometry 是真实模型，DXF/SVG/STEP 是不同表示方式。
 */

import type { SpatialModel } from '../types';

export interface RepresentationAdapter {
  format: string;
  represent(model: SpatialModel): string;
}
