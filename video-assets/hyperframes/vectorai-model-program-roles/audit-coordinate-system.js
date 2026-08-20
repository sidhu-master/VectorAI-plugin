export function createCadViewport(flipY) {
  if (!Number.isFinite(flipY)) throw new TypeError('flipY must be finite');
  return Object.freeze({
    flipY,
    svgTransform: `translate(0 ${flipY}) scale(1 -1)`,
    worldToScreen([x, y]) {
      return [x, flipY - y];
    },
  });
}

export function applyCadViewport(element, viewport) {
  if (!element || typeof element.setAttribute !== 'function') {
    throw new TypeError('element must support setAttribute');
  }
  element.setAttribute('transform', viewport.svgTransform);
}

export function translateWorldPoint([x, y], [deltaX, deltaY]) {
  return [x + deltaX, y + deltaY];
}
