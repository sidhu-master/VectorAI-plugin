// SPDX-License-Identifier: Apache-2.0

declare module 'labella' {
  export class Node<T = unknown> {
    constructor(idealPos: number, width: number, data?: T);
    idealPos: number;
    currentPos: number;
    width: number;
    data: T;
    layerIndex: number;
    getLayerIndex(): number;
  }

  export class Force<T = unknown> {
    constructor(options?: {
      nodeSpacing?: number;
      lineSpacing?: number;
      minPos?: number;
      maxPos?: number | null;
      algorithm?: 'overlap' | 'roundRobin' | 'none';
      removeOverlap?: boolean;
      density?: number;
      stubWidth?: number;
    });
    nodes(): Array<Node<T>>;
    nodes(nodes: Array<Node<T>>): this;
    compute(): this;
    getLayers(): Array<Array<Node<T>>>;
  }

  const Labella: { Node: typeof Node; Force: typeof Force };
  export default Labella;
}
