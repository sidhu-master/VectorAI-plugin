// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import '../src/index';
import '../../plugin-dsh-annotation-host/src/index';

declare const context: Context;

context.drawingSpace.getSnapshot({} as never);
