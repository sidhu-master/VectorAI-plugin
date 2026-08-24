// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { dispatchPrimaryPointerEvent, type DrawingPointerController } from './controllers';

describe('drawing pointer controller arbitration', () => {
  it('gives a left-button event to only the first active controller', () => {
    const calls: string[] = [];
    const controllers: DrawingPointerController[] = [{
      id: 'inactive', priority: 100, active: false,
      handle: () => { calls.push('inactive'); return { handled: true }; },
    }, {
      id: 'first', priority: 20, active: true,
      handle: () => { calls.push('first'); return { handled: true, capture: true }; },
    }, {
      id: 'second', priority: 10, active: true,
      handle: () => { calls.push('second'); return { handled: true }; },
    }];

    expect(dispatchPrimaryPointerEvent(controllers, {
      type: 'pointer-down', pointerId: 1, button: 0, clientX: 10, clientY: 20,
    })).toEqual({ handled: true, capture: true, controllerId: 'first' });
    expect(calls).toEqual(['first']);
  });
});
