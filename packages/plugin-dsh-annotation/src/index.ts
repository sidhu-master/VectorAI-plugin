// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';

import { createEngineeringAnnotationTool } from './tools';

export { createEngineeringAnnotationTool } from './tools';

export const inject = ['tools', 'drawingSpace'];

export function apply(ctx: Context) {
  return ctx.tools.register(createEngineeringAnnotationTool(ctx.drawingSpace));
}

export default apply;
