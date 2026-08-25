// SPDX-License-Identifier: Apache-2.0

export { DrawingSurfaceHost } from './DrawingSurfaceHost';
export type { DrawingSurfaceHostProps } from './DrawingSurfaceHost';
export { createDrawingSurfaceRegistry } from './surface-registry';

// DSH discovers the browser half only from Host Loader entries. Pure UI packages
// therefore need a valid no-op Host face in addition to exports["./client"].
export function apply(): void {}
