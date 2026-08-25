window.__ModuleLoader__.load({
  id: "@vectorai/plugin-dsh-annotation-client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const jsxRuntime = require("react/jsx-runtime");
    const react = require("react");
    function evaluateHomogeneous(node, normalized) {
      const pointCount = node.controlPoints.length;
      const lastControlIndex = pointCount - 1;
      const domainStart = node.knots[node.degree];
      const domainEnd = node.knots[lastControlIndex + 1];
      const knotParameter = normalized === 1 ? domainEnd : domainStart + normalized * (domainEnd - domainStart);
      const span = normalized === 1 ? lastControlIndex : findSpan(node.knots, node.degree, lastControlIndex, knotParameter);
      const weights = node.weights ?? Array.from({ length: pointCount }, () => 1);
      const work = [];
      for (let index = 0; index <= node.degree; index += 1) {
        const sourceIndex = span - node.degree + index;
        const weight = weights[sourceIndex];
        const point = node.controlPoints[sourceIndex];
        work.push([point[0] * weight, point[1] * weight, weight]);
      }
      for (let level = 1; level <= node.degree; level += 1) {
        for (let index = node.degree; index >= level; index -= 1) {
          const knotIndex = span - node.degree + index;
          const denominator = node.knots[knotIndex + node.degree - level + 1] - node.knots[knotIndex];
          const alpha = denominator === 0 ? 0 : (knotParameter - node.knots[knotIndex]) / denominator;
          work[index] = mixHomogeneous(work[index - 1], work[index], alpha);
        }
      }
      return work[node.degree];
    }
    function sampleSpline(node, { maxError, maxDepth = 12 }) {
      if (!(Number.isFinite(maxError) && maxError > 0)) {
        throw new TypeError("SPLINE_MAX_ERROR_INVALID");
      }
      if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 24) {
        throw new TypeError("SPLINE_MAX_DEPTH_INVALID");
      }
      validateSpline(node);
      const first = project(evaluateHomogeneous(node, 0));
      const output = [first];
      const spans = normalizedKnotSpans(node);
      for (let index = 1; index < spans.length; index += 1) {
        const controls = extractBezierControls(node, spans[index - 1], spans[index]);
        subdivideBezier(controls, 0, maxDepth, maxError, output);
      }
      if (node.closed && !samePoint(output[0], output.at(-1))) output.push(output[0]);
      return output;
    }
    function normalizedKnotSpans(node) {
      const start = node.knots[node.degree];
      const end = node.knots[node.controlPoints.length];
      return node.knots.slice(node.degree, node.controlPoints.length + 1).map((value) => (value - start) / (end - start)).filter((value, index, values) => index === 0 || value > values[index - 1]);
    }
    function splineBounds(node) {
      validateSpline(node);
      const controlMinX = Math.min(...node.controlPoints.map(([x]) => x));
      const controlMaxX = Math.max(...node.controlPoints.map(([x]) => x));
      const controlMinY = Math.min(...node.controlPoints.map(([, y]) => y));
      const controlMaxY = Math.max(...node.controlPoints.map(([, y]) => y));
      const span = Math.max(controlMaxX - controlMinX, controlMaxY - controlMinY, 1);
      const points = sampleSpline(node, { maxError: Math.max(span * 1e-6, 1e-8), maxDepth: 18 });
      return {
        minX: Math.min(...points.map(([x]) => x)),
        minY: Math.min(...points.map(([, y]) => y)),
        maxX: Math.max(...points.map(([x]) => x)),
        maxY: Math.max(...points.map(([, y]) => y))
      };
    }
    function validateSpline(node) {
      if (!Number.isInteger(node.degree) || node.degree < 1) {
        throw new TypeError("SPLINE_DEGREE_INVALID");
      }
      if (node.controlPoints.length <= node.degree) {
        throw new TypeError("SPLINE_CONTROL_POINT_COUNT_INVALID");
      }
      if (node.controlPoints.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
        throw new TypeError("SPLINE_CONTROL_POINT_INVALID");
      }
      const expectedKnots = node.controlPoints.length + node.degree + 1;
      if (node.knots.length !== expectedKnots) {
        throw new TypeError("SPLINE_KNOT_COUNT_INVALID");
      }
      if (node.knots.some((value, index) => !Number.isFinite(value) || index > 0 && value < node.knots[index - 1])) {
        throw new TypeError("SPLINE_KNOT_SEQUENCE_INVALID");
      }
      const domainStart = node.knots[node.degree];
      const domainEnd = node.knots[node.controlPoints.length];
      if (!(domainEnd > domainStart)) throw new TypeError("SPLINE_KNOT_DOMAIN_INVALID");
      if (node.weights !== void 0 && (node.weights.length !== node.controlPoints.length || node.weights.some((weight) => !Number.isFinite(weight) || weight <= 0))) {
        throw new TypeError("SPLINE_WEIGHTS_INVALID");
      }
    }
    function findSpan(knots, degree, lastControlIndex, value) {
      let low = degree;
      let high = lastControlIndex + 1;
      let middle = Math.floor((low + high) / 2);
      while (value < knots[middle] || value >= knots[middle + 1]) {
        if (value < knots[middle]) high = middle;
        else low = middle;
        middle = Math.floor((low + high) / 2);
      }
      return middle;
    }
    function mixHomogeneous(first, second, alpha) {
      return [
        first[0] * (1 - alpha) + second[0] * alpha,
        first[1] * (1 - alpha) + second[1] * alpha,
        first[2] * (1 - alpha) + second[2] * alpha
      ];
    }
    function subdivideBezier(controls, depth, maxDepth, maxError, output) {
      const points = controls.map(project);
      const start = points[0];
      const end = points.at(-1);
      const flatness = Math.max(0, ...points.slice(1, -1).map((point) => pointSegmentDistance(point, start, end)));
      if (depth >= maxDepth || flatness <= maxError) {
        output.push(end);
        return;
      }
      const [left, right] = splitBezier(controls);
      subdivideBezier(left, depth + 1, maxDepth, maxError, output);
      subdivideBezier(right, depth + 1, maxDepth, maxError, output);
    }
    function extractBezierControls(node, start, end) {
      const degree = node.degree;
      if (degree === 1) return [evaluateHomogeneous(node, start), evaluateHomogeneous(node, end)];
      const samples = Array.from({ length: degree + 1 }, (_, row) => {
        const local = row / degree;
        return evaluateHomogeneous(node, start + (end - start) * local);
      });
      const matrix = Array.from({ length: degree + 1 }, (_, row) => {
        const parameter = row / degree;
        return Array.from({ length: degree + 1 }, (_2, column) => bernstein(degree, column, parameter));
      });
      return solve(matrix, samples);
    }
    function solve(matrix, values) {
      const size = matrix.length;
      const augmented = matrix.map((row, index) => [...row, ...values[index]]);
      for (let column = 0; column < size; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
        [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
        const divisor = augmented[column][column];
        if (Math.abs(divisor) <= 1e-14) throw new TypeError("SPLINE_BEZIER_EXTRACTION_FAILED");
        for (let index = column; index < size + 3; index += 1) augmented[column][index] = augmented[column][index] / divisor;
        for (let row = 0; row < size; row += 1) {
          if (row === column) continue;
          const factor = augmented[row][column];
          for (let index = column; index < size + 3; index += 1) augmented[row][index] = augmented[row][index] - factor * augmented[column][index];
        }
      }
      return augmented.map((row) => [row[size], row[size + 1], row[size + 2]]);
    }
    function splitBezier(controls) {
      const levels = [controls.map((point) => [...point])];
      while (levels.at(-1).length > 1) {
        const previous = levels.at(-1);
        levels.push(previous.slice(1).map((point, index) => mixHomogeneous(previous[index], point, 0.5)));
      }
      return [levels.map((level) => level[0]), levels.map((level) => level.at(-1)).reverse()];
    }
    function project(point) {
      if (!(Math.abs(point[2]) > Number.EPSILON)) throw new TypeError("SPLINE_WEIGHT_SUM_INVALID");
      return [point[0] / point[2], point[1] / point[2]];
    }
    function bernstein(degree, index, parameter) {
      return binomial(degree, index) * parameter ** index * (1 - parameter) ** (degree - index);
    }
    function binomial(n, k) {
      let result = 1;
      for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
      return result;
    }
    function pointSegmentDistance(point, start, end) {
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
      const projection = Math.min(1, Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
      return Math.hypot(
        point[0] - (start[0] + projection * dx),
        point[1] - (start[1] + projection * dy)
      );
    }
    function samePoint(first, second) {
      return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
    }
    function gridPatternMetrics(viewport) {
      const minorSize = 10 * viewport.scale;
      const majorSize = 50 * viewport.scale;
      return {
        minorSize,
        majorSize,
        minorX: modulo$2(viewport.x, minorSize),
        minorY: modulo$2(viewport.y, minorSize),
        majorX: modulo$2(viewport.x, majorSize),
        majorY: modulo$2(viewport.y, majorSize)
      };
    }
    function modulo$2(value, divisor) {
      return (value % divisor + divisor) % divisor;
    }
    function CadGrid({
      viewport,
      showGrid,
      showAxes
    }) {
      const id = react.useId().replace(/:/g, "");
      const metrics = gridPatternMetrics(viewport);
      const minorId = `vai-grid-minor-${id}`;
      const majorId = `vai-grid-major-${id}`;
      return /* @__PURE__ */ jsxRuntime.jsxs("g", { "data-cad-grid": "true", pointerEvents: "none", children: [
        showGrid ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsxs("defs", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "pattern",
              {
                id: minorId,
                "data-grid-pattern": "minor",
                width: metrics.minorSize,
                height: metrics.minorSize,
                patternUnits: "userSpaceOnUse",
                x: metrics.minorX,
                y: metrics.minorY,
                children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: `M ${metrics.minorSize} 0 H 0 V ${metrics.minorSize}`, className: "vai-grid__minor", fill: "none" })
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "pattern",
              {
                id: majorId,
                "data-grid-pattern": "major",
                width: metrics.majorSize,
                height: metrics.majorSize,
                patternUnits: "userSpaceOnUse",
                x: metrics.majorX,
                y: metrics.majorY,
                children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: `M ${metrics.majorSize} 0 H 0 V ${metrics.majorSize}`, className: "vai-grid__major", fill: "none" })
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("rect", { "data-grid-layer": "minor", width: "100%", height: "100%", fill: `url(#${minorId})` }),
          /* @__PURE__ */ jsxRuntime.jsx("rect", { "data-grid-layer": "major", width: "100%", height: "100%", fill: `url(#${majorId})` })
        ] }) : null,
        showAxes ? /* @__PURE__ */ jsxRuntime.jsxs("g", { className: "vai-grid__axes", children: [
          /* @__PURE__ */ jsxRuntime.jsx("line", { "data-axis": "x", x1: 0, y1: viewport.y, x2: "100%", y2: viewport.y, vectorEffect: "non-scaling-stroke" }),
          /* @__PURE__ */ jsxRuntime.jsx("line", { "data-axis": "y", x1: viewport.x, y1: 0, x2: viewport.x, y2: "100%", vectorEffect: "non-scaling-stroke" }),
          /* @__PURE__ */ jsxRuntime.jsx("text", { "data-axis-label": "x", x: Math.max(8, viewport.width - 18), y: viewport.y - 7, children: "X" }),
          /* @__PURE__ */ jsxRuntime.jsx("text", { "data-axis-label": "y", x: viewport.x + 7, y: 14, children: "Y" })
        ] }) : null
      ] });
    }
    const MIN_SCALE = 0.01;
    const MAX_SCALE = 1e3;
    function screenToWorld(point, viewport) {
      return [
        (point[0] - viewport.x) / viewport.scale,
        (viewport.y - point[1]) / viewport.scale
      ];
    }
    function zoomViewportAt(viewport, screenPoint, factor) {
      const anchor = screenToWorld(screenPoint, viewport);
      const scale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
      return {
        ...viewport,
        scale,
        x: screenPoint[0] - anchor[0] * scale,
        y: screenPoint[1] + anchor[1] * scale
      };
    }
    function fitViewportToDrawing(document, size, padding = 1.2) {
      const bounds = drawingBounds(document) ?? { minX: -50, minY: -50, maxX: 50, maxY: 50 };
      const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
      const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
      const safePadding = Number.isFinite(padding) && padding > 0 ? padding : 1.2;
      const scale = clamp(Math.min(
        Math.max(size.width, 1) / (boundsWidth * safePadding),
        Math.max(size.height, 1) / (boundsHeight * safePadding)
      ), MIN_SCALE, MAX_SCALE);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      return {
        x: size.width / 2 - centerX * scale,
        y: size.height / 2 + centerY * scale,
        scale,
        width: size.width,
        height: size.height
      };
    }
    function drawingBounds(document) {
      const bounds = [...document.geometry, ...document.annotations].filter((node) => node.visible).map(nodeBounds).filter((value) => value !== null);
      return unionBounds(bounds);
    }
    function nodesInWorldBox(document, box) {
      return [...document.geometry, ...document.annotations].filter((node) => node.visible).filter((node) => {
        const bounds = nodeBounds(node);
        return bounds !== null && boundsIntersect(bounds, box);
      }).map((node) => node.id);
    }
    function nodeBounds(node) {
      switch (node.type) {
        case "point":
          return boundsFromPoints([[node.x, node.y]]);
        case "line":
          return boundsFromPoints([node.start, node.end]);
        case "ray":
        case "xline":
          return null;
        case "circle":
          return finiteCircleBounds(node.center, node.radius);
        case "arc":
          return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
        case "ellipse":
          return ellipseBounds(node);
        case "polyline":
          return boundsFromPoints(node.vertices.map((vertex) => vertex.point));
        case "spline":
          return splineBounds(node);
        case "text":
          return textBounds(node);
        case "dimension":
          return boundsFromPoints([...node.definitionPoints, node.textPosition]);
        case "leader":
          return boundsFromPoints(node.points);
        case "centerline":
          return extendedLineBounds(node.start, node.end, node.extension);
        case "section-hatch":
          return boundsFromPoints(node.segments.flatMap(({ start, end }) => [start, end]));
      }
    }
    function worldBoundsForViewport(viewport) {
      const first = screenToWorld([0, 0], viewport);
      const second = screenToWorld([viewport.width, viewport.height], viewport);
      return normalizeBounds$1(first, second);
    }
    function finiteCircleBounds(center, radius) {
      if (!finitePoint(center) || !Number.isFinite(radius) || radius < 0) return null;
      return {
        minX: center[0] - radius,
        minY: center[1] - radius,
        maxX: center[0] + radius,
        maxY: center[1] + radius
      };
    }
    function arcBounds(center, radius, start, end, counterClockwise) {
      if (finiteCircleBounds(center, radius) === null || !Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }
      const candidates = [start, end, ...[0, 90, 180, 270].filter((angle) => angleOnArc(angle, start, end, counterClockwise))];
      return boundsFromPoints(candidates.map((angle) => {
        const radians = angle * Math.PI / 180;
        return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
      }));
    }
    function ellipseBounds(node) {
      if (!finitePoint(node.center) || !finitePoint(node.majorAxis) || !Number.isFinite(node.ratio) || node.ratio <= 0) return null;
      const [axisX, axisY] = node.majorAxis;
      const majorRadius = Math.hypot(axisX, axisY);
      if (majorRadius === 0) return null;
      const minorRadius = majorRadius * node.ratio;
      const minorX = -axisY / majorRadius * minorRadius;
      const minorY = axisX / majorRadius * minorRadius;
      const extentX = Math.hypot(axisX, minorX);
      const extentY = Math.hypot(axisY, minorY);
      return {
        minX: node.center[0] - extentX,
        minY: node.center[1] - extentY,
        maxX: node.center[0] + extentX,
        maxY: node.center[1] + extentY
      };
    }
    function textBounds(node) {
      if (!finitePoint(node.position) || !Number.isFinite(node.height) || !Number.isFinite(node.rotation)) {
        return null;
      }
      const width = node.maxWidth ?? node.content.length * node.height * 0.6;
      const left = node.alignment === "center" ? -width / 2 : node.alignment === "right" ? -width : 0;
      const bottom = node.verticalAlignment === "top" ? -node.height : node.verticalAlignment === "middle" ? -node.height / 2 : node.verticalAlignment === "baseline" ? -node.height : 0;
      const radians = node.rotation * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return boundsFromPoints([
        [left, bottom],
        [left + width, bottom],
        [left + width, bottom + node.height],
        [left, bottom + node.height]
      ].map(([x, y]) => [
        node.position[0] + x * cos - y * sin,
        node.position[1] + x * sin + y * cos
      ]));
    }
    function extendedLineBounds(start, end, extension) {
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const length = Math.hypot(dx, dy);
      if (!(length > 0)) return boundsFromPoints([start]);
      return boundsFromPoints([
        [start[0] - dx / length * extension, start[1] - dy / length * extension],
        [end[0] + dx / length * extension, end[1] + dy / length * extension]
      ]);
    }
    function boundsFromPoints(points) {
      if (points.length === 0 || points.some((point) => !finitePoint(point))) return null;
      return {
        minX: Math.min(...points.map((point) => point[0])),
        minY: Math.min(...points.map((point) => point[1])),
        maxX: Math.max(...points.map((point) => point[0])),
        maxY: Math.max(...points.map((point) => point[1]))
      };
    }
    function unionBounds(bounds) {
      if (bounds.length === 0) return null;
      return bounds.reduce((combined, current) => ({
        minX: Math.min(combined.minX, current.minX),
        minY: Math.min(combined.minY, current.minY),
        maxX: Math.max(combined.maxX, current.maxX),
        maxY: Math.max(combined.maxY, current.maxY)
      }));
    }
    function normalizeBounds$1(first, second) {
      return {
        minX: Math.min(first[0], second[0]),
        minY: Math.min(first[1], second[1]),
        maxX: Math.max(first[0], second[0]),
        maxY: Math.max(first[1], second[1])
      };
    }
    function boundsIntersect(first, second) {
      return first.minX <= second.maxX && first.maxX >= second.minX && first.minY <= second.maxY && first.maxY >= second.minY;
    }
    function angleOnArc(angle, start, end, counterClockwise) {
      const normalizedAngle = normalizeAngle(angle);
      const normalizedStart = normalizeAngle(start);
      const normalizedEnd = normalizeAngle(end);
      if (counterClockwise) {
        return modulo$1(normalizedAngle - normalizedStart, 360) <= modulo$1(normalizedEnd - normalizedStart, 360);
      }
      return modulo$1(normalizedStart - normalizedAngle, 360) <= modulo$1(normalizedStart - normalizedEnd, 360);
    }
    function normalizeAngle(value) {
      return modulo$1(value, 360);
    }
    function modulo$1(value, divisor) {
      return (value % divisor + divisor) % divisor;
    }
    function finitePoint(point) {
      return Number.isFinite(point[0]) && Number.isFinite(point[1]);
    }
    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }
    function EntityRenderer({
      node,
      viewport,
      selected,
      aiGrounded = false,
      motionRigActive = false,
      onSelect,
      onTextPointerDown,
      previewDiff
    }) {
      if (!node.visible) return null;
      const className = `vai-entity vai-entity--${node.quality.status}${selected ? " vai-entity--selected" : ""}${aiGrounded ? " vai-entity--ai-grounded" : ""}${motionRigActive ? " vai-entity--motion-rig" : ""}${previewDiff === void 0 ? "" : ` vai-entity--preview-${previewDiff}`}`;
      const interactiveText = (node.type === "text" || node.type === "dimension") && onTextPointerDown !== void 0;
      return /* @__PURE__ */ jsxRuntime.jsx(
        "g",
        {
          className,
          "data-entity-id": node.id,
          "data-entity-type": node.type,
          "data-selected": selected || void 0,
          "data-ai-grounded": aiGrounded || void 0,
          "data-motion-rig-active": motionRigActive || void 0,
          "data-preview-diff": previewDiff,
          onClick: onSelect,
          onMouseDown: interactiveText ? onTextPointerDown : void 0,
          children: renderNode(node, viewport)
        }
      );
    }
    function renderNode(node, viewport) {
      const vectorStroke = { vectorEffect: "non-scaling-stroke" };
      switch (node.type) {
        case "point":
          return /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: node.x, cy: node.y, r: 3 / viewport.scale, ...vectorStroke });
        case "line":
          return /* @__PURE__ */ jsxRuntime.jsx("line", { x1: node.start[0], y1: node.start[1], x2: node.end[0], y2: node.end[1], ...vectorStroke });
        case "ray":
        case "xline": {
          const points = clipExtendedLine(node.origin, node.direction, worldBoundsForViewport(viewport), node.type === "ray");
          return points === null ? null : /* @__PURE__ */ jsxRuntime.jsx("line", { x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1], ...vectorStroke });
        }
        case "circle":
          return /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: node.center[0], cy: node.center[1], r: node.radius, fill: "none", ...vectorStroke });
        case "arc":
          return /* @__PURE__ */ jsxRuntime.jsx("path", { d: arcPath(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise), fill: "none", ...vectorStroke });
        case "ellipse": {
          const radiusX = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
          const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
          return /* @__PURE__ */ jsxRuntime.jsx(
            "ellipse",
            {
              cx: node.center[0],
              cy: node.center[1],
              rx: radiusX,
              ry: radiusX * node.ratio,
              transform: `rotate(${rotation} ${node.center[0]} ${node.center[1]})`,
              fill: "none",
              ...vectorStroke
            }
          );
        }
        case "polyline":
          return /* @__PURE__ */ jsxRuntime.jsx("path", { d: polylinePath(node), fill: "none", ...vectorStroke });
        case "spline":
          return /* @__PURE__ */ jsxRuntime.jsx("path", { d: splinePath(node, viewport), fill: "none", ...vectorStroke });
        case "text":
          return /* @__PURE__ */ jsxRuntime.jsx(WorldText, { position: node.position, rotation: node.rotation, height: node.height, align: node.alignment, children: node.content });
        case "dimension":
          return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            node.definitionPoints.length > 1 ? /* @__PURE__ */ jsxRuntime.jsx("polyline", { points: pointsAttribute(node.definitionPoints), fill: "none", ...vectorStroke }) : null,
            /* @__PURE__ */ jsxRuntime.jsx(WorldText, { position: node.textPosition, height: Math.max(4, 10 / viewport.scale), align: "center", children: dimensionLabel(node) })
          ] });
        case "leader": {
          const textPosition = node.points.at(-1) ?? [0, 0];
          return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            /* @__PURE__ */ jsxRuntime.jsx("polyline", { points: pointsAttribute(node.points), fill: "none", ...vectorStroke }),
            /* @__PURE__ */ jsxRuntime.jsx(WorldText, { position: textPosition, height: node.textHeight, align: "left", children: node.content })
          ] });
        }
        case "centerline": {
          const bounds = nodeBounds(node);
          return bounds === null ? null : /* @__PURE__ */ jsxRuntime.jsx(
            "line",
            {
              x1: bounds.minX,
              y1: bounds.minY,
              x2: bounds.maxX,
              y2: bounds.maxY,
              strokeDasharray: "10 4 2 4",
              ...vectorStroke
            }
          );
        }
        case "section-hatch":
          return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-section-hatch": node.pattern, children: node.segments.map((segment, index) => /* @__PURE__ */ jsxRuntime.jsx(
            "line",
            {
              x1: segment.start[0],
              y1: segment.start[1],
              x2: segment.end[0],
              y2: segment.end[1],
              ...vectorStroke
            },
            index
          )) });
      }
    }
    function WorldText({
      position,
      rotation = 0,
      height,
      align,
      children
    }) {
      return /* @__PURE__ */ jsxRuntime.jsx("g", { transform: `translate(${position[0]} ${position[1]}) rotate(${-rotation}) scale(1 -1)`, children: /* @__PURE__ */ jsxRuntime.jsx(
        "text",
        {
          fontSize: height,
          textAnchor: align === "center" ? "middle" : align === "right" ? "end" : "start",
          children
        }
      ) });
    }
    function dimensionLabel(node) {
      if (node.displayText !== void 0) return node.displayText;
      const value = node.observedValue ?? node.computedValue;
      if (value === void 0) return "—";
      return `${node.prefix ?? ""}${value}${node.unit ? ` ${node.unit}` : ""}${node.suffix ?? ""}`;
    }
    function pointsAttribute(points) {
      return points.map((point) => `${point[0]},${point[1]}`).join(" ");
    }
    function splinePath(node, viewport) {
      const points = sampleSpline(node, { maxError: Math.max(0.25 / viewport.scale, 1e-8) });
      if (points.length === 0) return "";
      if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
      const commands = [
        `M ${points[0][0]} ${points[0][1]}`,
        ...points.slice(1).map(([x, y]) => `L ${x} ${y}`)
      ];
      if (node.closed) commands.push("Z");
      return commands.join(" ");
    }
    function polylinePath(node) {
      if (node.vertices.length === 0) return "";
      const output = [`M ${node.vertices[0].point[0]} ${node.vertices[0].point[1]}`];
      const segments = node.closed ? node.vertices.length : node.vertices.length - 1;
      for (let index = 0; index < segments; index += 1) {
        const current = node.vertices[index];
        const next = node.vertices[(index + 1) % node.vertices.length];
        if (current.bulge !== void 0 && Math.abs(current.bulge) > 1e-9) {
          const radius = Math.hypot(
            next.point[0] - current.point[0],
            next.point[1] - current.point[1]
          ) * (1 + current.bulge * current.bulge) / (4 * Math.abs(current.bulge));
          output.push(`A ${radius} ${radius} 0 ${Math.abs(current.bulge) > 1 ? 1 : 0} ${current.bulge > 0 ? 1 : 0} ${next.point[0]} ${next.point[1]}`);
        } else {
          output.push(`L ${next.point[0]} ${next.point[1]}`);
        }
      }
      if (node.closed) output.push("Z");
      return output.join(" ");
    }
    function arcPath(center, radius, start, end, counterClockwise) {
      const point = (angle) => {
        const radians = angle * Math.PI / 180;
        return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
      };
      const first = point(start);
      const last = point(end);
      const span = counterClockwise ? modulo(end - start, 360) : modulo(start - end, 360);
      return `M ${first[0]} ${first[1]} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} ${counterClockwise ? 1 : 0} ${last[0]} ${last[1]}`;
    }
    function clipExtendedLine(origin, direction, bounds, ray) {
      if (Math.hypot(direction[0], direction[1]) <= 1e-9) return null;
      let minimum = ray ? 0 : Number.NEGATIVE_INFINITY;
      let maximum = Number.POSITIVE_INFINITY;
      for (const [axisOrigin, axisDirection, low, high] of [
        [origin[0], direction[0], bounds.minX, bounds.maxX],
        [origin[1], direction[1], bounds.minY, bounds.maxY]
      ]) {
        if (Math.abs(axisDirection) <= 1e-9) {
          if (axisOrigin < low || axisOrigin > high) return null;
          continue;
        }
        const first = (low - axisOrigin) / axisDirection;
        const second = (high - axisOrigin) / axisDirection;
        minimum = Math.max(minimum, Math.min(first, second));
        maximum = Math.min(maximum, Math.max(first, second));
      }
      if (minimum > maximum) return null;
      return [
        [origin[0] + direction[0] * minimum, origin[1] + direction[1] * minimum],
        [origin[0] + direction[0] * maximum, origin[1] + direction[1] * maximum]
      ];
    }
    function modulo(value, divisor) {
      return (value % divisor + divisor) % divisor;
    }
    function SourceUnderlay({
      source,
      resource,
      document
    }) {
      const sourceFrame = document.coordinateFrames.find((frame) => frame.kind === "source" && frame.id === `frame_source_${safeId(source.id)}`) ?? document.coordinateFrames.find((frame) => frame.kind === "source");
      const transform2 = sourceFrame == null ? void 0 : sourceFrame.transform;
      return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-source-underlay": source.id, pointerEvents: "none", opacity: 0.28, children: /* @__PURE__ */ jsxRuntime.jsx("g", { transform: transform2 === void 0 ? `translate(0 ${source.height}) scale(1 -1)` : `matrix(${transform2.join(" ")})`, children: /* @__PURE__ */ jsxRuntime.jsx(
        "image",
        {
          href: resource.url,
          x: 0,
          y: 0,
          width: source.width,
          height: source.height,
          preserveAspectRatio: "none"
        }
      ) }) });
    }
    function safeId(value) {
      return value.replace(/[^a-zA-Z0-9_-]/g, "_");
    }
    function isRasterDrawingSource(source) {
      return "width" in source && "height" in source;
    }
    function SourceLayer({
      document,
      source,
      sourceUrl
    }) {
      if (source === void 0 || !isRasterDrawingSource(source) || sourceUrl === null) return null;
      return /* @__PURE__ */ jsxRuntime.jsx(
        SourceUnderlay,
        {
          source,
          resource: { url: sourceUrl, dispose() {
          } },
          document
        }
      );
    }
    function GeometryLayer({
      nodes,
      viewport,
      selectedIds,
      attentionIds,
      onSelect
    }) {
      return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-layer": "geometry", children: nodes.map((node) => /* @__PURE__ */ jsxRuntime.jsx(
        EntityRenderer,
        {
          node,
          viewport,
          selected: selectedIds.includes(node.id),
          aiGrounded: attentionIds.includes(node.id),
          onSelect: (event) => onSelect(node.id, event)
        },
        node.id
      )) });
    }
    function AnnotationLayer({
      nodes,
      viewport,
      selectedIds,
      attentionIds,
      onSelect
    }) {
      return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-layer": "annotations", children: nodes.map((node) => /* @__PURE__ */ jsxRuntime.jsx(
        EntityRenderer,
        {
          node,
          viewport,
          selected: selectedIds.includes(node.id),
          aiGrounded: attentionIds.includes(node.id),
          onSelect: (event) => onSelect(node.id, event)
        },
        node.id
      )) });
    }
    function RelationLayer({
      document,
      viewport
    }) {
      return /* @__PURE__ */ jsxRuntime.jsx("g", { className: "vai-relations", "data-layer": "relations", children: document.relations.filter((relation) => relation.visible && relation.plane !== "topology").flatMap((relation) => relationSegments(document, relation, viewport)) });
    }
    function SelectionLayer({
      box
    }) {
      if (box === null) return null;
      return /* @__PURE__ */ jsxRuntime.jsx(
        "rect",
        {
          "data-selection-box": "true",
          "data-layer": "selection",
          x: Math.min(box.start[0], box.current[0]),
          y: Math.min(box.start[1], box.current[1]),
          width: Math.abs(box.current[0] - box.start[0]),
          height: Math.abs(box.current[1] - box.start[1]),
          className: "vai-canvas__selection-box",
          pointerEvents: "none"
        }
      );
    }
    function relationSegments(document, relation, viewport) {
      const centers = relationNodeIds(relation).flatMap((id) => {
        const node = [...document.geometry, ...document.annotations].find((candidate) => candidate.id === id);
        const bounds = node === void 0 ? null : nodeBounds(node);
        return bounds === null ? [] : [[(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]];
      });
      return centers.slice(1).map((center, index) => {
        const start = centers[index];
        const midpoint = [(start[0] + center[0]) / 2, (start[1] + center[1]) / 2];
        return /* @__PURE__ */ jsxRuntime.jsxs("g", { "data-relation-id": relation.id, children: [
          /* @__PURE__ */ jsxRuntime.jsx("line", { x1: start[0], y1: start[1], x2: center[0], y2: center[1], vectorEffect: "non-scaling-stroke" }),
          /* @__PURE__ */ jsxRuntime.jsx("g", { transform: `translate(${midpoint[0]} ${midpoint[1]}) scale(1 -1)`, children: /* @__PURE__ */ jsxRuntime.jsx("text", { fontSize: 10 / Math.max(viewport.scale, 1e-3), textAnchor: "middle", children: relation.kind }) })
        ] }, `${relation.id}:${index}`);
      });
    }
    function relationNodeIds(relation) {
      switch (relation.type) {
        case "topology":
          return relation.nodeIds;
        case "constraint":
          return relation.geometryIds;
        case "association":
          return [relation.annotationId, ...relation.geometryIds];
        case "semantic":
          return relation.nodeIds;
      }
    }
    const DEFAULT_DISPLAY = {
      grid: true,
      axes: true,
      relations: true,
      annotations: true,
      sourceUnderlay: false
    };
    function DrawingSurface({
      snapshot,
      viewport,
      selectedIds,
      attentionIds = [],
      display: displayInput,
      sourceUrl = null,
      worldLayers,
      screenLayers,
      className = "vai-canvas",
      onViewportChange,
      onSelectionChange,
      onMouseWorldChange
    }) {
      const display = { ...DEFAULT_DISPLAY, ...displayInput };
      const containerRef = react.useRef(null);
      const dragRef = react.useRef(null);
      const [selectionBox, setSelectionBox] = react.useState(null);
      react.useEffect(() => {
        const element = containerRef.current;
        if (element === null) return;
        const preventConversationScroll = (event) => event.preventDefault();
        element.addEventListener("wheel", preventConversationScroll, { passive: false });
        return () => element.removeEventListener("wheel", preventConversationScroll);
      }, []);
      const handleWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onViewportChange(zoomViewportAt(viewport, eventScreenPoint(event), event.deltaY < 0 ? 1.1 : 1 / 1.1));
      };
      const handleMouseDown = (event) => {
        const point = eventScreenPoint(event);
        const boxSelect = event.button === 0 && (event.metaKey || event.ctrlKey);
        if (event.button === 1 || event.button === 0 && !boxSelect) {
          event.preventDefault();
          dragRef.current = {
            kind: "pan",
            start: point,
            viewport,
            clearSelectionOnClick: event.button === 0 && isBlankCanvasTarget(event)
          };
          return;
        }
        if (!boxSelect) return;
        dragRef.current = { kind: "box", start: point, current: point, additive: true };
        setSelectionBox({ start: point, current: point });
      };
      const handleMouseMove = (event) => {
        const point = eventScreenPoint(event);
        onMouseWorldChange == null ? void 0 : onMouseWorldChange(screenToWorld(point, viewport));
        const drag = dragRef.current;
        if ((drag == null ? void 0 : drag.kind) === "pan") {
          onViewportChange({
            ...drag.viewport,
            x: drag.viewport.x + point[0] - drag.start[0],
            y: drag.viewport.y + point[1] - drag.start[1]
          });
        } else if ((drag == null ? void 0 : drag.kind) === "box") {
          drag.current = point;
          setSelectionBox({ start: drag.start, current: point });
        }
      };
      const handleMouseUp = (event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if ((drag == null ? void 0 : drag.kind) === "pan") {
          const point = eventScreenPoint(event);
          if (drag.clearSelectionOnClick && Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) < 3) {
            onSelectionChange([]);
          }
          return;
        }
        if ((drag == null ? void 0 : drag.kind) === "box") {
          const point = eventScreenPoint(event);
          if (Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) >= 3) {
            const first = screenToWorld(drag.start, viewport);
            const second = screenToWorld(point, viewport);
            const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
            onSelectionChange(drag.additive ? [.../* @__PURE__ */ new Set([...selectedIds, ...ids])] : ids);
          }
          setSelectionBox(null);
        }
      };
      const selectEntity = (id, event) => {
        event.stopPropagation();
        onSelectionChange(event.metaKey || event.ctrlKey ? selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id] : [id]);
      };
      const handleKeyDown = (event) => {
        if (event.key !== "Escape") return;
        dragRef.current = null;
        setSelectionBox(null);
        onSelectionChange([]);
      };
      return /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          ref: containerRef,
          className,
          "data-canvas-root": "true",
          "data-controlled-drawing-surface": "true",
          role: "application",
          "aria-label": "可交互图纸画布",
          tabIndex: 0,
          onKeyDown: handleKeyDown,
          children: /* @__PURE__ */ jsxRuntime.jsxs(
            "svg",
            {
              className: "vai-canvas__svg",
              width: "100%",
              height: "100%",
              "aria-label": "图纸画布",
              onWheel: handleWheel,
              onMouseDown: handleMouseDown,
              onMouseMove: handleMouseMove,
              onMouseUp: handleMouseUp,
              onMouseLeave: () => onMouseWorldChange == null ? void 0 : onMouseWorldChange(null),
              onDoubleClick: () => onViewportChange(fitViewportToDrawing(snapshot.document, viewport)),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(CadGrid, { viewport, showGrid: display.grid, showAxes: display.axes }),
                /* @__PURE__ */ jsxRuntime.jsx("rect", { "data-canvas-background": "true", width: "100%", height: "100%", fill: "transparent" }),
                /* @__PURE__ */ jsxRuntime.jsxs("g", { transform: `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`, children: [
                  display.sourceUnderlay ? /* @__PURE__ */ jsxRuntime.jsx(
                    SourceLayer,
                    {
                      document: snapshot.document,
                      source: snapshot.source,
                      sourceUrl
                    }
                  ) : null,
                  display.relations ? /* @__PURE__ */ jsxRuntime.jsx(RelationLayer, { document: snapshot.document, viewport }) : null,
                  /* @__PURE__ */ jsxRuntime.jsx(
                    GeometryLayer,
                    {
                      nodes: snapshot.document.geometry,
                      viewport,
                      selectedIds,
                      attentionIds,
                      onSelect: selectEntity
                    }
                  ),
                  display.annotations ? /* @__PURE__ */ jsxRuntime.jsx(
                    AnnotationLayer,
                    {
                      nodes: snapshot.document.annotations,
                      viewport,
                      selectedIds,
                      attentionIds,
                      onSelect: selectEntity
                    }
                  ) : null,
                  worldLayers
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(SelectionLayer, { box: selectionBox }),
                screenLayers
              ]
            }
          )
        }
      );
    }
    function eventScreenPoint(event) {
      const target = event.currentTarget;
      const svg = target.tagName.toLowerCase() === "svg" ? target : target.ownerSVGElement;
      const bounds = svg == null ? void 0 : svg.getBoundingClientRect();
      return [event.clientX - ((bounds == null ? void 0 : bounds.left) ?? 0), event.clientY - ((bounds == null ? void 0 : bounds.top) ?? 0)];
    }
    function isBlankCanvasTarget(event) {
      var _a2;
      const target = event.target;
      return target === event.currentTarget || ((_a2 = target.dataset) == null ? void 0 : _a2.canvasBackground) === "true";
    }
    function normalizeBounds(first, second) {
      return {
        minX: Math.min(first[0], second[0]),
        minY: Math.min(first[1], second[1]),
        maxX: Math.max(first[0], second[0]),
        maxY: Math.max(first[1], second[1])
      };
    }
    function PartitionOverlay({ draft, previewHeld, scale, onMoveBoundary }) {
      const [drag, setDrag] = react.useState(null);
      const current = react.useRef(null);
      const point = (z, r) => [
        draft.axis.origin[0] + draft.axis.direction[0] * z + draft.axis.normal[0] * r,
        draft.axis.origin[1] + draft.axis.direction[1] * z + draft.axis.normal[1] * r
      ];
      const pointerMove = (event) => {
        if (!current.current) return;
        const delta = (event.movementX * draft.axis.direction[0] - event.movementY * draft.axis.direction[1]) / Math.max(scale, 1e-6);
        current.current = { ...current.current, z: current.current.z + delta };
        setDrag(current.current);
      };
      const pointerUp = (event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        const value = current.current;
        current.current = null;
        setDrag(null);
        if (value) onMoveBoundary(value.index, value.z);
      };
      return /* @__PURE__ */ jsxRuntime.jsxs("g", { "data-partition-overlay": "true", children: [
        draft.segments.map((segment, index) => {
          const radius = Math.max(segment.profile.maxRadius, 0.1) * 1.04;
          const polygon = [point(segment.zStart, -radius), point(segment.zEnd, -radius), point(segment.zEnd, radius), point(segment.zStart, radius)];
          const origin = segment.semanticEvidenceIds.map((id) => {
            var _a2;
            return (_a2 = draft.evidence.find((item) => item.id === id)) == null ? void 0 : _a2.origin;
          }).find(Boolean) ?? "geometry";
          return /* @__PURE__ */ jsxRuntime.jsxs("g", { "data-partition-origin": origin, "data-segment-id": segment.id, children: [
            /* @__PURE__ */ jsxRuntime.jsx("polygon", { points: polygon.map((value) => value.join(",")).join(" "), className: `vai-partition-band vai-partition-band--${origin}`, "data-line-style": origin === "document" ? "solid" : origin === "ai" ? "dotted" : "dashed" }),
            /* @__PURE__ */ jsxRuntime.jsx("g", { transform: `translate(${point((segment.zStart + segment.zEnd) / 2, 0).join(" ")}) scale(1 -1)`, children: /* @__PURE__ */ jsxRuntime.jsx("text", { className: "vai-partition-label", textAnchor: "middle", children: segment.name ?? `S${index + 1}` }) })
          ] }, segment.id);
        }),
        !previewHeld && draft.segments.slice(0, -1).map((segment, offset) => {
          const index = offset + 1;
          const z = (drag == null ? void 0 : drag.index) === index ? drag.z : segment.zEnd;
          const position = point(z, 0);
          return /* @__PURE__ */ jsxRuntime.jsx(
            "circle",
            {
              "aria-label": `移动分区边界 ${index}`,
              className: "vai-partition-handle",
              cx: position[0],
              cy: position[1],
              r: 7 / Math.max(scale, 0.01),
              onPointerDown: (event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                current.current = { index, z };
                setDrag(current.current);
              },
              onPointerMove: pointerMove,
              onPointerUp: pointerUp,
              onPointerCancel: pointerUp
            },
            `boundary:${index}`
          );
        })
      ] });
    }
    function PartitionActionToolbar({ controller, previewHeld }) {
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-partition-actions", role: "toolbar", "aria-label": "分区确认工具栏", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "vai-partition-action vai-partition-action--cancel", "aria-label": "取消分区", title: "取消", onClick: () => void controller.actions.cancel().catch(() => void 0), children: "×" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: `vai-partition-action vai-partition-action--preview${previewHeld ? " is-held" : ""}`,
            "aria-label": "按住预览分区结果",
            title: "按住预览",
            onPointerDown: () => controller.actions.setPreviewHeld(true),
            onPointerUp: () => controller.actions.setPreviewHeld(false),
            onPointerCancel: () => controller.actions.setPreviewHeld(false),
            onPointerLeave: () => controller.actions.setPreviewHeld(false),
            children: "◉"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "vai-partition-action vai-partition-action--confirm", "aria-label": "确认分区", title: "确认", onClick: () => void controller.actions.confirm().catch(() => void 0), children: "✓" })
      ] });
    }
    function PartitionInspector({ draft, controller }) {
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-partition-inspector", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "轴段分区" }),
        /* @__PURE__ */ jsxRuntime.jsx("ol", { children: draft.segments.map((segment, index) => /* @__PURE__ */ jsxRuntime.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: segment.name ?? `轴段 S${index + 1}` }),
          /* @__PURE__ */ jsxRuntime.jsxs("small", { children: [
            segment.zStart.toFixed(2),
            " – ",
            segment.zEnd.toFixed(2),
            " · ⌀",
            (segment.profile.maxRadius * 2).toFixed(2)
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-partition-inspector__fields", children: [
            /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": `轴段 ${index + 1} 名称`, defaultValue: segment.name ?? "", placeholder: "名称", onBlur: (event) => void controller.actions.updateSegment(segment.id, { name: event.currentTarget.value }).catch(() => void 0) }),
            /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": `轴段 ${index + 1} 类型`, defaultValue: segment.semanticType ?? "", placeholder: "类型", onBlur: (event) => void controller.actions.updateSegment(segment.id, { semanticType: event.currentTarget.value }).catch(() => void 0) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-partition-inspector__commands", children: [
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": `拆分轴段 ${index + 1}`, onClick: () => void controller.actions.splitSegment(segment.id, (segment.zStart + segment.zEnd) / 2, Math.max(draft.axis.zMax * 3e-3, 0.05)).catch(() => void 0), children: "拆分" }),
            index > 0 && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": `合并边界 ${index}`, onClick: () => void controller.actions.mergeBoundary(index).catch(() => void 0), children: "与前段合并" })
          ] }),
          index < draft.segments.length - 1 && /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "vai-partition-inspector__boundary", children: [
            "结束位置",
            /* @__PURE__ */ jsxRuntime.jsx("input", { type: "number", step: "any", defaultValue: segment.zEnd, "aria-label": `边界 ${index + 1} 精确位置`, onKeyDown: (event) => {
              if (event.key === "Enter") void controller.actions.moveBoundary(index + 1, Number(event.currentTarget.value), 0).catch(() => void 0);
            } })
          ] })
        ] }, segment.id)) }),
        draft.diagnostics.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-partition-diagnostics", children: draft.diagnostics.map((diagnostic) => /* @__PURE__ */ jsxRuntime.jsx("p", { children: diagnostic.code }, diagnostic.id)) })
      ] });
    }
    function AnnotationWorkspace({ namespace, runtime, state, partition }) {
      var _a2;
      const snapshot = useObservable(runtime.snapshot);
      const viewport = useObservable(runtime.viewport);
      const selectedIds = useObservable(runtime.selection);
      const presentation = useObservable(runtime.presentation);
      const annotationState = useObservable(state);
      const partitionState = useObservable(partition.state);
      const [dxf, setDxf] = react.useState(null);
      const [engineering, setEngineering] = react.useState(null);
      const [showImport, setShowImport] = react.useState(false);
      const displaySnapshot = presentation.displaySnapshot ?? snapshot;
      const draft = partitionState.partition.draft;
      react.useEffect(() => {
        const release = () => partition.actions.setPreviewHeld(false);
        window.addEventListener("blur", release);
        return () => {
          window.removeEventListener("blur", release);
          release();
        };
      }, [partition]);
      return /* @__PURE__ */ jsxRuntime.jsxs(
        "section",
        {
          className: "vai-annotation-workspace",
          "data-annotation-workspace": "true",
          "data-drawing-surface-namespace": namespace,
          children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "vai-annotation-workspace__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "工程图自动标注" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: displaySnapshot === null ? "等待图纸" : `${displaySnapshot.ref.drawingId} · R${displaySnapshot.ref.revision}` }),
                (displaySnapshot == null ? void 0 : displaySnapshot.provisional) && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-annotation-provisional", children: "候选图纸" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { "data-annotation-workflow": annotationState.workflow.status, children: workflowLabel(annotationState.workflow.status) })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-annotation-workspace__body", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("nav", { className: "vai-annotation-workspace__rail", "aria-label": "标注流程", children: [
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "导入 DXF", title: "导入 DXF", onClick: () => setShowImport(true), children: "↥" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "图纸结构", title: "图纸结构", children: "⌗" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "标注候选", title: "标注候选", children: "⌖" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "冲突检查", title: "冲突检查", children: "△" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("main", { className: "vai-annotation-workspace__canvas", children: [
                displaySnapshot !== null && /* @__PURE__ */ jsxRuntime.jsx(
                  DrawingSurface,
                  {
                    snapshot: displaySnapshot,
                    viewport,
                    selectedIds,
                    display: presentation.display,
                    sourceUrl: presentation.sourceUrl,
                    className: "vai-canvas vai-annotation-workspace__surface",
                    onViewportChange: runtime.actions.setViewport,
                    onSelectionChange: runtime.actions.setSelection,
                    worldLayers: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntime.jsx("g", { "data-annotation-candidate-layer": "true", "data-preview-active": presentation.preview === null ? void 0 : "true", pointerEvents: "none" }),
                      draft && /* @__PURE__ */ jsxRuntime.jsx(
                        PartitionOverlay,
                        {
                          draft,
                          previewHeld: partitionState.previewHeld,
                          scale: viewport.scale,
                          onMoveBoundary: (index, z) => void partition.actions.moveBoundary(index, z, Math.max(draft.axis.zMax * 3e-3, 0.05)).catch(() => void 0)
                        }
                      )
                    ] })
                  }
                ),
                (displaySnapshot === null || showImport) && /* @__PURE__ */ jsxRuntime.jsxs("form", { className: "vai-annotation-import", onSubmit: (event) => {
                  event.preventDefault();
                  if (dxf) void partition.actions.importFiles(dxf, engineering ?? void 0).then(() => setShowImport(false)).catch(() => void 0);
                }, children: [
                  /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "导入轴类工程图" }),
                  /* @__PURE__ */ jsxRuntime.jsx("p", { children: "DXF 为必选；工程数据文档可选。普通聊天附件不会触发此流程。" }),
                  /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
                    "DXF 图纸",
                    /* @__PURE__ */ jsxRuntime.jsx("input", { type: "file", accept: ".dxf,application/dxf", onChange: (event) => {
                      var _a3;
                      return setDxf(((_a3 = event.currentTarget.files) == null ? void 0 : _a3[0]) ?? null);
                    } })
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
                    "工程数据文档（可选）",
                    /* @__PURE__ */ jsxRuntime.jsx("input", { type: "file", accept: ".txt,.ini,text/plain", onChange: (event) => {
                      var _a3;
                      return setEngineering(((_a3 = event.currentTarget.files) == null ? void 0 : _a3[0]) ?? null);
                    } })
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsx("button", { type: "submit", disabled: !dxf || partitionState.busy, children: partitionState.busy ? "正在分析…" : "导入并智能分区" }),
                  displaySnapshot !== null && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "vai-annotation-import__close", onClick: () => setShowImport(false), children: "关闭" }),
                  partitionState.error && /* @__PURE__ */ jsxRuntime.jsx("p", { role: "alert", children: partitionState.error })
                ] }),
                partitionState.partition.phase === "editing" && /* @__PURE__ */ jsxRuntime.jsx(PartitionActionToolbar, { controller: partition, previewHeld: partitionState.previewHeld }),
                (partitionState.partition.canUndo || partitionState.partition.canRedo) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-partition-history", role: "toolbar", "aria-label": "分区历史", children: [
                  /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "撤销分区", disabled: !partitionState.partition.canUndo, onClick: () => void partition.actions.undo().catch(() => void 0), children: "↶" }),
                  /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "aria-label": "重做分区", disabled: !partitionState.partition.canRedo, onClick: () => void partition.actions.redo().catch(() => void 0), children: "↷" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("aside", { className: "vai-annotation-workspace__inspector", children: draft && !partitionState.previewHeld ? /* @__PURE__ */ jsxRuntime.jsx(PartitionInspector, { draft, controller: partition }, partitionState.partition.updatedAt) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "标注检查" }),
                /* @__PURE__ */ jsxRuntime.jsxs("dl", { children: [
                  /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "流程" }),
                  /* @__PURE__ */ jsxRuntime.jsx("dd", { children: workflowLabel(annotationState.workflow.status) }),
                  /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "候选" }),
                  /* @__PURE__ */ jsxRuntime.jsx("dd", { children: ((_a2 = presentation.preview) == null ? void 0 : _a2.diff.createdNodeIds.length) ?? 0 }),
                  /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "选中" }),
                  /* @__PURE__ */ jsxRuntime.jsx("dd", { children: selectedIds.length })
                ] })
              ] }) })
            ] })
          ]
        }
      );
    }
    function useObservable(observable) {
      return react.useSyncExternalStore(observable.subscribe, observable.getSnapshot, observable.getSnapshot);
    }
    function workflowLabel(status) {
      return {
        idle: "待开始",
        running: "分析中",
        reviewing: "检查中",
        completed: "已完成",
        canceled: "已取消",
        failed: "需要处理",
        "needs-rebase": "图纸已变化"
      }[status];
    }
    function createAnnotationRemoteStateSource(remote, options = {}) {
      const entries = /* @__PURE__ */ new Map();
      const pollIntervalMs = options.pollIntervalMs ?? 1e3;
      const ensure = (sessionId) => {
        const current = entries.get(sessionId);
        if (current !== void 0) return current;
        const state = emptyState();
        const entry = {};
        entry.state = state;
        entry.claim = claimOf(state);
        entry.listeners = /* @__PURE__ */ new Set();
        const subscribe = (listener) => {
          entry.listeners.add(listener);
          if (entry.listeners.size === 1) {
            void refresh(sessionId);
            entry.timer = setInterval(() => {
              void refresh(sessionId);
            }, pollIntervalMs);
          }
          return () => {
            entry.listeners.delete(listener);
            if (entry.listeners.size === 0 && entry.timer !== void 0) {
              clearInterval(entry.timer);
              entry.timer = void 0;
            }
          };
        };
        entry.stateObservable = { getSnapshot: () => entry.state, subscribe };
        entry.claimObservable = { getSnapshot: () => entry.claim, subscribe };
        entries.set(sessionId, entry);
        return entry;
      };
      const refresh = async (sessionId) => {
        const entry = ensure(sessionId);
        if (entry.inFlight !== void 0) return entry.inFlight;
        entry.inFlight = (async () => {
          try {
            const result = await remote.getSessionState(sessionId);
            if (result.ok !== true) return;
            const next = structuredClone(result.value);
            if (JSON.stringify(next) === JSON.stringify(entry.state)) return;
            entry.state = next;
            entry.claim = claimOf(next);
            for (const listener of entry.listeners) listener();
          } finally {
            entry.inFlight = void 0;
          }
        })();
        return entry.inFlight;
      };
      return {
        claimSource: { observe: (sessionId) => ensure(sessionId).claimObservable },
        observeState: (sessionId) => ensure(sessionId).stateObservable,
        refresh,
        dispose() {
          for (const entry of entries.values()) {
            if (entry.timer !== void 0) clearInterval(entry.timer);
            entry.listeners.clear();
          }
          entries.clear();
        }
      };
    }
    function emptyState() {
      return {
        version: 1,
        workspaceClaimed: false,
        activationEpoch: 0,
        workflow: { status: "idle" }
      };
    }
    function claimOf(state) {
      return {
        active: state.workspaceClaimed,
        activationEpoch: state.activationEpoch
      };
    }
    var _a$1;
    function $constructor(name, initializer2, params) {
      function init(inst, def) {
        if (!inst._zod) {
          Object.defineProperty(inst, "_zod", {
            value: {
              def,
              constr: _,
              traits: /* @__PURE__ */ new Set()
            },
            enumerable: false
          });
        }
        if (inst._zod.traits.has(name)) {
          return;
        }
        inst._zod.traits.add(name);
        initializer2(inst, def);
        const proto = _.prototype;
        const keys = Object.keys(proto);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (!(k in inst)) {
            inst[k] = proto[k].bind(inst);
          }
        }
      }
      const Parent = (params == null ? void 0 : params.Parent) ?? Object;
      class Definition extends Parent {
      }
      Object.defineProperty(Definition, "name", { value: name });
      function _(def) {
        var _a2;
        const inst = (params == null ? void 0 : params.Parent) ? new Definition() : this;
        init(inst, def);
        (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
        for (const fn of inst._zod.deferred) {
          fn();
        }
        return inst;
      }
      Object.defineProperty(_, "init", { value: init });
      Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
          var _a2, _b;
          if ((params == null ? void 0 : params.Parent) && inst instanceof params.Parent)
            return true;
          return (_b = (_a2 = inst == null ? void 0 : inst._zod) == null ? void 0 : _a2.traits) == null ? void 0 : _b.has(name);
        }
      });
      Object.defineProperty(_, "name", { value: name });
      return _;
    }
    class $ZodAsyncError extends Error {
      constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
      }
    }
    class $ZodEncodeError extends Error {
      constructor(name) {
        super(`Encountered unidirectional transform during encode: ${name}`);
        this.name = "ZodEncodeError";
      }
    }
    (_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
    const globalConfig = globalThis.__zod_globalConfig;
    function config(newConfig) {
      return globalConfig;
    }
    function getEnumValues(entries) {
      const numericValues = Object.values(entries).filter((v) => typeof v === "number");
      const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
      return values;
    }
    function jsonStringifyReplacer(_, value) {
      if (typeof value === "bigint")
        return value.toString();
      return value;
    }
    function cached(getter) {
      return {
        get value() {
          {
            const value = getter();
            Object.defineProperty(this, "value", { value });
            return value;
          }
        }
      };
    }
    function nullish(input) {
      return input === null || input === void 0;
    }
    function cleanRegex(source) {
      const start = source.startsWith("^") ? 1 : 0;
      const end = source.endsWith("$") ? source.length - 1 : source.length;
      return source.slice(start, end);
    }
    function floatSafeRemainder(val, step) {
      const ratio = val / step;
      const roundedRatio = Math.round(ratio);
      const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
      if (Math.abs(ratio - roundedRatio) < tolerance)
        return 0;
      return ratio - roundedRatio;
    }
    const EVALUATING = /* @__PURE__ */ Symbol("evaluating");
    function defineLazy(object2, key, getter) {
      let value = void 0;
      Object.defineProperty(object2, key, {
        get() {
          if (value === EVALUATING) {
            return void 0;
          }
          if (value === void 0) {
            value = EVALUATING;
            value = getter();
          }
          return value;
        },
        set(v) {
          Object.defineProperty(object2, key, {
            value: v
            // configurable: true,
          });
        },
        configurable: true
      });
    }
    function assignProp(target, prop, value) {
      Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    function mergeDefs(...defs) {
      const mergedDescriptors = {};
      for (const def of defs) {
        const descriptors = Object.getOwnPropertyDescriptors(def);
        Object.assign(mergedDescriptors, descriptors);
      }
      return Object.defineProperties({}, mergedDescriptors);
    }
    function esc(str) {
      return JSON.stringify(str);
    }
    function slugify(input) {
      return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
    };
    function isObject(data) {
      return typeof data === "object" && data !== null && !Array.isArray(data);
    }
    const allowsEval = /* @__PURE__ */ cached(() => {
      var _a2;
      if (globalConfig.jitless) {
        return false;
      }
      if (typeof navigator !== "undefined" && ((_a2 = navigator == null ? void 0 : navigator.userAgent) == null ? void 0 : _a2.includes("Cloudflare"))) {
        return false;
      }
      try {
        const F = Function;
        new F("");
        return true;
      } catch (_) {
        return false;
      }
    });
    function isPlainObject(o) {
      if (isObject(o) === false)
        return false;
      const ctor = o.constructor;
      if (ctor === void 0)
        return true;
      if (typeof ctor !== "function")
        return true;
      const prot = ctor.prototype;
      if (isObject(prot) === false)
        return false;
      if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
        return false;
      }
      return true;
    }
    function shallowClone(o) {
      if (isPlainObject(o))
        return { ...o };
      if (Array.isArray(o))
        return [...o];
      if (o instanceof Map)
        return new Map(o);
      if (o instanceof Set)
        return new Set(o);
      return o;
    }
    const propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function clone(inst, def, params) {
      const cl = new inst._zod.constr(def ?? inst._zod.def);
      if (!def || (params == null ? void 0 : params.parent))
        cl._zod.parent = inst;
      return cl;
    }
    function normalizeParams(_params) {
      const params = _params;
      if (!params)
        return {};
      if (typeof params === "string")
        return { error: () => params };
      if ((params == null ? void 0 : params.message) !== void 0) {
        if ((params == null ? void 0 : params.error) !== void 0)
          throw new Error("Cannot specify both `message` and `error` params");
        params.error = params.message;
      }
      delete params.message;
      if (typeof params.error === "string")
        return { ...params, error: () => params.error };
      return params;
    }
    function optionalKeys(shape) {
      return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
      });
    }
    const NUMBER_FORMAT_RANGES = {
      safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      int32: [-2147483648, 2147483647],
      uint32: [0, 4294967295],
      float32: [-34028234663852886e22, 34028234663852886e22],
      float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
    };
    function pick(schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".pick() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const newShape = {};
          for (const key in mask) {
            if (!(key in currDef.shape)) {
              throw new Error(`Unrecognized key: "${key}"`);
            }
            if (!mask[key])
              continue;
            newShape[key] = currDef.shape[key];
          }
          assignProp(this, "shape", newShape);
          return newShape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    function omit(schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".omit() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const newShape = { ...schema._zod.def.shape };
          for (const key in mask) {
            if (!(key in currDef.shape)) {
              throw new Error(`Unrecognized key: "${key}"`);
            }
            if (!mask[key])
              continue;
            delete newShape[key];
          }
          assignProp(this, "shape", newShape);
          return newShape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    function extend(schema, shape) {
      if (!isPlainObject(shape)) {
        throw new Error("Invalid input to extend: expected a plain object");
      }
      const checks = schema._zod.def.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        const existingShape = schema._zod.def.shape;
        for (const key in shape) {
          if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
            throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
          }
        }
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const _shape = { ...schema._zod.def.shape, ...shape };
          assignProp(this, "shape", _shape);
          return _shape;
        }
      });
      return clone(schema, def);
    }
    function safeExtend(schema, shape) {
      if (!isPlainObject(shape)) {
        throw new Error("Invalid input to safeExtend: expected a plain object");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const _shape = { ...schema._zod.def.shape, ...shape };
          assignProp(this, "shape", _shape);
          return _shape;
        }
      });
      return clone(schema, def);
    }
    function merge(a, b) {
      var _a2;
      if ((_a2 = a._zod.def.checks) == null ? void 0 : _a2.length) {
        throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
      }
      const def = mergeDefs(a._zod.def, {
        get shape() {
          const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
          assignProp(this, "shape", _shape);
          return _shape;
        },
        get catchall() {
          return b._zod.def.catchall;
        },
        checks: b._zod.def.checks ?? []
      });
      return clone(a, def);
    }
    function partial(Class, schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".partial() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const oldShape = schema._zod.def.shape;
          const shape = { ...oldShape };
          if (mask) {
            for (const key in mask) {
              if (!(key in oldShape)) {
                throw new Error(`Unrecognized key: "${key}"`);
              }
              if (!mask[key])
                continue;
              shape[key] = Class ? new Class({
                type: "optional",
                innerType: oldShape[key]
              }) : oldShape[key];
            }
          } else {
            for (const key in oldShape) {
              shape[key] = Class ? new Class({
                type: "optional",
                innerType: oldShape[key]
              }) : oldShape[key];
            }
          }
          assignProp(this, "shape", shape);
          return shape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    function required(Class, schema, mask) {
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const oldShape = schema._zod.def.shape;
          const shape = { ...oldShape };
          if (mask) {
            for (const key in mask) {
              if (!(key in shape)) {
                throw new Error(`Unrecognized key: "${key}"`);
              }
              if (!mask[key])
                continue;
              shape[key] = new Class({
                type: "nonoptional",
                innerType: oldShape[key]
              });
            }
          } else {
            for (const key in oldShape) {
              shape[key] = new Class({
                type: "nonoptional",
                innerType: oldShape[key]
              });
            }
          }
          assignProp(this, "shape", shape);
          return shape;
        }
      });
      return clone(schema, def);
    }
    function aborted(x, startIndex = 0) {
      var _a2;
      if (x.aborted === true)
        return true;
      for (let i = startIndex; i < x.issues.length; i++) {
        if (((_a2 = x.issues[i]) == null ? void 0 : _a2.continue) !== true) {
          return true;
        }
      }
      return false;
    }
    function explicitlyAborted(x, startIndex = 0) {
      var _a2;
      if (x.aborted === true)
        return true;
      for (let i = startIndex; i < x.issues.length; i++) {
        if (((_a2 = x.issues[i]) == null ? void 0 : _a2.continue) === false) {
          return true;
        }
      }
      return false;
    }
    function prefixIssues(path, issues) {
      return issues.map((iss) => {
        var _a2;
        (_a2 = iss).path ?? (_a2.path = []);
        iss.path.unshift(path);
        return iss;
      });
    }
    function unwrapMessage(message) {
      return typeof message === "string" ? message : message == null ? void 0 : message.message;
    }
    function finalizeIssue(iss, ctx, config2) {
      var _a2, _b, _c, _d, _e, _f;
      const message = iss.message ? iss.message : unwrapMessage((_c = (_b = (_a2 = iss.inst) == null ? void 0 : _a2._zod.def) == null ? void 0 : _b.error) == null ? void 0 : _c.call(_b, iss)) ?? unwrapMessage((_d = ctx == null ? void 0 : ctx.error) == null ? void 0 : _d.call(ctx, iss)) ?? unwrapMessage((_e = config2.customError) == null ? void 0 : _e.call(config2, iss)) ?? unwrapMessage((_f = config2.localeError) == null ? void 0 : _f.call(config2, iss)) ?? "Invalid input";
      const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
      rest.path ?? (rest.path = []);
      rest.message = message;
      if (ctx == null ? void 0 : ctx.reportInput) {
        rest.input = _input;
      }
      return rest;
    }
    function getLengthableOrigin(input) {
      if (Array.isArray(input))
        return "array";
      if (typeof input === "string")
        return "string";
      return "unknown";
    }
    function issue(...args) {
      const [iss, input, inst] = args;
      if (typeof iss === "string") {
        return {
          message: iss,
          code: "custom",
          input,
          inst
        };
      }
      return { ...iss };
    }
    const initializer$1 = (inst, def) => {
      inst.name = "$ZodError";
      Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false
      });
      Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false
      });
      inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
      Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false
      });
    };
    const $ZodError = $constructor("$ZodError", initializer$1);
    const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
    function flattenError(error, mapper = (issue2) => issue2.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of error.issues) {
        if (sub.path.length > 0) {
          fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
          fieldErrors[sub.path[0]].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    function formatError(error, mapper = (issue2) => issue2.message) {
      const fieldErrors = { _errors: [] };
      const processError = (error2, path = []) => {
        for (const issue2 of error2.issues) {
          if (issue2.code === "invalid_union" && issue2.errors.length) {
            issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
          } else if (issue2.code === "invalid_key") {
            processError({ issues: issue2.issues }, [...path, ...issue2.path]);
          } else if (issue2.code === "invalid_element") {
            processError({ issues: issue2.issues }, [...path, ...issue2.path]);
          } else {
            const fullpath = [...path, ...issue2.path];
            if (fullpath.length === 0) {
              fieldErrors._errors.push(mapper(issue2));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < fullpath.length) {
                const el = fullpath[i];
                const terminal = i === fullpath.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue2));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        }
      };
      processError(error);
      return fieldErrors;
    }
    const _parse = (_Err) => (schema, value, _ctx, _params) => {
      const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
      const result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise) {
        throw new $ZodAsyncError();
      }
      if (result.issues.length) {
        const e = new ((_params == null ? void 0 : _params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params == null ? void 0 : _params.callee);
        throw e;
      }
      return result.value;
    };
    const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
      const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
      let result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise)
        result = await result;
      if (result.issues.length) {
        const e = new ((params == null ? void 0 : params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params == null ? void 0 : params.callee);
        throw e;
      }
      return result.value;
    };
    const _safeParse = (_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
      const result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise) {
        throw new $ZodAsyncError();
      }
      return result.issues.length ? {
        success: false,
        error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
      } : { success: true, data: result.value };
    };
    const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
    const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
      let result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise)
        result = await result;
      return result.issues.length ? {
        success: false,
        error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
      } : { success: true, data: result.value };
    };
    const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
    const _encode = (_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return _parse(_Err)(schema, value, ctx);
    };
    const _decode = (_Err) => (schema, value, _ctx) => {
      return _parse(_Err)(schema, value, _ctx);
    };
    const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return _parseAsync(_Err)(schema, value, ctx);
    };
    const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
      return _parseAsync(_Err)(schema, value, _ctx);
    };
    const _safeEncode = (_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return _safeParse(_Err)(schema, value, ctx);
    };
    const _safeDecode = (_Err) => (schema, value, _ctx) => {
      return _safeParse(_Err)(schema, value, _ctx);
    };
    const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return _safeParseAsync(_Err)(schema, value, ctx);
    };
    const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
      return _safeParseAsync(_Err)(schema, value, _ctx);
    };
    const cuid = /^[cC][0-9a-z]{6,}$/;
    const cuid2 = /^[0-9a-z]+$/;
    const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
    const xid = /^[0-9a-vA-V]{20}$/;
    const ksuid = /^[A-Za-z0-9]{27}$/;
    const nanoid = /^[a-zA-Z0-9_-]{21}$/;
    const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
    const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
    const uuid = (version2) => {
      if (!version2)
        return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
      return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
    };
    const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
    const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    function emoji() {
      return new RegExp(_emoji$1, "u");
    }
    const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
    const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    const base64$1 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
    const base64url = /^[A-Za-z0-9_-]*$/;
    const httpProtocol = /^https?$/;
    const e164 = /^\+[1-9]\d{6,14}$/;
    const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
    const date$1 = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
    function timeSource(args) {
      const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
      const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
      return regex;
    }
    function time$1(args) {
      return new RegExp(`^${timeSource(args)}$`);
    }
    function datetime$1(args) {
      const time2 = timeSource({ precision: args.precision });
      const opts = ["Z"];
      if (args.local)
        opts.push("");
      if (args.offset)
        opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
      const timeRegex = `${time2}(?:${opts.join("|")})`;
      return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
    }
    const string$1 = (params) => {
      const regex = params ? `[\\s\\S]{${(params == null ? void 0 : params.minimum) ?? 0},${(params == null ? void 0 : params.maximum) ?? ""}}` : `[\\s\\S]*`;
      return new RegExp(`^${regex}$`);
    };
    const integer = /^-?\d+$/;
    const number$1 = /^-?\d+(?:\.\d+)?$/;
    const boolean$1 = /^(?:true|false)$/i;
    const lowercase = /^[^A-Z]*$/;
    const uppercase = /^[^a-z]*$/;
    const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
      var _a2;
      inst._zod ?? (inst._zod = {});
      inst._zod.def = def;
      (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
    });
    const numericOriginMap = {
      number: "number",
      bigint: "bigint",
      object: "date"
    };
    const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
      $ZodCheck.init(inst, def);
      const origin = numericOriginMap[typeof def.value];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
        if (def.value < curr) {
          if (def.inclusive)
            bag.maximum = def.value;
          else
            bag.exclusiveMaximum = def.value;
        }
      });
      inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
          return;
        }
        payload.issues.push({
          origin,
          code: "too_big",
          maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
          input: payload.value,
          inclusive: def.inclusive,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
      $ZodCheck.init(inst, def);
      const origin = numericOriginMap[typeof def.value];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
        if (def.value > curr) {
          if (def.inclusive)
            bag.minimum = def.value;
          else
            bag.exclusiveMinimum = def.value;
        }
      });
      inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
          return;
        }
        payload.issues.push({
          origin,
          code: "too_small",
          minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
          input: payload.value,
          inclusive: def.inclusive,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
      $ZodCheck.init(inst, def);
      inst._zod.onattach.push((inst2) => {
        var _a2;
        (_a2 = inst2._zod.bag).multipleOf ?? (_a2.multipleOf = def.value);
      });
      inst._zod.check = (payload) => {
        if (typeof payload.value !== typeof def.value)
          throw new Error("Cannot mix number and bigint in multiple_of check.");
        const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
        if (isMultiple)
          return;
        payload.issues.push({
          origin: typeof payload.value,
          code: "not_multiple_of",
          divisor: def.value,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
      var _a2;
      $ZodCheck.init(inst, def);
      def.format = def.format || "float64";
      const isInt = (_a2 = def.format) == null ? void 0 : _a2.includes("int");
      const origin = isInt ? "int" : "number";
      const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
        if (isInt)
          bag.pattern = integer;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        if (isInt) {
          if (!Number.isInteger(input)) {
            payload.issues.push({
              expected: origin,
              format: def.format,
              code: "invalid_type",
              continue: false,
              input,
              inst
            });
            return;
          }
          if (!Number.isSafeInteger(input)) {
            if (input > 0) {
              payload.issues.push({
                input,
                code: "too_big",
                maximum: Number.MAX_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst,
                origin,
                inclusive: true,
                continue: !def.abort
              });
            } else {
              payload.issues.push({
                input,
                code: "too_small",
                minimum: Number.MIN_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst,
                origin,
                inclusive: true,
                continue: !def.abort
              });
            }
            return;
          }
        }
        if (input < minimum) {
          payload.issues.push({
            origin: "number",
            input,
            code: "too_small",
            minimum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
        if (input > maximum) {
          payload.issues.push({
            origin: "number",
            input,
            code: "too_big",
            maximum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
      var _a2;
      $ZodCheck.init(inst, def);
      (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
        if (def.maximum < curr)
          inst2._zod.bag.maximum = def.maximum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length <= def.maximum)
          return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
          origin,
          code: "too_big",
          maximum: def.maximum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
      var _a2;
      $ZodCheck.init(inst, def);
      (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
        if (def.minimum > curr)
          inst2._zod.bag.minimum = def.minimum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length >= def.minimum)
          return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
          origin,
          code: "too_small",
          minimum: def.minimum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
      var _a2;
      $ZodCheck.init(inst, def);
      (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.minimum = def.length;
        bag.maximum = def.length;
        bag.length = def.length;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length === def.length)
          return;
        const origin = getLengthableOrigin(input);
        const tooBig = length > def.length;
        payload.issues.push({
          origin,
          ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
          inclusive: true,
          exact: true,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
      var _a2, _b;
      $ZodCheck.init(inst, def);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.format = def.format;
        if (def.pattern) {
          bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
          bag.patterns.add(def.pattern);
        }
      });
      if (def.pattern)
        (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
          def.pattern.lastIndex = 0;
          if (def.pattern.test(payload.value))
            return;
          payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: def.format,
            input: payload.value,
            ...def.pattern ? { pattern: def.pattern.toString() } : {},
            inst,
            continue: !def.abort
          });
        });
      else
        (_b = inst._zod).check ?? (_b.check = () => {
        });
    });
    const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
      $ZodCheckStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "regex",
          input: payload.value,
          pattern: def.pattern.toString(),
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
      def.pattern ?? (def.pattern = lowercase);
      $ZodCheckStringFormat.init(inst, def);
    });
    const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
      def.pattern ?? (def.pattern = uppercase);
      $ZodCheckStringFormat.init(inst, def);
    });
    const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
      $ZodCheck.init(inst, def);
      const escapedRegex = escapeRegex(def.includes);
      const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
      def.pattern = pattern;
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.includes(def.includes, def.position))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "includes",
          includes: def.includes,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
      $ZodCheck.init(inst, def);
      const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
      def.pattern ?? (def.pattern = pattern);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.startsWith(def.prefix))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "starts_with",
          prefix: def.prefix,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
      $ZodCheck.init(inst, def);
      const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
      def.pattern ?? (def.pattern = pattern);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.endsWith(def.suffix))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "ends_with",
          suffix: def.suffix,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
      $ZodCheck.init(inst, def);
      inst._zod.check = (payload) => {
        payload.value = def.tx(payload.value);
      };
    });
    class Doc {
      constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
          this.args = args;
      }
      indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
      }
      write(arg) {
        if (typeof arg === "function") {
          arg(this, { execution: "sync" });
          arg(this, { execution: "async" });
          return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
          this.content.push(line);
        }
      }
      compile() {
        const F = Function;
        const args = this == null ? void 0 : this.args;
        const content = (this == null ? void 0 : this.content) ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        return new F(...args, lines.join("\n"));
      }
    }
    const version = {
      major: 4,
      minor: 4,
      patch: 3
    };
    const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
      var _a3;
      var _a2;
      inst ?? (inst = {});
      inst._zod.def = def;
      inst._zod.bag = inst._zod.bag || {};
      inst._zod.version = version;
      const checks = [...inst._zod.def.checks ?? []];
      if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
      }
      for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
          fn(inst);
        }
      }
      if (checks.length === 0) {
        (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
        (_a3 = inst._zod.deferred) == null ? void 0 : _a3.push(() => {
          inst._zod.run = inst._zod.parse;
        });
      } else {
        const runChecks = (payload, checks2, ctx) => {
          let isAborted = aborted(payload);
          let asyncResult;
          for (const ch of checks2) {
            if (ch._zod.def.when) {
              if (explicitlyAborted(payload))
                continue;
              const shouldRun = ch._zod.def.when(payload);
              if (!shouldRun)
                continue;
            } else if (isAborted) {
              continue;
            }
            const currLen = payload.issues.length;
            const _ = ch._zod.check(payload);
            if (_ instanceof Promise && (ctx == null ? void 0 : ctx.async) === false) {
              throw new $ZodAsyncError();
            }
            if (asyncResult || _ instanceof Promise) {
              asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                await _;
                const nextLen = payload.issues.length;
                if (nextLen === currLen)
                  return;
                if (!isAborted)
                  isAborted = aborted(payload, currLen);
              });
            } else {
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                continue;
              if (!isAborted)
                isAborted = aborted(payload, currLen);
            }
          }
          if (asyncResult) {
            return asyncResult.then(() => {
              return payload;
            });
          }
          return payload;
        };
        const handleCanaryResult = (canary, payload, ctx) => {
          if (aborted(canary)) {
            canary.aborted = true;
            return canary;
          }
          const checkResult = runChecks(payload, checks, ctx);
          if (checkResult instanceof Promise) {
            if (ctx.async === false)
              throw new $ZodAsyncError();
            return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
          }
          return inst._zod.parse(checkResult, ctx);
        };
        inst._zod.run = (payload, ctx) => {
          if (ctx.skipChecks) {
            return inst._zod.parse(payload, ctx);
          }
          if (ctx.direction === "backward") {
            const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
            if (canary instanceof Promise) {
              return canary.then((canary2) => {
                return handleCanaryResult(canary2, payload, ctx);
              });
            }
            return handleCanaryResult(canary, payload, ctx);
          }
          const result = inst._zod.parse(payload, ctx);
          if (result instanceof Promise) {
            if (ctx.async === false)
              throw new $ZodAsyncError();
            return result.then((result2) => runChecks(result2, checks, ctx));
          }
          return runChecks(result, checks, ctx);
        };
      }
      defineLazy(inst, "~standard", () => ({
        validate: (value) => {
          var _a4;
          try {
            const r = safeParse$1(inst, value);
            return r.success ? { value: r.data } : { issues: (_a4 = r.error) == null ? void 0 : _a4.issues };
          } catch (_) {
            return safeParseAsync$1(inst, value).then((r) => {
              var _a5;
              return r.success ? { value: r.data } : { issues: (_a5 = r.error) == null ? void 0 : _a5.issues };
            });
          }
        },
        vendor: "zod",
        version: 1
      }));
    });
    const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
      var _a2;
      $ZodType.init(inst, def);
      inst._zod.pattern = [...((_a2 = inst == null ? void 0 : inst._zod.bag) == null ? void 0 : _a2.patterns) ?? []].pop() ?? string$1(inst._zod.bag);
      inst._zod.parse = (payload, _) => {
        if (def.coerce)
          try {
            payload.value = String(payload.value);
          } catch (_2) {
          }
        if (typeof payload.value === "string")
          return payload;
        payload.issues.push({
          expected: "string",
          code: "invalid_type",
          input: payload.value,
          inst
        });
        return payload;
      };
    });
    const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
      $ZodCheckStringFormat.init(inst, def);
      $ZodString.init(inst, def);
    });
    const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
      def.pattern ?? (def.pattern = guid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
      if (def.version) {
        const versionMap = {
          v1: 1,
          v2: 2,
          v3: 3,
          v4: 4,
          v5: 5,
          v6: 6,
          v7: 7,
          v8: 8
        };
        const v = versionMap[def.version];
        if (v === void 0)
          throw new Error(`Invalid UUID version: "${def.version}"`);
        def.pattern ?? (def.pattern = uuid(v));
      } else
        def.pattern ?? (def.pattern = uuid());
      $ZodStringFormat.init(inst, def);
    });
    const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
      def.pattern ?? (def.pattern = email);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
      $ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        var _a2;
        try {
          const trimmed = payload.value.trim();
          if (!def.normalize && ((_a2 = def.protocol) == null ? void 0 : _a2.source) === httpProtocol.source) {
            if (!/^https?:\/\//i.test(trimmed)) {
              payload.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid URL format",
                input: payload.value,
                inst,
                continue: !def.abort
              });
              return;
            }
          }
          const url = new URL(trimmed);
          if (def.hostname) {
            def.hostname.lastIndex = 0;
            if (!def.hostname.test(url.hostname)) {
              payload.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid hostname",
                pattern: def.hostname.source,
                input: payload.value,
                inst,
                continue: !def.abort
              });
            }
          }
          if (def.protocol) {
            def.protocol.lastIndex = 0;
            if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
              payload.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid protocol",
                pattern: def.protocol.source,
                input: payload.value,
                inst,
                continue: !def.abort
              });
            }
          }
          if (def.normalize) {
            payload.value = url.href;
          } else {
            payload.value = trimmed;
          }
          return;
        } catch (_) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
      def.pattern ?? (def.pattern = emoji());
      $ZodStringFormat.init(inst, def);
    });
    const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
      def.pattern ?? (def.pattern = nanoid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
      def.pattern ?? (def.pattern = cuid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
      def.pattern ?? (def.pattern = cuid2);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
      def.pattern ?? (def.pattern = ulid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
      def.pattern ?? (def.pattern = xid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
      def.pattern ?? (def.pattern = ksuid);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
      def.pattern ?? (def.pattern = datetime$1(def));
      $ZodStringFormat.init(inst, def);
    });
    const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
      def.pattern ?? (def.pattern = date$1);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
      def.pattern ?? (def.pattern = time$1(def));
      $ZodStringFormat.init(inst, def);
    });
    const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
      def.pattern ?? (def.pattern = duration$1);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
      def.pattern ?? (def.pattern = ipv4);
      $ZodStringFormat.init(inst, def);
      inst._zod.bag.format = `ipv4`;
    });
    const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
      def.pattern ?? (def.pattern = ipv6);
      $ZodStringFormat.init(inst, def);
      inst._zod.bag.format = `ipv6`;
      inst._zod.check = (payload) => {
        try {
          new URL(`http://[${payload.value}]`);
        } catch {
          payload.issues.push({
            code: "invalid_format",
            format: "ipv6",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
      def.pattern ?? (def.pattern = cidrv4);
      $ZodStringFormat.init(inst, def);
    });
    const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
      def.pattern ?? (def.pattern = cidrv6);
      $ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        const parts = payload.value.split("/");
        try {
          if (parts.length !== 2)
            throw new Error();
          const [address, prefix] = parts;
          if (!prefix)
            throw new Error();
          const prefixNum = Number(prefix);
          if (`${prefixNum}` !== prefix)
            throw new Error();
          if (prefixNum < 0 || prefixNum > 128)
            throw new Error();
          new URL(`http://[${address}]`);
        } catch {
          payload.issues.push({
            code: "invalid_format",
            format: "cidrv6",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    function isValidBase64(data) {
      if (data === "")
        return true;
      if (/\s/.test(data))
        return false;
      if (data.length % 4 !== 0)
        return false;
      try {
        atob(data);
        return true;
      } catch {
        return false;
      }
    }
    const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
      def.pattern ?? (def.pattern = base64$1);
      $ZodStringFormat.init(inst, def);
      inst._zod.bag.contentEncoding = "base64";
      inst._zod.check = (payload) => {
        if (isValidBase64(payload.value))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "base64",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    function isValidBase64URL(data) {
      if (!base64url.test(data))
        return false;
      const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
      const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
      return isValidBase64(padded);
    }
    const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
      def.pattern ?? (def.pattern = base64url);
      $ZodStringFormat.init(inst, def);
      inst._zod.bag.contentEncoding = "base64url";
      inst._zod.check = (payload) => {
        if (isValidBase64URL(payload.value))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "base64url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
      def.pattern ?? (def.pattern = e164);
      $ZodStringFormat.init(inst, def);
    });
    function isValidJWT(token, algorithm = null) {
      try {
        const tokensParts = token.split(".");
        if (tokensParts.length !== 3)
          return false;
        const [header] = tokensParts;
        if (!header)
          return false;
        const parsedHeader = JSON.parse(atob(header));
        if ("typ" in parsedHeader && (parsedHeader == null ? void 0 : parsedHeader.typ) !== "JWT")
          return false;
        if (!parsedHeader.alg)
          return false;
        if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
          return false;
        return true;
      } catch {
        return false;
      }
    }
    const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
      $ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        if (isValidJWT(payload.value, def.alg))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "jwt",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
          try {
            payload.value = Number(payload.value);
          } catch (_) {
          }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
          return payload;
        }
        const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
        payload.issues.push({
          expected: "number",
          code: "invalid_type",
          input,
          inst,
          ...received ? { received } : {}
        });
        return payload;
      };
    });
    const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
      $ZodCheckNumberFormat.init(inst, def);
      $ZodNumber.init(inst, def);
    });
    const $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.pattern = boolean$1;
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
          try {
            payload.value = Boolean(payload.value);
          } catch (_) {
          }
        const input = payload.value;
        if (typeof input === "boolean")
          return payload;
        payload.issues.push({
          expected: "boolean",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.parse = (payload) => payload;
    });
    const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        payload.issues.push({
          expected: "never",
          code: "invalid_type",
          input: payload.value,
          inst
        });
        return payload;
      };
    });
    function handleArrayResult(result, final, index) {
      if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
      }
      final.value[index] = result.value;
    }
    const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
          payload.issues.push({
            expected: "array",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
          const item = input[i];
          const result = def.element._zod.run({
            value: item,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
          } else {
            handleArrayResult(result, payload, i);
          }
        }
        if (proms.length) {
          return Promise.all(proms).then(() => payload);
        }
        return payload;
      };
    });
    function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
      const isPresent = key in input;
      if (result.issues.length) {
        if (isOptionalIn && isOptionalOut && !isPresent) {
          return;
        }
        final.issues.push(...prefixIssues(key, result.issues));
      }
      if (!isPresent && !isOptionalIn) {
        if (!result.issues.length) {
          final.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: void 0,
            path: [key]
          });
        }
        return;
      }
      if (result.value === void 0) {
        if (isPresent) {
          final.value[key] = void 0;
        }
      } else {
        final.value[key] = result.value;
      }
    }
    function normalizeDef(def) {
      var _a2, _b, _c, _d;
      const keys = Object.keys(def.shape);
      for (const k of keys) {
        if (!((_d = (_c = (_b = (_a2 = def.shape) == null ? void 0 : _a2[k]) == null ? void 0 : _b._zod) == null ? void 0 : _c.traits) == null ? void 0 : _d.has("$ZodType"))) {
          throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
      }
      const okeys = optionalKeys(def.shape);
      return {
        ...def,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys)
      };
    }
    function handleCatchall(proms, input, payload, ctx, def, inst) {
      const unrecognized = [];
      const keySet = def.keySet;
      const _catchall = def.catchall._zod;
      const t = _catchall.def.type;
      const isOptionalIn = _catchall.optin === "optional";
      const isOptionalOut = _catchall.optout === "optional";
      for (const key in input) {
        if (key === "__proto__")
          continue;
        if (keySet.has(key))
          continue;
        if (t === "never") {
          unrecognized.push(key);
          continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
        } else {
          handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
        }
      }
      if (unrecognized.length) {
        payload.issues.push({
          code: "unrecognized_keys",
          keys: unrecognized,
          input,
          inst
        });
      }
      if (!proms.length)
        return payload;
      return Promise.all(proms).then(() => {
        return payload;
      });
    }
    const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
      $ZodType.init(inst, def);
      const desc = Object.getOwnPropertyDescriptor(def, "shape");
      if (!(desc == null ? void 0 : desc.get)) {
        const sh = def.shape;
        Object.defineProperty(def, "shape", {
          get: () => {
            const newSh = { ...sh };
            Object.defineProperty(def, "shape", {
              value: newSh
            });
            return newSh;
          }
        });
      }
      const _normalized = cached(() => normalizeDef(def));
      defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
          const field = shape[key]._zod;
          if (field.values) {
            propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
            for (const v of field.values)
              propValues[key].add(v);
          }
        }
        return propValues;
      });
      const isObject$1 = isObject;
      const catchall = def.catchall;
      let value;
      inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
          payload.issues.push({
            expected: "object",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        payload.value = {};
        const proms = [];
        const shape = value.shape;
        for (const key of value.keys) {
          const el = shape[key];
          const isOptionalIn = el._zod.optin === "optional";
          const isOptionalOut = el._zod.optout === "optional";
          const r = el._zod.run({ value: input[key], issues: [] }, ctx);
          if (r instanceof Promise) {
            proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
          } else {
            handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
          }
        }
        if (!catchall) {
          return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
      };
    });
    const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
      $ZodObject.init(inst, def);
      const superParse = inst._zod.parse;
      const _normalized = cached(() => normalizeDef(def));
      const generateFastpass = (shape) => {
        var _a2, _b;
        const doc = new Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
          const k = esc(key);
          return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = /* @__PURE__ */ Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
          ids[key] = `key_${counter++}`;
        }
        doc.write(`const newResult = {};`);
        for (const key of normalized.keys) {
          const id = ids[key];
          const k = esc(key);
          const schema = shape[key];
          const isOptionalIn = ((_a2 = schema == null ? void 0 : schema._zod) == null ? void 0 : _a2.optin) === "optional";
          const isOptionalOut = ((_b = schema == null ? void 0 : schema._zod) == null ? void 0 : _b.optout) === "optional";
          doc.write(`const ${id} = ${parseStr(key)};`);
          if (isOptionalIn && isOptionalOut) {
            doc.write(`
            if (${id}.issues.length) {
              if (${k} in input) {
                payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
                  ...iss,
                  path: iss.path ? [${k}, ...iss.path] : [${k}]
                })));
              }
            }

            if (${id}.value === undefined) {
              if (${k} in input) {
                newResult[${k}] = undefined;
              }
            } else {
              newResult[${k}] = ${id}.value;
            }

          `);
          } else if (!isOptionalIn) {
            doc.write(`
            const ${id}_present = ${k} in input;
            if (${id}.issues.length) {
              payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
                ...iss,
                path: iss.path ? [${k}, ...iss.path] : [${k}]
              })));
            }
            if (!${id}_present && !${id}.issues.length) {
              payload.issues.push({
                code: "invalid_type",
                expected: "nonoptional",
                input: undefined,
                path: [${k}]
              });
            }

            if (${id}_present) {
              if (${id}.value === undefined) {
                newResult[${k}] = undefined;
              } else {
                newResult[${k}] = ${id}.value;
              }
            }

          `);
          } else {
            doc.write(`
            if (${id}.issues.length) {
              payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
                ...iss,
                path: iss.path ? [${k}, ...iss.path] : [${k}]
              })));
            }

            if (${id}.value === undefined) {
              if (${k} in input) {
                newResult[${k}] = undefined;
              }
            } else {
              newResult[${k}] = ${id}.value;
            }

          `);
          }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
      };
      let fastpass;
      const isObject$1 = isObject;
      const jit = !globalConfig.jitless;
      const allowsEval$1 = allowsEval;
      const fastEnabled = jit && allowsEval$1.value;
      const catchall = def.catchall;
      let value;
      inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
          payload.issues.push({
            expected: "object",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        if (jit && fastEnabled && (ctx == null ? void 0 : ctx.async) === false && ctx.jitless !== true) {
          if (!fastpass)
            fastpass = generateFastpass(def.shape);
          payload = fastpass(payload, ctx);
          if (!catchall)
            return payload;
          return handleCatchall([], input, payload, ctx, value, inst);
        }
        return superParse(payload, ctx);
      };
    });
    function handleUnionResults(results, final, inst, ctx) {
      for (const result of results) {
        if (result.issues.length === 0) {
          final.value = result.value;
          return final;
        }
      }
      const nonaborted = results.filter((r) => !aborted(r));
      if (nonaborted.length === 1) {
        final.value = nonaborted[0].value;
        return nonaborted[0];
      }
      final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
      });
      return final;
    }
    const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
      $ZodType.init(inst, def);
      defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
      defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
      defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
          return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return void 0;
      });
      defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
          const patterns = def.options.map((o) => o._zod.pattern);
          return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
        }
        return void 0;
      });
      const first = def.options.length === 1 ? def.options[0]._zod.run : null;
      inst._zod.parse = (payload, ctx) => {
        if (first) {
          return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
          const result = option._zod.run({
            value: payload.value,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            results.push(result);
            async = true;
          } else {
            if (result.issues.length === 0)
              return result;
            results.push(result);
          }
        }
        if (!async)
          return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results2) => {
          return handleUnionResults(results2, payload, inst, ctx);
        });
      };
    });
    const $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
      def.inclusive = false;
      $ZodUnion.init(inst, def);
      const _super = inst._zod.parse;
      defineLazy(inst._zod, "propValues", () => {
        const propValues = {};
        for (const option of def.options) {
          const pv = option._zod.propValues;
          if (!pv || Object.keys(pv).length === 0)
            throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
          for (const [k, v] of Object.entries(pv)) {
            if (!propValues[k])
              propValues[k] = /* @__PURE__ */ new Set();
            for (const val of v) {
              propValues[k].add(val);
            }
          }
        }
        return propValues;
      });
      const disc = cached(() => {
        var _a2;
        const opts = def.options;
        const map = /* @__PURE__ */ new Map();
        for (const o of opts) {
          const values = (_a2 = o._zod.propValues) == null ? void 0 : _a2[def.discriminator];
          if (!values || values.size === 0)
            throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
          for (const v of values) {
            if (map.has(v)) {
              throw new Error(`Duplicate discriminator value "${String(v)}"`);
            }
            map.set(v, o);
          }
        }
        return map;
      });
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!isObject(input)) {
          payload.issues.push({
            code: "invalid_type",
            expected: "object",
            input,
            inst
          });
          return payload;
        }
        const opt = disc.value.get(input == null ? void 0 : input[def.discriminator]);
        if (opt) {
          return opt._zod.run(payload, ctx);
        }
        if (def.unionFallback || ctx.direction === "backward") {
          return _super(payload, ctx);
        }
        payload.issues.push({
          code: "invalid_union",
          errors: [],
          note: "No matching discriminator",
          discriminator: def.discriminator,
          options: Array.from(disc.value.keys()),
          input,
          path: [def.discriminator],
          inst
        });
        return payload;
      };
    });
    const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        const left = def.left._zod.run({ value: input, issues: [] }, ctx);
        const right = def.right._zod.run({ value: input, issues: [] }, ctx);
        const async = left instanceof Promise || right instanceof Promise;
        if (async) {
          return Promise.all([left, right]).then(([left2, right2]) => {
            return handleIntersectionResults(payload, left2, right2);
          });
        }
        return handleIntersectionResults(payload, left, right);
      };
    });
    function mergeValues(a, b) {
      if (a === b) {
        return { valid: true, data: a };
      }
      if (a instanceof Date && b instanceof Date && +a === +b) {
        return { valid: true, data: a };
      }
      if (isPlainObject(a) && isPlainObject(b)) {
        const bKeys = Object.keys(b);
        const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
          const sharedValue = mergeValues(a[key], b[key]);
          if (!sharedValue.valid) {
            return {
              valid: false,
              mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
            };
          }
          newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
          return { valid: false, mergeErrorPath: [] };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
          const itemA = a[index];
          const itemB = b[index];
          const sharedValue = mergeValues(itemA, itemB);
          if (!sharedValue.valid) {
            return {
              valid: false,
              mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
            };
          }
          newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
      }
      return { valid: false, mergeErrorPath: [] };
    }
    function handleIntersectionResults(result, left, right) {
      const unrecKeys = /* @__PURE__ */ new Map();
      let unrecIssue;
      for (const iss of left.issues) {
        if (iss.code === "unrecognized_keys") {
          unrecIssue ?? (unrecIssue = iss);
          for (const k of iss.keys) {
            if (!unrecKeys.has(k))
              unrecKeys.set(k, {});
            unrecKeys.get(k).l = true;
          }
        } else {
          result.issues.push(iss);
        }
      }
      for (const iss of right.issues) {
        if (iss.code === "unrecognized_keys") {
          for (const k of iss.keys) {
            if (!unrecKeys.has(k))
              unrecKeys.set(k, {});
            unrecKeys.get(k).r = true;
          }
        } else {
          result.issues.push(iss);
        }
      }
      const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
      if (bothKeys.length && unrecIssue) {
        result.issues.push({ ...unrecIssue, keys: bothKeys });
      }
      if (aborted(result))
        return result;
      const merged = mergeValues(left.value, right.value);
      if (!merged.valid) {
        throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
      }
      result.value = merged.data;
      return result;
    }
    const $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
      $ZodType.init(inst, def);
      const items = def.items;
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
          payload.issues.push({
            input,
            inst,
            expected: "tuple",
            code: "invalid_type"
          });
          return payload;
        }
        payload.value = [];
        const proms = [];
        const optinStart = getTupleOptStart(items, "optin");
        const optoutStart = getTupleOptStart(items, "optout");
        if (!def.rest) {
          if (input.length < optinStart) {
            payload.issues.push({
              code: "too_small",
              minimum: optinStart,
              inclusive: true,
              input,
              inst,
              origin: "array"
            });
            return payload;
          }
          if (input.length > items.length) {
            payload.issues.push({
              code: "too_big",
              maximum: items.length,
              inclusive: true,
              input,
              inst,
              origin: "array"
            });
          }
        }
        const itemResults = new Array(items.length);
        for (let i = 0; i < items.length; i++) {
          const r = items[i]._zod.run({ value: input[i], issues: [] }, ctx);
          if (r instanceof Promise) {
            proms.push(r.then((rr) => {
              itemResults[i] = rr;
            }));
          } else {
            itemResults[i] = r;
          }
        }
        if (def.rest) {
          let i = items.length - 1;
          const rest = input.slice(items.length);
          for (const el of rest) {
            i++;
            const result = def.rest._zod.run({ value: el, issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((r) => handleTupleResult(r, payload, i)));
            } else {
              handleTupleResult(result, payload, i);
            }
          }
        }
        if (proms.length) {
          return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
        }
        return handleTupleResults(itemResults, payload, items, input, optoutStart);
      };
    });
    function getTupleOptStart(items, key) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i]._zod[key] !== "optional")
          return i + 1;
      }
      return 0;
    }
    function handleTupleResult(result, final, index) {
      if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
      }
      final.value[index] = result.value;
    }
    function handleTupleResults(itemResults, final, items, input, optoutStart) {
      for (let i = 0; i < items.length; i++) {
        const r = itemResults[i];
        const isPresent = i < input.length;
        if (r.issues.length) {
          if (!isPresent && i >= optoutStart) {
            final.value.length = i;
            break;
          }
          final.issues.push(...prefixIssues(i, r.issues));
        }
        final.value[i] = r.value;
      }
      for (let i = final.value.length - 1; i >= input.length; i--) {
        if (items[i]._zod.optout === "optional" && final.value[i] === void 0) {
          final.value.length = i;
        } else {
          break;
        }
      }
      return final;
    }
    const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!isPlainObject(input)) {
          payload.issues.push({
            expected: "record",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        const proms = [];
        const values = def.keyType._zod.values;
        if (values) {
          payload.value = {};
          const recordKeys = /* @__PURE__ */ new Set();
          for (const key of values) {
            if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
              recordKeys.add(typeof key === "number" ? key.toString() : key);
              const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
              if (keyResult instanceof Promise) {
                throw new Error("Async schemas not supported in object keys currently");
              }
              if (keyResult.issues.length) {
                payload.issues.push({
                  code: "invalid_key",
                  origin: "record",
                  issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                  input: key,
                  path: [key],
                  inst
                });
                continue;
              }
              const outKey = keyResult.value;
              const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
              if (result instanceof Promise) {
                proms.push(result.then((result2) => {
                  if (result2.issues.length) {
                    payload.issues.push(...prefixIssues(key, result2.issues));
                  }
                  payload.value[outKey] = result2.value;
                }));
              } else {
                if (result.issues.length) {
                  payload.issues.push(...prefixIssues(key, result.issues));
                }
                payload.value[outKey] = result.value;
              }
            }
          }
          let unrecognized;
          for (const key in input) {
            if (!recordKeys.has(key)) {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            }
          }
          if (unrecognized && unrecognized.length > 0) {
            payload.issues.push({
              code: "unrecognized_keys",
              input,
              inst,
              keys: unrecognized
            });
          }
        } else {
          payload.value = {};
          for (const key of Reflect.ownKeys(input)) {
            if (key === "__proto__")
              continue;
            if (!Object.prototype.propertyIsEnumerable.call(input, key))
              continue;
            let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
            if (keyResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            const checkNumericKey = typeof key === "string" && number$1.test(key) && keyResult.issues.length;
            if (checkNumericKey) {
              const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
              if (retryResult instanceof Promise) {
                throw new Error("Async schemas not supported in object keys currently");
              }
              if (retryResult.issues.length === 0) {
                keyResult = retryResult;
              }
            }
            if (keyResult.issues.length) {
              if (def.mode === "loose") {
                payload.value[key] = input[key];
              } else {
                payload.issues.push({
                  code: "invalid_key",
                  origin: "record",
                  issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                  input: key,
                  path: [key],
                  inst
                });
              }
              continue;
            }
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => {
                if (result2.issues.length) {
                  payload.issues.push(...prefixIssues(key, result2.issues));
                }
                payload.value[keyResult.value] = result2.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[keyResult.value] = result.value;
            }
          }
        }
        if (proms.length) {
          return Promise.all(proms).then(() => payload);
        }
        return payload;
      };
    });
    const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
      $ZodType.init(inst, def);
      const values = getEnumValues(def.entries);
      const valuesSet = new Set(values);
      inst._zod.values = valuesSet;
      inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (valuesSet.has(input)) {
          return payload;
        }
        payload.issues.push({
          code: "invalid_value",
          values,
          input,
          inst
        });
        return payload;
      };
    });
    const $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
      $ZodType.init(inst, def);
      if (def.values.length === 0) {
        throw new Error("Cannot create literal schema with no valid values");
      }
      const values = new Set(def.values);
      inst._zod.values = values;
      inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (values.has(input)) {
          return payload;
        }
        payload.issues.push({
          code: "invalid_value",
          values: def.values,
          input,
          inst
        });
        return payload;
      };
    });
    const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.optin = "optional";
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          throw new $ZodEncodeError(inst.constructor.name);
        }
        const _out = def.transform(payload.value, payload);
        if (ctx.async) {
          const output = _out instanceof Promise ? _out : Promise.resolve(_out);
          return output.then((output2) => {
            payload.value = output2;
            payload.fallback = true;
            return payload;
          });
        }
        if (_out instanceof Promise) {
          throw new $ZodAsyncError();
        }
        payload.value = _out;
        payload.fallback = true;
        return payload;
      };
    });
    function handleOptionalResult(result, input) {
      if (input === void 0 && (result.issues.length || result.fallback)) {
        return { issues: [], value: void 0 };
      }
      return result;
    }
    const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.optin = "optional";
      inst._zod.optout = "optional";
      defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
      });
      defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
          const input = payload.value;
          const result = def.innerType._zod.run(payload, ctx);
          if (result instanceof Promise)
            return result.then((r) => handleOptionalResult(r, input));
          return handleOptionalResult(result, input);
        }
        if (payload.value === void 0) {
          return payload;
        }
        return def.innerType._zod.run(payload, ctx);
      };
    });
    const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
      $ZodOptional.init(inst, def);
      defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
      inst._zod.parse = (payload, ctx) => {
        return def.innerType._zod.run(payload, ctx);
      };
    });
    const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
      $ZodType.init(inst, def);
      defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
      defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
      defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
      });
      defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        if (payload.value === null)
          return payload;
        return def.innerType._zod.run(payload, ctx);
      };
    });
    const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.optin = "optional";
      defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === void 0) {
          payload.value = def.defaultValue;
          return payload;
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => handleDefaultResult(result2, def));
        }
        return handleDefaultResult(result, def);
      };
    });
    function handleDefaultResult(payload, def) {
      if (payload.value === void 0) {
        payload.value = def.defaultValue;
      }
      return payload;
    }
    const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.optin = "optional";
      defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === void 0) {
          payload.value = def.defaultValue;
        }
        return def.innerType._zod.run(payload, ctx);
      };
    });
    const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
      $ZodType.init(inst, def);
      defineLazy(inst._zod, "values", () => {
        const v = def.innerType._zod.values;
        return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => handleNonOptionalResult(result2, inst));
        }
        return handleNonOptionalResult(result, inst);
      };
    });
    function handleNonOptionalResult(payload, inst) {
      if (!payload.issues.length && payload.value === void 0) {
        payload.issues.push({
          code: "invalid_type",
          expected: "nonoptional",
          input: payload.value,
          inst
        });
      }
      return payload;
    }
    const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
      $ZodType.init(inst, def);
      inst._zod.optin = "optional";
      defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
      defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => {
            payload.value = result2.value;
            if (result2.issues.length) {
              payload.value = def.catchValue({
                ...payload,
                error: {
                  issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
                },
                input: payload.value
              });
              payload.issues = [];
              payload.fallback = true;
            }
            return payload;
          });
        }
        payload.value = result.value;
        if (result.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
          payload.fallback = true;
        }
        return payload;
      };
    });
    const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
      $ZodType.init(inst, def);
      defineLazy(inst._zod, "values", () => def.in._zod.values);
      defineLazy(inst._zod, "optin", () => def.in._zod.optin);
      defineLazy(inst._zod, "optout", () => def.out._zod.optout);
      defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          const right = def.out._zod.run(payload, ctx);
          if (right instanceof Promise) {
            return right.then((right2) => handlePipeResult(right2, def.in, ctx));
          }
          return handlePipeResult(right, def.in, ctx);
        }
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
          return left.then((left2) => handlePipeResult(left2, def.out, ctx));
        }
        return handlePipeResult(left, def.out, ctx);
      };
    });
    function handlePipeResult(left, next, ctx) {
      if (left.issues.length) {
        left.aborted = true;
        return left;
      }
      return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
    }
    const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
      $ZodType.init(inst, def);
      defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
      defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      defineLazy(inst._zod, "optin", () => {
        var _a2, _b;
        return (_b = (_a2 = def.innerType) == null ? void 0 : _a2._zod) == null ? void 0 : _b.optin;
      });
      defineLazy(inst._zod, "optout", () => {
        var _a2, _b;
        return (_b = (_a2 = def.innerType) == null ? void 0 : _a2._zod) == null ? void 0 : _b.optout;
      });
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then(handleReadonlyResult);
        }
        return handleReadonlyResult(result);
      };
    });
    function handleReadonlyResult(payload) {
      payload.value = Object.freeze(payload.value);
      return payload;
    }
    const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
      $ZodCheck.init(inst, def);
      $ZodType.init(inst, def);
      inst._zod.parse = (payload, _) => {
        return payload;
      };
      inst._zod.check = (payload) => {
        const input = payload.value;
        const r = def.fn(input);
        if (r instanceof Promise) {
          return r.then((r2) => handleRefineResult(r2, payload, input, inst));
        }
        handleRefineResult(r, payload, input, inst);
        return;
      };
    });
    function handleRefineResult(result, payload, input, inst) {
      if (!result) {
        const _iss = {
          code: "custom",
          input,
          inst,
          // incorporates params.error into issue reporting
          path: [...inst._zod.def.path ?? []],
          // incorporates params.error into issue reporting
          continue: !inst._zod.def.abort
          // params: inst._zod.def.params,
        };
        if (inst._zod.def.params)
          _iss.params = inst._zod.def.params;
        payload.issues.push(issue(_iss));
      }
    }
    var _a;
    class $ZodRegistry {
      constructor() {
        this._map = /* @__PURE__ */ new WeakMap();
        this._idmap = /* @__PURE__ */ new Map();
      }
      add(schema, ..._meta) {
        const meta = _meta[0];
        this._map.set(schema, meta);
        if (meta && typeof meta === "object" && "id" in meta) {
          this._idmap.set(meta.id, schema);
        }
        return this;
      }
      clear() {
        this._map = /* @__PURE__ */ new WeakMap();
        this._idmap = /* @__PURE__ */ new Map();
        return this;
      }
      remove(schema) {
        const meta = this._map.get(schema);
        if (meta && typeof meta === "object" && "id" in meta) {
          this._idmap.delete(meta.id);
        }
        this._map.delete(schema);
        return this;
      }
      get(schema) {
        const p = schema._zod.parent;
        if (p) {
          const pm = { ...this.get(p) ?? {} };
          delete pm.id;
          const f = { ...pm, ...this._map.get(schema) };
          return Object.keys(f).length ? f : void 0;
        }
        return this._map.get(schema);
      }
      has(schema) {
        return this._map.has(schema);
      }
    }
    function registry() {
      return new $ZodRegistry();
    }
    (_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
    const globalRegistry = globalThis.__zod_globalRegistry;
    // @__NO_SIDE_EFFECTS__
    function _string(Class, params) {
      return new Class({
        type: "string",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _email(Class, params) {
      return new Class({
        type: "string",
        format: "email",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _guid(Class, params) {
      return new Class({
        type: "string",
        format: "guid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _uuid(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _uuidv4(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v4",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _uuidv6(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v6",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _uuidv7(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v7",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _url(Class, params) {
      return new Class({
        type: "string",
        format: "url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _emoji(Class, params) {
      return new Class({
        type: "string",
        format: "emoji",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _nanoid(Class, params) {
      return new Class({
        type: "string",
        format: "nanoid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _cuid(Class, params) {
      return new Class({
        type: "string",
        format: "cuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _cuid2(Class, params) {
      return new Class({
        type: "string",
        format: "cuid2",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _ulid(Class, params) {
      return new Class({
        type: "string",
        format: "ulid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _xid(Class, params) {
      return new Class({
        type: "string",
        format: "xid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _ksuid(Class, params) {
      return new Class({
        type: "string",
        format: "ksuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _ipv4(Class, params) {
      return new Class({
        type: "string",
        format: "ipv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _ipv6(Class, params) {
      return new Class({
        type: "string",
        format: "ipv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _cidrv4(Class, params) {
      return new Class({
        type: "string",
        format: "cidrv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _cidrv6(Class, params) {
      return new Class({
        type: "string",
        format: "cidrv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _base64(Class, params) {
      return new Class({
        type: "string",
        format: "base64",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _base64url(Class, params) {
      return new Class({
        type: "string",
        format: "base64url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _e164(Class, params) {
      return new Class({
        type: "string",
        format: "e164",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _jwt(Class, params) {
      return new Class({
        type: "string",
        format: "jwt",
        check: "string_format",
        abort: false,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _isoDateTime(Class, params) {
      return new Class({
        type: "string",
        format: "datetime",
        check: "string_format",
        offset: false,
        local: false,
        precision: null,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _isoDate(Class, params) {
      return new Class({
        type: "string",
        format: "date",
        check: "string_format",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _isoTime(Class, params) {
      return new Class({
        type: "string",
        format: "time",
        check: "string_format",
        precision: null,
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _isoDuration(Class, params) {
      return new Class({
        type: "string",
        format: "duration",
        check: "string_format",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _number(Class, params) {
      return new Class({
        type: "number",
        checks: [],
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _int(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "safeint",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _boolean(Class, params) {
      return new Class({
        type: "boolean",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _unknown(Class) {
      return new Class({
        type: "unknown"
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _never(Class, params) {
      return new Class({
        type: "never",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _lt(value, params) {
      return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: false
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _lte(value, params) {
      return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: true
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _gt(value, params) {
      return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: false
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _gte(value, params) {
      return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: true
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _multipleOf(value, params) {
      return new $ZodCheckMultipleOf({
        check: "multiple_of",
        ...normalizeParams(params),
        value
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _maxLength(maximum, params) {
      const ch = new $ZodCheckMaxLength({
        check: "max_length",
        ...normalizeParams(params),
        maximum
      });
      return ch;
    }
    // @__NO_SIDE_EFFECTS__
    function _minLength(minimum, params) {
      return new $ZodCheckMinLength({
        check: "min_length",
        ...normalizeParams(params),
        minimum
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _length(length, params) {
      return new $ZodCheckLengthEquals({
        check: "length_equals",
        ...normalizeParams(params),
        length
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _regex(pattern, params) {
      return new $ZodCheckRegex({
        check: "string_format",
        format: "regex",
        ...normalizeParams(params),
        pattern
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _lowercase(params) {
      return new $ZodCheckLowerCase({
        check: "string_format",
        format: "lowercase",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _uppercase(params) {
      return new $ZodCheckUpperCase({
        check: "string_format",
        format: "uppercase",
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _includes(includes, params) {
      return new $ZodCheckIncludes({
        check: "string_format",
        format: "includes",
        ...normalizeParams(params),
        includes
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _startsWith(prefix, params) {
      return new $ZodCheckStartsWith({
        check: "string_format",
        format: "starts_with",
        ...normalizeParams(params),
        prefix
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _endsWith(suffix, params) {
      return new $ZodCheckEndsWith({
        check: "string_format",
        format: "ends_with",
        ...normalizeParams(params),
        suffix
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _overwrite(tx) {
      return new $ZodCheckOverwrite({
        check: "overwrite",
        tx
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _normalize(form) {
      return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
    }
    // @__NO_SIDE_EFFECTS__
    function _trim() {
      return /* @__PURE__ */ _overwrite((input) => input.trim());
    }
    // @__NO_SIDE_EFFECTS__
    function _toLowerCase() {
      return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
    }
    // @__NO_SIDE_EFFECTS__
    function _toUpperCase() {
      return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
    }
    // @__NO_SIDE_EFFECTS__
    function _slugify() {
      return /* @__PURE__ */ _overwrite((input) => slugify(input));
    }
    // @__NO_SIDE_EFFECTS__
    function _array(Class, element, params) {
      return new Class({
        type: "array",
        element,
        // get element() {
        //   return element;
        // },
        ...normalizeParams(params)
      });
    }
    // @__NO_SIDE_EFFECTS__
    function _refine(Class, fn, _params) {
      const schema = new Class({
        type: "custom",
        check: "custom",
        fn,
        ...normalizeParams(_params)
      });
      return schema;
    }
    // @__NO_SIDE_EFFECTS__
    function _superRefine(fn, params) {
      const ch = /* @__PURE__ */ _check((payload) => {
        payload.addIssue = (issue$1) => {
          if (typeof issue$1 === "string") {
            payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
          } else {
            const _issue = issue$1;
            if (_issue.fatal)
              _issue.continue = false;
            _issue.code ?? (_issue.code = "custom");
            _issue.input ?? (_issue.input = payload.value);
            _issue.inst ?? (_issue.inst = ch);
            _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
            payload.issues.push(issue(_issue));
          }
        };
        return fn(payload.value, payload);
      }, params);
      return ch;
    }
    // @__NO_SIDE_EFFECTS__
    function _check(fn, params) {
      const ch = new $ZodCheck({
        check: "custom",
        ...normalizeParams(params)
      });
      ch._zod.check = fn;
      return ch;
    }
    function initializeContext(params) {
      let target = (params == null ? void 0 : params.target) ?? "draft-2020-12";
      if (target === "draft-4")
        target = "draft-04";
      if (target === "draft-7")
        target = "draft-07";
      return {
        processors: params.processors ?? {},
        metadataRegistry: (params == null ? void 0 : params.metadata) ?? globalRegistry,
        target,
        unrepresentable: (params == null ? void 0 : params.unrepresentable) ?? "throw",
        override: (params == null ? void 0 : params.override) ?? (() => {
        }),
        io: (params == null ? void 0 : params.io) ?? "output",
        counter: 0,
        seen: /* @__PURE__ */ new Map(),
        cycles: (params == null ? void 0 : params.cycles) ?? "ref",
        reused: (params == null ? void 0 : params.reused) ?? "inline",
        external: (params == null ? void 0 : params.external) ?? void 0
      };
    }
    function process(schema, ctx, _params = { path: [], schemaPath: [] }) {
      var _a3, _b;
      var _a2;
      const def = schema._zod.def;
      const seen = ctx.seen.get(schema);
      if (seen) {
        seen.count++;
        const isCycle = _params.schemaPath.includes(schema);
        if (isCycle) {
          seen.cycle = _params.path;
        }
        return seen.schema;
      }
      const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
      ctx.seen.set(schema, result);
      const overrideSchema = (_b = (_a3 = schema._zod).toJSONSchema) == null ? void 0 : _b.call(_a3);
      if (overrideSchema) {
        result.schema = overrideSchema;
      } else {
        const params = {
          ..._params,
          schemaPath: [..._params.schemaPath, schema],
          path: _params.path
        };
        if (schema._zod.processJSONSchema) {
          schema._zod.processJSONSchema(ctx, result.schema, params);
        } else {
          const _json = result.schema;
          const processor = ctx.processors[def.type];
          if (!processor) {
            throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
          }
          processor(schema, ctx, _json, params);
        }
        const parent = schema._zod.parent;
        if (parent) {
          if (!result.ref)
            result.ref = parent;
          process(parent, ctx, params);
          ctx.seen.get(parent).isParent = true;
        }
      }
      const meta = ctx.metadataRegistry.get(schema);
      if (meta)
        Object.assign(result.schema, meta);
      if (ctx.io === "input" && isTransforming(schema)) {
        delete result.schema.examples;
        delete result.schema.default;
      }
      if (ctx.io === "input" && "_prefault" in result.schema)
        (_a2 = result.schema).default ?? (_a2.default = result.schema._prefault);
      delete result.schema._prefault;
      const _result = ctx.seen.get(schema);
      return _result.schema;
    }
    function extractDefs(ctx, schema) {
      var _a2, _b, _c, _d;
      const root = ctx.seen.get(schema);
      if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
      const idToSchema = /* @__PURE__ */ new Map();
      for (const entry of ctx.seen.entries()) {
        const id = (_a2 = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _a2.id;
        if (id) {
          const existing = idToSchema.get(id);
          if (existing && existing !== entry[0]) {
            throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
          }
          idToSchema.set(id, entry[0]);
        }
      }
      const makeURI = (entry) => {
        var _a3;
        const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
        if (ctx.external) {
          const externalId = (_a3 = ctx.external.registry.get(entry[0])) == null ? void 0 : _a3.id;
          const uriGenerator = ctx.external.uri ?? ((id2) => id2);
          if (externalId) {
            return { ref: uriGenerator(externalId) };
          }
          const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
          entry[1].defId = id;
          return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
        }
        if (entry[1] === root) {
          return { ref: "#" };
        }
        const uriPrefix = `#`;
        const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
        const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
        return { defId, ref: defUriPrefix + defId };
      };
      const extractToDef = (entry) => {
        if (entry[1].schema.$ref) {
          return;
        }
        const seen = entry[1];
        const { ref, defId } = makeURI(entry);
        seen.def = { ...seen.schema };
        if (defId)
          seen.defId = defId;
        const schema2 = seen.schema;
        for (const key in schema2) {
          delete schema2[key];
        }
        schema2.$ref = ref;
      };
      if (ctx.cycles === "throw") {
        for (const entry of ctx.seen.entries()) {
          const seen = entry[1];
          if (seen.cycle) {
            throw new Error(`Cycle detected: #/${(_b = seen.cycle) == null ? void 0 : _b.join("/")}/<root>

    Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
          }
        }
      }
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (schema === entry[0]) {
          extractToDef(entry);
          continue;
        }
        if (ctx.external) {
          const ext = (_c = ctx.external.registry.get(entry[0])) == null ? void 0 : _c.id;
          if (schema !== entry[0] && ext) {
            extractToDef(entry);
            continue;
          }
        }
        const id = (_d = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _d.id;
        if (id) {
          extractToDef(entry);
          continue;
        }
        if (seen.cycle) {
          extractToDef(entry);
          continue;
        }
        if (seen.count > 1) {
          if (ctx.reused === "ref") {
            extractToDef(entry);
            continue;
          }
        }
      }
    }
    function finalize(ctx, schema) {
      var _a2, _b, _c, _d;
      const root = ctx.seen.get(schema);
      if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
      const flattenRef = (zodSchema) => {
        const seen = ctx.seen.get(zodSchema);
        if (seen.ref === null)
          return;
        const schema2 = seen.def ?? seen.schema;
        const _cached = { ...schema2 };
        const ref = seen.ref;
        seen.ref = null;
        if (ref) {
          flattenRef(ref);
          const refSeen = ctx.seen.get(ref);
          const refSchema = refSeen.schema;
          if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
            schema2.allOf = schema2.allOf ?? [];
            schema2.allOf.push(refSchema);
          } else {
            Object.assign(schema2, refSchema);
          }
          Object.assign(schema2, _cached);
          const isParentRef = zodSchema._zod.parent === ref;
          if (isParentRef) {
            for (const key in schema2) {
              if (key === "$ref" || key === "allOf")
                continue;
              if (!(key in _cached)) {
                delete schema2[key];
              }
            }
          }
          if (refSchema.$ref && refSeen.def) {
            for (const key in schema2) {
              if (key === "$ref" || key === "allOf")
                continue;
              if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
                delete schema2[key];
              }
            }
          }
        }
        const parent = zodSchema._zod.parent;
        if (parent && parent !== ref) {
          flattenRef(parent);
          const parentSeen = ctx.seen.get(parent);
          if (parentSeen == null ? void 0 : parentSeen.schema.$ref) {
            schema2.$ref = parentSeen.schema.$ref;
            if (parentSeen.def) {
              for (const key in schema2) {
                if (key === "$ref" || key === "allOf")
                  continue;
                if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
                  delete schema2[key];
                }
              }
            }
          }
        }
        ctx.override({
          zodSchema,
          jsonSchema: schema2,
          path: seen.path ?? []
        });
      };
      for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
      }
      const result = {};
      if (ctx.target === "draft-2020-12") {
        result.$schema = "https://json-schema.org/draft/2020-12/schema";
      } else if (ctx.target === "draft-07") {
        result.$schema = "http://json-schema.org/draft-07/schema#";
      } else if (ctx.target === "draft-04") {
        result.$schema = "http://json-schema.org/draft-04/schema#";
      } else if (ctx.target === "openapi-3.0") ;
      else ;
      if ((_a2 = ctx.external) == null ? void 0 : _a2.uri) {
        const id = (_b = ctx.external.registry.get(schema)) == null ? void 0 : _b.id;
        if (!id)
          throw new Error("Schema is missing an `id` property");
        result.$id = ctx.external.uri(id);
      }
      Object.assign(result, root.def ?? root.schema);
      const rootMetaId = (_c = ctx.metadataRegistry.get(schema)) == null ? void 0 : _c.id;
      if (rootMetaId !== void 0 && result.id === rootMetaId)
        delete result.id;
      const defs = ((_d = ctx.external) == null ? void 0 : _d.defs) ?? {};
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
          if (seen.def.id === seen.defId)
            delete seen.def.id;
          defs[seen.defId] = seen.def;
        }
      }
      if (ctx.external) ;
      else {
        if (Object.keys(defs).length > 0) {
          if (ctx.target === "draft-2020-12") {
            result.$defs = defs;
          } else {
            result.definitions = defs;
          }
        }
      }
      try {
        const finalized = JSON.parse(JSON.stringify(result));
        Object.defineProperty(finalized, "~standard", {
          value: {
            ...schema["~standard"],
            jsonSchema: {
              input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
              output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
            }
          },
          enumerable: false,
          writable: false
        });
        return finalized;
      } catch (_err) {
        throw new Error("Error converting schema to JSON.");
      }
    }
    function isTransforming(_schema, _ctx) {
      const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
      if (ctx.seen.has(_schema))
        return false;
      ctx.seen.add(_schema);
      const def = _schema._zod.def;
      if (def.type === "transform")
        return true;
      if (def.type === "array")
        return isTransforming(def.element, ctx);
      if (def.type === "set")
        return isTransforming(def.valueType, ctx);
      if (def.type === "lazy")
        return isTransforming(def.getter(), ctx);
      if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
        return isTransforming(def.innerType, ctx);
      }
      if (def.type === "intersection") {
        return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
      }
      if (def.type === "record" || def.type === "map") {
        return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
      }
      if (def.type === "pipe") {
        if (_schema._zod.traits.has("$ZodCodec"))
          return true;
        return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
      }
      if (def.type === "object") {
        for (const key in def.shape) {
          if (isTransforming(def.shape[key], ctx))
            return true;
        }
        return false;
      }
      if (def.type === "union") {
        for (const option of def.options) {
          if (isTransforming(option, ctx))
            return true;
        }
        return false;
      }
      if (def.type === "tuple") {
        for (const item of def.items) {
          if (isTransforming(item, ctx))
            return true;
        }
        if (def.rest && isTransforming(def.rest, ctx))
          return true;
        return false;
      }
      return false;
    }
    const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
      const ctx = initializeContext({ ...params, processors });
      process(schema, ctx);
      extractDefs(ctx, schema);
      return finalize(ctx, schema);
    };
    const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
      const { libraryOptions, target } = params ?? {};
      const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
      process(schema, ctx);
      extractDefs(ctx, schema);
      return finalize(ctx, schema);
    };
    const formatMap = {
      guid: "uuid",
      url: "uri",
      datetime: "date-time",
      json_string: "json-string",
      regex: ""
      // do not set
    };
    const stringProcessor = (schema, ctx, _json, _params) => {
      const json = _json;
      json.type = "string";
      const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minLength = minimum;
      if (typeof maximum === "number")
        json.maxLength = maximum;
      if (format) {
        json.format = formatMap[format] ?? format;
        if (json.format === "")
          delete json.format;
        if (format === "time") {
          delete json.format;
        }
      }
      if (contentEncoding)
        json.contentEncoding = contentEncoding;
      if (patterns && patterns.size > 0) {
        const regexes = [...patterns];
        if (regexes.length === 1)
          json.pattern = regexes[0].source;
        else if (regexes.length > 1) {
          json.allOf = [
            ...regexes.map((regex) => ({
              ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
              pattern: regex.source
            }))
          ];
        }
      }
    };
    const numberProcessor = (schema, ctx, _json, _params) => {
      const json = _json;
      const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
      if (typeof format === "string" && format.includes("int"))
        json.type = "integer";
      else
        json.type = "number";
      const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
      const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
      const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
      if (exMin) {
        if (legacy) {
          json.minimum = exclusiveMinimum;
          json.exclusiveMinimum = true;
        } else {
          json.exclusiveMinimum = exclusiveMinimum;
        }
      } else if (typeof minimum === "number") {
        json.minimum = minimum;
      }
      if (exMax) {
        if (legacy) {
          json.maximum = exclusiveMaximum;
          json.exclusiveMaximum = true;
        } else {
          json.exclusiveMaximum = exclusiveMaximum;
        }
      } else if (typeof maximum === "number") {
        json.maximum = maximum;
      }
      if (typeof multipleOf === "number")
        json.multipleOf = multipleOf;
    };
    const booleanProcessor = (_schema, _ctx, json, _params) => {
      json.type = "boolean";
    };
    const neverProcessor = (_schema, _ctx, json, _params) => {
      json.not = {};
    };
    const unknownProcessor = (_schema, _ctx, _json, _params) => {
    };
    const enumProcessor = (schema, _ctx, json, _params) => {
      const def = schema._zod.def;
      const values = getEnumValues(def.entries);
      if (values.every((v) => typeof v === "number"))
        json.type = "number";
      if (values.every((v) => typeof v === "string"))
        json.type = "string";
      json.enum = values;
    };
    const literalProcessor = (schema, ctx, json, _params) => {
      const def = schema._zod.def;
      const vals = [];
      for (const val of def.values) {
        if (val === void 0) {
          if (ctx.unrepresentable === "throw") {
            throw new Error("Literal `undefined` cannot be represented in JSON Schema");
          }
        } else if (typeof val === "bigint") {
          if (ctx.unrepresentable === "throw") {
            throw new Error("BigInt literals cannot be represented in JSON Schema");
          } else {
            vals.push(Number(val));
          }
        } else {
          vals.push(val);
        }
      }
      if (vals.length === 0) ;
      else if (vals.length === 1) {
        const val = vals[0];
        json.type = val === null ? "null" : typeof val;
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
          json.enum = [val];
        } else {
          json.const = val;
        }
      } else {
        if (vals.every((v) => typeof v === "number"))
          json.type = "number";
        if (vals.every((v) => typeof v === "string"))
          json.type = "string";
        if (vals.every((v) => typeof v === "boolean"))
          json.type = "boolean";
        if (vals.every((v) => v === null))
          json.type = "null";
        json.enum = vals;
      }
    };
    const customProcessor = (_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Custom types cannot be represented in JSON Schema");
      }
    };
    const transformProcessor = (_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Transforms cannot be represented in JSON Schema");
      }
    };
    const arrayProcessor = (schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      const { minimum, maximum } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minItems = minimum;
      if (typeof maximum === "number")
        json.maxItems = maximum;
      json.type = "array";
      json.items = process(def.element, ctx, {
        ...params,
        path: [...params.path, "items"]
      });
    };
    const objectProcessor = (schema, ctx, _json, params) => {
      var _a2;
      const json = _json;
      const def = schema._zod.def;
      json.type = "object";
      json.properties = {};
      const shape = def.shape;
      for (const key in shape) {
        json.properties[key] = process(shape[key], ctx, {
          ...params,
          path: [...params.path, "properties", key]
        });
      }
      const allKeys = new Set(Object.keys(shape));
      const requiredKeys = new Set([...allKeys].filter((key) => {
        const v = def.shape[key]._zod;
        if (ctx.io === "input") {
          return v.optin === void 0;
        } else {
          return v.optout === void 0;
        }
      }));
      if (requiredKeys.size > 0) {
        json.required = Array.from(requiredKeys);
      }
      if (((_a2 = def.catchall) == null ? void 0 : _a2._zod.def.type) === "never") {
        json.additionalProperties = false;
      } else if (!def.catchall) {
        if (ctx.io === "output")
          json.additionalProperties = false;
      } else if (def.catchall) {
        json.additionalProperties = process(def.catchall, ctx, {
          ...params,
          path: [...params.path, "additionalProperties"]
        });
      }
    };
    const unionProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      const isExclusive = def.inclusive === false;
      const options = def.options.map((x, i) => process(x, ctx, {
        ...params,
        path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
      }));
      if (isExclusive) {
        json.oneOf = options;
      } else {
        json.anyOf = options;
      }
    };
    const intersectionProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      const a = process(def.left, ctx, {
        ...params,
        path: [...params.path, "allOf", 0]
      });
      const b = process(def.right, ctx, {
        ...params,
        path: [...params.path, "allOf", 1]
      });
      const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
      const allOf = [
        ...isSimpleIntersection(a) ? a.allOf : [a],
        ...isSimpleIntersection(b) ? b.allOf : [b]
      ];
      json.allOf = allOf;
    };
    const tupleProcessor = (schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      json.type = "array";
      const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
      const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
      const prefixItems = def.items.map((x, i) => process(x, ctx, {
        ...params,
        path: [...params.path, prefixPath, i]
      }));
      const rest = def.rest ? process(def.rest, ctx, {
        ...params,
        path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
      }) : null;
      if (ctx.target === "draft-2020-12") {
        json.prefixItems = prefixItems;
        if (rest) {
          json.items = rest;
        }
      } else if (ctx.target === "openapi-3.0") {
        json.items = {
          anyOf: prefixItems
        };
        if (rest) {
          json.items.anyOf.push(rest);
        }
        json.minItems = prefixItems.length;
        if (!rest) {
          json.maxItems = prefixItems.length;
        }
      } else {
        json.items = prefixItems;
        if (rest) {
          json.additionalItems = rest;
        }
      }
      const { minimum, maximum } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minItems = minimum;
      if (typeof maximum === "number")
        json.maxItems = maximum;
    };
    const recordProcessor = (schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      json.type = "object";
      const keyType = def.keyType;
      const keyBag = keyType._zod.bag;
      const patterns = keyBag == null ? void 0 : keyBag.patterns;
      if (def.mode === "loose" && patterns && patterns.size > 0) {
        const valueSchema = process(def.valueType, ctx, {
          ...params,
          path: [...params.path, "patternProperties", "*"]
        });
        json.patternProperties = {};
        for (const pattern of patterns) {
          json.patternProperties[pattern.source] = valueSchema;
        }
      } else {
        if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
          json.propertyNames = process(def.keyType, ctx, {
            ...params,
            path: [...params.path, "propertyNames"]
          });
        }
        json.additionalProperties = process(def.valueType, ctx, {
          ...params,
          path: [...params.path, "additionalProperties"]
        });
      }
      const keyValues = keyType._zod.values;
      if (keyValues) {
        const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
        if (validKeyValues.length > 0) {
          json.required = validKeyValues;
        }
      }
    };
    const nullableProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      const inner = process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      if (ctx.target === "openapi-3.0") {
        seen.ref = def.innerType;
        json.nullable = true;
      } else {
        json.anyOf = [inner, { type: "null" }];
      }
    };
    const nonoptionalProcessor = (schema, ctx, _json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
    };
    const defaultProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      json.default = JSON.parse(JSON.stringify(def.defaultValue));
    };
    const prefaultProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      if (ctx.io === "input")
        json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
    };
    const catchProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      let catchValue;
      try {
        catchValue = def.catchValue(void 0);
      } catch {
        throw new Error("Dynamic catch values are not supported in JSON Schema");
      }
      json.default = catchValue;
    };
    const pipeProcessor = (schema, ctx, _json, params) => {
      const def = schema._zod.def;
      const inIsTransform = def.in._zod.traits.has("$ZodTransform");
      const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
      process(innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = innerType;
    };
    const readonlyProcessor = (schema, ctx, json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      json.readOnly = true;
    };
    const optionalProcessor = (schema, ctx, _json, params) => {
      const def = schema._zod.def;
      process(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
    };
    const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
      $ZodISODateTime.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    function datetime(params) {
      return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
    }
    const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
      $ZodISODate.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    function date(params) {
      return /* @__PURE__ */ _isoDate(ZodISODate, params);
    }
    const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
      $ZodISOTime.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    function time(params) {
      return /* @__PURE__ */ _isoTime(ZodISOTime, params);
    }
    const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
      $ZodISODuration.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    function duration(params) {
      return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
    }
    const initializer = (inst, issues) => {
      $ZodError.init(inst, issues);
      inst.name = "ZodError";
      Object.defineProperties(inst, {
        format: {
          value: (mapper) => formatError(inst, mapper)
          // enumerable: false,
        },
        flatten: {
          value: (mapper) => flattenError(inst, mapper)
          // enumerable: false,
        },
        addIssue: {
          value: (issue2) => {
            inst.issues.push(issue2);
            inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
          }
          // enumerable: false,
        },
        addIssues: {
          value: (issues2) => {
            inst.issues.push(...issues2);
            inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
          }
          // enumerable: false,
        },
        isEmpty: {
          get() {
            return inst.issues.length === 0;
          }
          // enumerable: false,
        }
      });
    };
    const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, {
      Parent: Error
    });
    const parse = /* @__PURE__ */ _parse(ZodRealError);
    const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
    const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
    const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
    const encode = /* @__PURE__ */ _encode(ZodRealError);
    const decode = /* @__PURE__ */ _decode(ZodRealError);
    const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
    const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
    const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
    const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
    const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
    const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
    const _installedGroups = /* @__PURE__ */ new WeakMap();
    function _installLazyMethods(inst, group, methods) {
      const proto = Object.getPrototypeOf(inst);
      let installed = _installedGroups.get(proto);
      if (!installed) {
        installed = /* @__PURE__ */ new Set();
        _installedGroups.set(proto, installed);
      }
      if (installed.has(group))
        return;
      installed.add(group);
      for (const key in methods) {
        const fn = methods[key];
        Object.defineProperty(proto, key, {
          configurable: true,
          enumerable: false,
          get() {
            const bound = fn.bind(this);
            Object.defineProperty(this, key, {
              configurable: true,
              writable: true,
              enumerable: true,
              value: bound
            });
            return bound;
          },
          set(v) {
            Object.defineProperty(this, key, {
              configurable: true,
              writable: true,
              enumerable: true,
              value: v
            });
          }
        });
      }
    }
    const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
      $ZodType.init(inst, def);
      Object.assign(inst["~standard"], {
        jsonSchema: {
          input: createStandardJSONSchemaMethod(inst, "input"),
          output: createStandardJSONSchemaMethod(inst, "output")
        }
      });
      inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
      inst.def = def;
      inst.type = def.type;
      Object.defineProperty(inst, "_def", { value: def });
      inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
      inst.safeParse = (data, params) => safeParse(inst, data, params);
      inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
      inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
      inst.spa = inst.safeParseAsync;
      inst.encode = (data, params) => encode(inst, data, params);
      inst.decode = (data, params) => decode(inst, data, params);
      inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
      inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
      inst.safeEncode = (data, params) => safeEncode(inst, data, params);
      inst.safeDecode = (data, params) => safeDecode(inst, data, params);
      inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
      inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
      _installLazyMethods(inst, "ZodType", {
        check(...chks) {
          const def2 = this.def;
          return this.clone(mergeDefs(def2, {
            checks: [
              ...def2.checks ?? [],
              ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
            ]
          }), { parent: true });
        },
        with(...chks) {
          return this.check(...chks);
        },
        clone(def2, params) {
          return clone(this, def2, params);
        },
        brand() {
          return this;
        },
        register(reg, meta) {
          reg.add(this, meta);
          return this;
        },
        refine(check, params) {
          return this.check(refine(check, params));
        },
        superRefine(refinement, params) {
          return this.check(superRefine(refinement, params));
        },
        overwrite(fn) {
          return this.check(/* @__PURE__ */ _overwrite(fn));
        },
        optional() {
          return optional(this);
        },
        exactOptional() {
          return exactOptional(this);
        },
        nullable() {
          return nullable(this);
        },
        nullish() {
          return optional(nullable(this));
        },
        nonoptional(params) {
          return nonoptional(this, params);
        },
        array() {
          return array(this);
        },
        or(arg) {
          return union([this, arg]);
        },
        and(arg) {
          return intersection(this, arg);
        },
        transform(tx) {
          return pipe(this, transform(tx));
        },
        default(d) {
          return _default(this, d);
        },
        prefault(d) {
          return prefault(this, d);
        },
        catch(params) {
          return _catch(this, params);
        },
        pipe(target) {
          return pipe(this, target);
        },
        readonly() {
          return readonly(this);
        },
        describe(description) {
          const cl = this.clone();
          globalRegistry.add(cl, { description });
          return cl;
        },
        meta(...args) {
          if (args.length === 0)
            return globalRegistry.get(this);
          const cl = this.clone();
          globalRegistry.add(cl, args[0]);
          return cl;
        },
        isOptional() {
          return this.safeParse(void 0).success;
        },
        isNullable() {
          return this.safeParse(null).success;
        },
        apply(fn) {
          return fn(this);
        }
      });
      Object.defineProperty(inst, "description", {
        get() {
          var _a2;
          return (_a2 = globalRegistry.get(inst)) == null ? void 0 : _a2.description;
        },
        configurable: true
      });
      return inst;
    });
    const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
      $ZodString.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
      const bag = inst._zod.bag;
      inst.format = bag.format ?? null;
      inst.minLength = bag.minimum ?? null;
      inst.maxLength = bag.maximum ?? null;
      _installLazyMethods(inst, "_ZodString", {
        regex(...args) {
          return this.check(/* @__PURE__ */ _regex(...args));
        },
        includes(...args) {
          return this.check(/* @__PURE__ */ _includes(...args));
        },
        startsWith(...args) {
          return this.check(/* @__PURE__ */ _startsWith(...args));
        },
        endsWith(...args) {
          return this.check(/* @__PURE__ */ _endsWith(...args));
        },
        min(...args) {
          return this.check(/* @__PURE__ */ _minLength(...args));
        },
        max(...args) {
          return this.check(/* @__PURE__ */ _maxLength(...args));
        },
        length(...args) {
          return this.check(/* @__PURE__ */ _length(...args));
        },
        nonempty(...args) {
          return this.check(/* @__PURE__ */ _minLength(1, ...args));
        },
        lowercase(params) {
          return this.check(/* @__PURE__ */ _lowercase(params));
        },
        uppercase(params) {
          return this.check(/* @__PURE__ */ _uppercase(params));
        },
        trim() {
          return this.check(/* @__PURE__ */ _trim());
        },
        normalize(...args) {
          return this.check(/* @__PURE__ */ _normalize(...args));
        },
        toLowerCase() {
          return this.check(/* @__PURE__ */ _toLowerCase());
        },
        toUpperCase() {
          return this.check(/* @__PURE__ */ _toUpperCase());
        },
        slugify() {
          return this.check(/* @__PURE__ */ _slugify());
        }
      });
    });
    const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
      $ZodString.init(inst, def);
      _ZodString.init(inst, def);
      inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
      inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
      inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
      inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
      inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
      inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
      inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
      inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
      inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
      inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
      inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
      inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
      inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
      inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
      inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
      inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
      inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
      inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
      inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
      inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
      inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
      inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
      inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
      inst.datetime = (params) => inst.check(datetime(params));
      inst.date = (params) => inst.check(date(params));
      inst.time = (params) => inst.check(time(params));
      inst.duration = (params) => inst.check(duration(params));
    });
    function string(params) {
      return /* @__PURE__ */ _string(ZodString, params);
    }
    const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
      $ZodStringFormat.init(inst, def);
      _ZodString.init(inst, def);
    });
    const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
      $ZodEmail.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
      $ZodGUID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
      $ZodUUID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
      $ZodURL.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
      $ZodEmoji.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
      $ZodNanoID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
      $ZodCUID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
      $ZodCUID2.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
      $ZodULID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
      $ZodXID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
      $ZodKSUID.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
      $ZodIPv4.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
      $ZodIPv6.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
      $ZodCIDRv4.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
      $ZodCIDRv6.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
      $ZodBase64.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
      $ZodBase64URL.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
      $ZodE164.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
      $ZodJWT.init(inst, def);
      ZodStringFormat.init(inst, def);
    });
    const ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
      $ZodNumber.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
      _installLazyMethods(inst, "ZodNumber", {
        gt(value, params) {
          return this.check(/* @__PURE__ */ _gt(value, params));
        },
        gte(value, params) {
          return this.check(/* @__PURE__ */ _gte(value, params));
        },
        min(value, params) {
          return this.check(/* @__PURE__ */ _gte(value, params));
        },
        lt(value, params) {
          return this.check(/* @__PURE__ */ _lt(value, params));
        },
        lte(value, params) {
          return this.check(/* @__PURE__ */ _lte(value, params));
        },
        max(value, params) {
          return this.check(/* @__PURE__ */ _lte(value, params));
        },
        int(params) {
          return this.check(int(params));
        },
        safe(params) {
          return this.check(int(params));
        },
        positive(params) {
          return this.check(/* @__PURE__ */ _gt(0, params));
        },
        nonnegative(params) {
          return this.check(/* @__PURE__ */ _gte(0, params));
        },
        negative(params) {
          return this.check(/* @__PURE__ */ _lt(0, params));
        },
        nonpositive(params) {
          return this.check(/* @__PURE__ */ _lte(0, params));
        },
        multipleOf(value, params) {
          return this.check(/* @__PURE__ */ _multipleOf(value, params));
        },
        step(value, params) {
          return this.check(/* @__PURE__ */ _multipleOf(value, params));
        },
        finite() {
          return this;
        }
      });
      const bag = inst._zod.bag;
      inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
      inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
      inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
      inst.isFinite = true;
      inst.format = bag.format ?? null;
    });
    function number(params) {
      return /* @__PURE__ */ _number(ZodNumber, params);
    }
    const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
      $ZodNumberFormat.init(inst, def);
      ZodNumber.init(inst, def);
    });
    function int(params) {
      return /* @__PURE__ */ _int(ZodNumberFormat, params);
    }
    const ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
      $ZodBoolean.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
    });
    function boolean(params) {
      return /* @__PURE__ */ _boolean(ZodBoolean, params);
    }
    const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
      $ZodUnknown.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
    });
    function unknown() {
      return /* @__PURE__ */ _unknown(ZodUnknown);
    }
    const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
      $ZodNever.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
    });
    function never(params) {
      return /* @__PURE__ */ _never(ZodNever, params);
    }
    const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
      $ZodArray.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
      inst.element = def.element;
      _installLazyMethods(inst, "ZodArray", {
        min(n, params) {
          return this.check(/* @__PURE__ */ _minLength(n, params));
        },
        nonempty(params) {
          return this.check(/* @__PURE__ */ _minLength(1, params));
        },
        max(n, params) {
          return this.check(/* @__PURE__ */ _maxLength(n, params));
        },
        length(n, params) {
          return this.check(/* @__PURE__ */ _length(n, params));
        },
        unwrap() {
          return this.element;
        }
      });
    });
    function array(element, params) {
      return /* @__PURE__ */ _array(ZodArray, element, params);
    }
    const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
      $ZodObjectJIT.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
      defineLazy(inst, "shape", () => {
        return def.shape;
      });
      _installLazyMethods(inst, "ZodObject", {
        keyof() {
          return _enum(Object.keys(this._zod.def.shape));
        },
        catchall(catchall) {
          return this.clone({ ...this._zod.def, catchall });
        },
        passthrough() {
          return this.clone({ ...this._zod.def, catchall: unknown() });
        },
        loose() {
          return this.clone({ ...this._zod.def, catchall: unknown() });
        },
        strict() {
          return this.clone({ ...this._zod.def, catchall: never() });
        },
        strip() {
          return this.clone({ ...this._zod.def, catchall: void 0 });
        },
        extend(incoming) {
          return extend(this, incoming);
        },
        safeExtend(incoming) {
          return safeExtend(this, incoming);
        },
        merge(other) {
          return merge(this, other);
        },
        pick(mask) {
          return pick(this, mask);
        },
        omit(mask) {
          return omit(this, mask);
        },
        partial(...args) {
          return partial(ZodOptional, this, args[0]);
        },
        required(...args) {
          return required(ZodNonOptional, this, args[0]);
        }
      });
    });
    function object(shape, params) {
      const def = {
        type: "object",
        shape: shape ?? {},
        ...normalizeParams(params)
      };
      return new ZodObject(def);
    }
    const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
      $ZodUnion.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
      inst.options = def.options;
    });
    function union(options, params) {
      return new ZodUnion({
        type: "union",
        options,
        ...normalizeParams(params)
      });
    }
    const ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
      ZodUnion.init(inst, def);
      $ZodDiscriminatedUnion.init(inst, def);
    });
    function discriminatedUnion(discriminator, options, params) {
      return new ZodDiscriminatedUnion({
        type: "union",
        options,
        discriminator,
        ...normalizeParams(params)
      });
    }
    const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
      $ZodIntersection.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
    });
    function intersection(left, right) {
      return new ZodIntersection({
        type: "intersection",
        left,
        right
      });
    }
    const ZodTuple = /* @__PURE__ */ $constructor("ZodTuple", (inst, def) => {
      $ZodTuple.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
      inst.rest = (rest) => inst.clone({
        ...inst._zod.def,
        rest
      });
    });
    function tuple(items, _paramsOrRest, _params) {
      const hasRest = _paramsOrRest instanceof $ZodType;
      const params = hasRest ? _params : _paramsOrRest;
      const rest = hasRest ? _paramsOrRest : null;
      return new ZodTuple({
        type: "tuple",
        items,
        rest,
        ...normalizeParams(params)
      });
    }
    const ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
      $ZodRecord.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
      inst.keyType = def.keyType;
      inst.valueType = def.valueType;
    });
    function record(keyType, valueType, params) {
      if (!valueType || !valueType._zod) {
        return new ZodRecord({
          type: "record",
          keyType: string(),
          valueType: keyType,
          ...normalizeParams(valueType)
        });
      }
      return new ZodRecord({
        type: "record",
        keyType,
        valueType,
        ...normalizeParams(params)
      });
    }
    const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
      $ZodEnum.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
      inst.enum = def.entries;
      inst.options = Object.values(def.entries);
      const keys = new Set(Object.keys(def.entries));
      inst.extract = (values, params) => {
        const newEntries = {};
        for (const value of values) {
          if (keys.has(value)) {
            newEntries[value] = def.entries[value];
          } else
            throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
          ...def,
          checks: [],
          ...normalizeParams(params),
          entries: newEntries
        });
      };
      inst.exclude = (values, params) => {
        const newEntries = { ...def.entries };
        for (const value of values) {
          if (keys.has(value)) {
            delete newEntries[value];
          } else
            throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
          ...def,
          checks: [],
          ...normalizeParams(params),
          entries: newEntries
        });
      };
    });
    function _enum(values, params) {
      const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
      return new ZodEnum({
        type: "enum",
        entries,
        ...normalizeParams(params)
      });
    }
    const ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
      $ZodLiteral.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json);
      inst.values = new Set(def.values);
      Object.defineProperty(inst, "value", {
        get() {
          if (def.values.length > 1) {
            throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
          }
          return def.values[0];
        }
      });
    });
    function literal(value, params) {
      return new ZodLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...normalizeParams(params)
      });
    }
    const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
      $ZodTransform.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
      inst._zod.parse = (payload, _ctx) => {
        if (_ctx.direction === "backward") {
          throw new $ZodEncodeError(inst.constructor.name);
        }
        payload.addIssue = (issue$1) => {
          if (typeof issue$1 === "string") {
            payload.issues.push(issue(issue$1, payload.value, def));
          } else {
            const _issue = issue$1;
            if (_issue.fatal)
              _issue.continue = false;
            _issue.code ?? (_issue.code = "custom");
            _issue.input ?? (_issue.input = payload.value);
            _issue.inst ?? (_issue.inst = inst);
            payload.issues.push(issue(_issue));
          }
        };
        const output = def.transform(payload.value, payload);
        if (output instanceof Promise) {
          return output.then((output2) => {
            payload.value = output2;
            payload.fallback = true;
            return payload;
          });
        }
        payload.value = output;
        payload.fallback = true;
        return payload;
      };
    });
    function transform(fn) {
      return new ZodTransform({
        type: "transform",
        transform: fn
      });
    }
    const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
      $ZodOptional.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function optional(innerType) {
      return new ZodOptional({
        type: "optional",
        innerType
      });
    }
    const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
      $ZodExactOptional.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function exactOptional(innerType) {
      return new ZodExactOptional({
        type: "optional",
        innerType
      });
    }
    const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
      $ZodNullable.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function nullable(innerType) {
      return new ZodNullable({
        type: "nullable",
        innerType
      });
    }
    const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
      $ZodDefault.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
      inst.removeDefault = inst.unwrap;
    });
    function _default(innerType, defaultValue) {
      return new ZodDefault({
        type: "default",
        innerType,
        get defaultValue() {
          return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        }
      });
    }
    const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
      $ZodPrefault.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function prefault(innerType, defaultValue) {
      return new ZodPrefault({
        type: "prefault",
        innerType,
        get defaultValue() {
          return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        }
      });
    }
    const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
      $ZodNonOptional.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function nonoptional(innerType, params) {
      return new ZodNonOptional({
        type: "nonoptional",
        innerType,
        ...normalizeParams(params)
      });
    }
    const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
      $ZodCatch.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
      inst.removeCatch = inst.unwrap;
    });
    function _catch(innerType, catchValue) {
      return new ZodCatch({
        type: "catch",
        innerType,
        catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
      });
    }
    const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
      $ZodPipe.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
      inst.in = def.in;
      inst.out = def.out;
    });
    function pipe(in_, out) {
      return new ZodPipe({
        type: "pipe",
        in: in_,
        out
        // ...util.normalizeParams(params),
      });
    }
    const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
      $ZodReadonly.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function readonly(innerType) {
      return new ZodReadonly({
        type: "readonly",
        innerType
      });
    }
    const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
      $ZodCustom.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
    });
    function refine(fn, _params = {}) {
      return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
    }
    function superRefine(fn, params) {
      return /* @__PURE__ */ _superRefine(fn, params);
    }
    function _instanceof(cls, params = {}) {
      const inst = new ZodCustom({
        type: "custom",
        check: "custom",
        fn: (data) => data instanceof cls,
        abort: true,
        ...normalizeParams(params)
      });
      inst._zod.bag.Class = cls;
      inst._zod.check = (payload) => {
        if (!(payload.value instanceof cls)) {
          payload.issues.push({
            code: "invalid_type",
            expected: cls.name,
            input: payload.value,
            inst,
            path: [...inst._zod.def.path ?? []]
          });
        }
      };
      return inst;
    }
    const protocolIdSchema = string().trim().min(1).max(256);
    const contentDigestSchema = string().trim().min(1).max(512);
    const idSchema$3 = protocolIdSchema;
    const digestSchema$1 = contentDigestSchema;
    const drawingRefSchema = object({
      drawingId: idSchema$3,
      revision: number().int().nonnegative()
    }).strict();
    const editBasisSchema = discriminatedUnion("kind", [
      object({
        kind: literal("canonical"),
        ref: drawingRefSchema
      }).strict(),
      object({
        kind: literal("preview"),
        baseRef: drawingRefSchema,
        previewHandle: idSchema$3,
        previewDigest: digestSchema$1
      }).strict(),
      object({
        kind: literal("carried-candidate"),
        handoffId: idSchema$3,
        taskId: idSchema$3,
        originTaskId: idSchema$3,
        baseRef: drawingRefSchema,
        candidateDigest: digestSchema$1
      }).strict()
    ]);
    const observationArtifactRefSchema = object({
      id: idSchema$3,
      contentDigest: digestSchema$1,
      mimeType: _enum(["image/png", "image/webp"]),
      basis: editBasisSchema
    }).strict();
    object({
      taskId: idSchema$3,
      rootUserMessageDigest: digestSchema$1,
      authoritativeObjectiveDigest: digestSchema$1,
      baseRef: drawingRefSchema,
      policy: _enum(["review", "auto-safe"]),
      stateEpoch: number().int().nonnegative()
    }).strict();
    object({
      observationId: idSchema$3,
      taskId: idSchema$3,
      basis: editBasisSchema,
      artifactRefs: array(observationArtifactRefSchema).max(16),
      selectionProjectionId: idSchema$3.optional(),
      observationDigest: digestSchema$1
    }).strict();
    object({
      contextId: idSchema$3,
      taskId: idSchema$3,
      observationId: idSchema$3,
      contextDigest: digestSchema$1
    }).strict();
    object({
      groundingId: idSchema$3,
      taskId: idSchema$3,
      contextId: idSchema$3,
      targetHandle: idSchema$3,
      targetNodeIds: array(idSchema$3).min(1).max(256),
      interfaces: array(object({
        interfaceId: idSchema$3,
        nodeId: idSchema$3,
        endpoint: _enum(["start", "end"])
      }).strict()).max(256),
      targetScopeDigest: digestSchema$1,
      protectedScopeDigest: digestSchema$1,
      evidenceDigest: digestSchema$1
    }).strict();
    object({
      previewHandle: idSchema$3,
      taskId: idSchema$3,
      groundingId: idSchema$3,
      groundingIds: array(idSchema$3).min(2).max(16).optional(),
      baseRef: drawingRefSchema,
      candidateDigest: digestSchema$1,
      effectDigest: digestSchema$1,
      finalizeOperationId: idSchema$3,
      finalizeOperationBindingDigest: digestSchema$1
    }).strict().superRefine(({ groundingId, groundingIds }, context) => {
      if (groundingIds === void 0) return;
      if (groundingIds[0] !== groundingId || new Set(groundingIds).size !== groundingIds.length) {
        context.addIssue({ code: "custom", path: ["groundingIds"], message: "EDIT_GROUNDING_SET_INVALID" });
      }
    });
    object({
      evaluationId: idSchema$3,
      taskId: idSchema$3,
      previewHandle: idSchema$3,
      candidateDigest: digestSchema$1,
      evaluationDigest: digestSchema$1
    }).strict();
    const selectionProjectionRefSchema = object({
      selectionProjectionId: idSchema$3,
      drawingRef: drawingRefSchema,
      nodeIds: array(idSchema$3).min(1).max(256),
      projectionDigest: digestSchema$1,
      expiresAt: number().int().nonnegative()
    }).strict();
    const boundedTextSchema$1 = string().trim().min(1).max(2e3);
    const boundsSchema$1 = object({
      minX: number().finite(),
      minY: number().finite(),
      maxX: number().finite(),
      maxY: number().finite()
    }).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY);
    const diagnosticSchema = object({
      code: protocolIdSchema,
      severity: _enum(["info", "candidate", "warning", "decision_required", "error"]),
      message: boundedTextSchema$1,
      nodeIds: array(protocolIdSchema).max(256).optional(),
      action: boundedTextSchema$1.optional(),
      facts: record(string(), unknown()).optional(),
      scopeDigest: contentDigestSchema.optional(),
      hard: boolean().optional()
    }).strict();
    const authoritativeObjectiveSchema = object({
      text: string().trim().min(1).max(8e3),
      attachmentContentDigests: array(contentDigestSchema).max(16)
    }).strict();
    const resolvedDefectSchema = object({
      defectId: protocolIdSchema,
      scopeDigest: contentDigestSchema,
      evidenceDigests: array(contentDigestSchema).min(1).max(32)
    }).strict();
    const reviewEvidenceSchema = object({
      kind: literal("reviewer"),
      provider: protocolIdSchema,
      providerVersion: protocolIdSchema,
      authoritativeObjective: authoritativeObjectiveSchema,
      renderManifest: object({
        rendererVersion: protocolIdSchema,
        beforeContentDigest: contentDigestSchema,
        afterContentDigest: contentDigestSchema,
        artifactContentDigest: contentDigestSchema,
        comparisonLayout: literal("before | after"),
        worldToImage: tuple([
          number().finite(),
          number().finite(),
          number().finite(),
          number().finite(),
          number().finite(),
          number().finite()
        ]),
        viewport: boundsSchema$1,
        width: number().int().positive().max(8192),
        height: number().int().positive().max(8192),
        overlays: array(protocolIdSchema).max(32)
      }).strict(),
      outcome: _enum(["satisfied", "needs_revision", "unavailable"]),
      defects: array(object({
        defectId: protocolIdSchema,
        code: protocolIdSchema,
        reason: boundedTextSchema$1,
        scopeDigest: contentDigestSchema
      }).strict()).max(64),
      resolvedDefects: array(resolvedDefectSchema).max(64)
    }).strict();
    const assessmentBase = {
      assessmentId: protocolIdSchema,
      taskId: protocolIdSchema,
      drawingId: protocolIdSchema,
      baseRef: drawingRefSchema,
      previewHandle: protocolIdSchema,
      candidateDigest: contentDigestSchema,
      evaluationDigest: contentDigestSchema,
      policyVersion: protocolIdSchema,
      evaluatorVersions: array(protocolIdSchema).min(1).max(64),
      effectDigest: contentDigestSchema,
      reasons: array(protocolIdSchema).max(64)
    };
    const assessmentSchema = discriminatedUnion("disposition", [
      object({
        ...assessmentBase,
        disposition: literal("blocked"),
        hardDeny: boolean(),
        nonOverridableProtected: boolean()
      }).strict(),
      object({
        ...assessmentBase,
        disposition: literal("confirmation_required"),
        requiredEffectDigest: contentDigestSchema
      }).strict(),
      object({
        ...assessmentBase,
        disposition: literal("auto_safe"),
        autoQualification: object({
          exactScope: literal(true),
          cleanDiagnostics: literal(true),
          sourceConfirmed: literal(true),
          reviewerSatisfied: literal(true),
          inverseVerified: literal(true)
        }).strict()
      }).strict()
    ]);
    object({
      evaluationId: protocolIdSchema,
      taskId: protocolIdSchema,
      previewHandle: protocolIdSchema,
      candidateDigest: contentDigestSchema,
      diagnostics: array(diagnosticSchema).max(256),
      mandatoryEvaluatorVersions: array(protocolIdSchema).min(1).max(64),
      review: reviewEvidenceSchema,
      evaluationDigest: contentDigestSchema
    }).strict();
    const idSchema$2 = string().trim().min(1).max(256);
    const digestSchema = string().trim().min(1).max(512);
    object({
      previewHandle: idSchema$2,
      previewDigest: digestSchema,
      finalizeOperationId: idSchema$2,
      finalizeOperationBindingDigest: digestSchema,
      evaluationId: idSchema$2
    }).strict();
    const finalizePreviewResultSchema = discriminatedUnion("status", [
      object({
        status: literal("committed"),
        mode: _enum(["auto-safe", "confirmed"]),
        commitId: idSchema$2,
        ref: drawingRefSchema,
        operationId: idSchema$2,
        operationBindingDigest: digestSchema
      }).strict(),
      object({
        status: literal("already-satisfied"),
        ref: drawingRefSchema,
        operationId: idSchema$2,
        operationBindingDigest: digestSchema
      }).strict(),
      object({
        status: literal("root-required"),
        message: string().trim().min(1).max(2e3)
      }).strict(),
      object({
        status: literal("needs-revision"),
        evaluationId: idSchema$2,
        reasons: array(string().trim().min(1).max(1e3)).min(1).max(64)
      }).strict(),
      object({
        status: literal("discarded"),
        ref: drawingRefSchema
      }).strict(),
      object({
        status: literal("rejected"),
        disposition: _enum(["blocked", "confirmation_required"]),
        code: idSchema$2,
        message: string().trim().min(1).max(2e3)
      }).strict(),
      object({
        status: literal("outcome-unknown"),
        operationId: idSchema$2,
        operationBindingDigest: digestSchema
      }).strict()
    ]);
    const idSchema$1 = string().trim().min(1).max(256);
    const boundedTextSchema = string().trim().min(1).max(2e3);
    const finiteSchema = number().finite();
    const vec2Schema$1 = tuple([finiteSchema, finiteSchema]);
    const boundsSchema = object({
      minX: finiteSchema,
      minY: finiteSchema,
      maxX: finiteSchema,
      maxY: finiteSchema
    }).strict().refine(
      ({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY,
      { message: "INVALID_BOUNDS" }
    );
    const effectScopeRefSchema = discriminatedUnion("kind", [
      object({
        kind: literal("node-field"),
        nodeId: idSchema$1,
        fields: array(idSchema$1).min(1).max(64)
      }).strict(),
      object({
        kind: literal("source-span"),
        nodeId: idSchema$1,
        start: number().int().nonnegative(),
        end: number().int().positive()
      }).strict().refine(({ start, end }) => start < end, { message: "INVALID_SOURCE_SPAN" }),
      object({
        kind: literal("half-edge"),
        nodeId: idSchema$1,
        halfEdgeId: idSchema$1
      }).strict(),
      object({
        kind: literal("interface"),
        interfaceId: idSchema$1
      }).strict(),
      object({
        kind: literal("endpoint-slot"),
        nodeId: idSchema$1,
        endpoint: _enum(["start", "end"])
      }).strict(),
      object({
        kind: literal("creation"),
        plane: _enum(["geometry", "annotation", "relation", "feature"]),
        nodeType: idSchema$1,
        containerId: idSchema$1.optional(),
        maxCount: number().int().min(1).max(256)
      }).strict(),
      object({
        kind: literal("deletion"),
        nodeIds: array(idSchema$1).min(1).max(256)
      }).strict()
    ]);
    const spatialOperationSchema = discriminatedUnion("kind", [
      object({
        kind: literal("rigid_transform"),
        translation: vec2Schema$1,
        rotationRadians: finiteSchema,
        pivot: vec2Schema$1
      }).strict(),
      object({
        kind: literal("connected_transform"),
        translation: vec2Schema$1,
        rotationRadians: finiteSchema.optional(),
        pivot: vec2Schema$1.optional(),
        interfaceIds: array(idSchema$1).min(1).max(256)
      }).strict(),
      object({
        kind: literal("set_endpoint"),
        nodeId: idSchema$1,
        endpoint: _enum(["start", "end"]),
        point: vec2Schema$1
      }).strict(),
      object({
        kind: literal("create_path"),
        nodeId: idSchema$1,
        points: array(vec2Schema$1).min(2).max(4096),
        closed: boolean()
      }).strict(),
      object({
        kind: literal("delete_nodes"),
        nodeIds: array(idSchema$1).min(1).max(256)
      }).strict(),
      object({
        kind: literal("create_annotation_batch"),
        annotations: array(object({ id: idSchema$1, type: idSchema$1 }).catchall(unknown())).min(1).max(512),
        associations: array(object({ id: idSchema$1, type: literal("association") }).catchall(unknown())).max(512)
      }).strict()
    ]);
    const spatialPostconditionSchema = discriminatedUnion("kind", [
      object({
        kind: literal("preserve_connectivity"),
        nodeIds: array(idSchema$1).min(1).max(256)
      }).strict(),
      object({
        kind: literal("within_bounds"),
        bounds: boundsSchema
      }).strict(),
      object({
        kind: literal("target_position"),
        targetHandle: idSchema$1,
        point: vec2Schema$1,
        tolerance: finiteSchema.positive()
      }).strict()
    ]);
    const spatialEditProgramSchema = object({
      baseRef: drawingRefSchema,
      targetHandle: idSchema$1,
      summary: boundedTextSchema,
      objective: boundedTextSchema,
      operations: array(spatialOperationSchema).min(1).max(128),
      preserveScopes: array(effectScopeRefSchema).max(512),
      postconditions: array(spatialPostconditionSchema).max(128),
      evidenceRefs: array(idSchema$1).min(1).max(256)
    }).strict();
    const idSchema = string().min(1);
    const vec2Schema = tuple([number(), number()]);
    const qualitySchema = object({
      status: _enum(["confirmed", "candidate"]),
      confidence: number().optional(),
      evidenceRefs: array(idSchema)
    }).strict();
    const drawingNodeSourceRefSchema = object({
      sourceId: idSchema,
      objectId: idSchema.optional(),
      objectType: idSchema.optional(),
      layer: string().min(1).optional()
    }).strict();
    const baseNodeShape = {
      id: idSchema,
      visible: boolean(),
      quality: qualitySchema,
      sourceRef: drawingNodeSourceRefSchema.optional()
    };
    const geometrySchema = discriminatedUnion("type", [
      object({ ...baseNodeShape, type: literal("point"), x: number(), y: number() }).strict(),
      object({ ...baseNodeShape, type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
      object({ ...baseNodeShape, type: literal("ray"), origin: vec2Schema, direction: vec2Schema }).strict(),
      object({ ...baseNodeShape, type: literal("xline"), origin: vec2Schema, direction: vec2Schema }).strict(),
      object({ ...baseNodeShape, type: literal("circle"), center: vec2Schema, radius: number() }).strict(),
      object({
        ...baseNodeShape,
        type: literal("arc"),
        center: vec2Schema,
        radius: number(),
        startAngle: number(),
        endAngle: number(),
        counterClockwise: boolean()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("ellipse"),
        center: vec2Schema,
        majorAxis: vec2Schema,
        ratio: number(),
        startParam: number().optional(),
        endParam: number().optional()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("polyline"),
        vertices: array(object({ point: vec2Schema, bulge: number().optional() }).strict()),
        closed: boolean()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("spline"),
        degree: number().int().nonnegative(),
        controlPoints: array(vec2Schema),
        knots: array(number()),
        weights: array(number()).optional(),
        closed: boolean(),
        periodic: boolean()
      }).strict()
    ]);
    const entityAnchorSchema = discriminatedUnion("kind", [
      object({ kind: _enum(["start", "end", "center"]) }).strict(),
      object({ kind: literal("vertex"), index: number().int().nonnegative() }).strict(),
      object({ kind: literal("curve-parameter"), parameter: number() }).strict(),
      object({ kind: literal("nearest"), point: vec2Schema }).strict()
    ]);
    const dimensionTargetSchema = object({
      geometryId: idSchema,
      anchor: entityAnchorSchema
    }).strict();
    const dimensionCandidateSchema = object({
      targets: array(dimensionTargetSchema),
      score: number(),
      reasons: array(string())
    }).strict();
    const annotationSchema = discriminatedUnion("type", [
      object({
        ...baseNodeShape,
        type: literal("text"),
        content: string(),
        position: vec2Schema,
        height: number(),
        rotation: number(),
        alignment: _enum(["left", "center", "right"]),
        verticalAlignment: _enum(["baseline", "bottom", "middle", "top"]),
        maxWidth: number().optional()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("dimension"),
        dimensionKind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
        associationStatus: _enum(["resolved", "ambiguous", "conflict"]),
        targets: array(dimensionTargetSchema),
        candidates: array(dimensionCandidateSchema).optional(),
        observedValue: number().optional(),
        computedValue: number().optional(),
        displayText: string().optional(),
        unit: _enum(["mm", "cm", "m", "deg"]).optional(),
        tolerance: object({ upper: number().optional(), lower: number().optional() }).strict().optional(),
        prefix: string().optional(),
        suffix: string().optional(),
        textPosition: vec2Schema,
        definitionPoints: array(vec2Schema)
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("leader"),
        target: dimensionTargetSchema,
        points: array(vec2Schema),
        content: string(),
        textHeight: number()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("centerline"),
        targets: array(idSchema),
        start: vec2Schema,
        end: vec2Schema,
        extension: number()
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("section-hatch"),
        pattern: string(),
        angle: number(),
        spacing: number(),
        segments: array(object({ start: vec2Schema, end: vec2Schema }).strict())
      }).strict()
    ]);
    const relationSchema = discriminatedUnion("plane", [
      object({
        ...baseNodeShape,
        type: literal("topology"),
        plane: literal("topology"),
        kind: _enum(["connected", "closed", "contains", "intersects"]),
        nodeIds: array(idSchema)
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("constraint"),
        plane: literal("constraint"),
        kind: _enum(["horizontal", "vertical", "parallel", "perpendicular", "tangent", "concentric", "equal", "distance", "radius", "angle", "symmetry"]),
        geometryIds: array(idSchema),
        value: number().optional(),
        property: string().optional(),
        status: _enum(["defined", "satisfied", "violated", "unsolved"])
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("association"),
        plane: literal("association"),
        kind: literal("annotation-target"),
        annotationId: idSchema,
        geometryIds: array(idSchema)
      }).strict(),
      object({
        ...baseNodeShape,
        type: literal("semantic"),
        plane: literal("semantic"),
        kind: literal("feature-member"),
        featureId: idSchema,
        nodeIds: array(idSchema)
      }).strict()
    ]);
    const featureSchema = object({
      ...baseNodeShape,
      type: literal("feature"),
      semanticType: string(),
      geometryIds: array(idSchema),
      annotationIds: array(idSchema),
      relationIds: array(idSchema),
      properties: record(string(), unknown())
    }).strict();
    const drawingDocumentSchema = object({
      protocol: literal("VectorAI-Drawing"),
      schemaVersion: literal("1.0"),
      id: idSchema,
      metadata: object({ createdAt: number(), updatedAt: number() }).strict(),
      unitSystem: object({ length: _enum(["mm", "cm", "m"]), angle: literal("deg") }).strict(),
      sources: array(object({
        id: idSchema,
        kind: _enum(["image", "dxf"]),
        mediaType: string().min(1),
        digest: idSchema,
        name: string().min(1).optional(),
        bytes: number().int().nonnegative().optional()
      }).strict()).optional(),
      coordinateFrames: array(object({
        id: idSchema,
        kind: _enum(["document", "source", "page", "view", "provisional"]),
        transform: tuple([number(), number(), number(), number(), number(), number()]),
        parentId: idSchema.optional()
      }).strict()),
      geometry: array(geometrySchema),
      annotations: array(annotationSchema),
      relations: array(relationSchema),
      features: array(featureSchema)
    }).strict();
    const bounds2DSchema = object({
      minX: number(),
      minY: number(),
      maxX: number(),
      maxY: number()
    }).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY, { message: "INVALID_QUERY_BOUNDS" });
    const drawingPlaneSchema = _enum(["geometry", "annotation", "relation", "feature"]);
    const drawingSpatialNodeSchema = discriminatedUnion("plane", [
      object({ plane: literal("geometry"), node: geometrySchema }).strict(),
      object({ plane: literal("annotation"), node: annotationSchema }).strict(),
      object({ plane: literal("relation"), node: relationSchema }).strict(),
      object({ plane: literal("feature"), node: featureSchema }).strict()
    ]);
    discriminatedUnion("kind", [
      object({
        kind: literal("world-slice"),
        ref: drawingRefSchema,
        bounds: bounds2DSchema,
        planes: array(drawingPlaneSchema).min(1).optional(),
        limit: number().int().min(1).max(200).optional()
      }).strict(),
      object({
        kind: literal("node"),
        ref: drawingRefSchema,
        id: idSchema
      }).strict(),
      object({
        kind: literal("neighbors"),
        ref: drawingRefSchema,
        nodeId: idSchema,
        limit: number().int().min(1).max(200).optional()
      }).strict()
    ]);
    discriminatedUnion("kind", [
      object({
        kind: literal("world-slice"),
        ref: drawingRefSchema,
        bounds: bounds2DSchema,
        nodes: array(drawingSpatialNodeSchema),
        totalByPlane: object({
          geometry: number().int().nonnegative(),
          annotation: number().int().nonnegative(),
          relation: number().int().nonnegative(),
          feature: number().int().nonnegative()
        }).strict(),
        truncated: boolean()
      }).strict(),
      object({
        kind: literal("node"),
        ref: drawingRefSchema,
        node: drawingSpatialNodeSchema.nullable()
      }).strict(),
      object({
        kind: literal("neighbors"),
        ref: drawingRefSchema,
        nodeId: idSchema,
        nodes: array(drawingSpatialNodeSchema),
        truncated: boolean()
      }).strict()
    ]);
    const drawingSourceRefSchema = union([
      object({
        id: idSchema,
        mediaType: _enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
        bytes: number().int().nonnegative().optional(),
        width: number().positive(),
        height: number().positive(),
        name: string().optional()
      }).strict(),
      object({
        id: idSchema,
        mediaType: literal("application/dxf"),
        bytes: number().int().nonnegative().optional(),
        name: string().optional()
      }).strict()
    ]);
    const drawingWorkspaceSnapshotSchema = object({
      version: literal(1),
      ref: object({ drawingId: idSchema, revision: number().int().nonnegative() }).strict(),
      document: drawingDocumentSchema,
      source: drawingSourceRefSchema.optional(),
      capabilities: object({
        edit: boolean(),
        delete: boolean(),
        annotations: boolean(),
        sourceUnderlay: boolean()
      }).strict(),
      provisional: boolean().optional(),
      lastCommit: object({
        commitId: idSchema,
        mode: _enum(["auto-safe", "confirmed", "interactive", "undo", "redo"]),
        undoable: boolean(),
        redoable: boolean().optional()
      }).strict().optional()
    }).strict().nullable();
    const nodeCreateCommandSchema = object({
      type: literal("node.create"),
      plane: _enum(["geometry", "annotation", "relation", "feature"]),
      node: union([geometrySchema, annotationSchema, relationSchema, featureSchema])
    }).strict().superRefine(({ plane, node }, context) => {
      const matches = plane === "geometry" ? geometrySchema.safeParse(node).success : plane === "annotation" ? annotationSchema.safeParse(node).success : plane === "relation" ? relationSchema.safeParse(node).success : featureSchema.safeParse(node).success;
      if (!matches) context.addIssue({ code: "custom", message: "NODE_PLANE_MISMATCH" });
    });
    const workspaceCommandSchema = union([
      nodeCreateCommandSchema,
      object({
        type: literal("node.update"),
        id: idSchema,
        changes: record(string(), unknown()),
        expected: record(string(), unknown())
      }).strict(),
      object({ type: literal("node.delete"), id: idSchema }).strict(),
      object({
        type: literal("annotation.move-text"),
        id: idSchema,
        position: vec2Schema,
        expectedPosition: vec2Schema
      }).strict()
    ]);
    object({
      expectedRevision: number().int().nonnegative(),
      commands: array(workspaceCommandSchema).min(1)
    }).strict();
    discriminatedUnion("status", [
      object({ status: literal("committed"), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
      object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
      object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
    ]);
    discriminatedUnion("status", [
      object({
        status: literal("staged"),
        intentId: idSchema,
        intentDigest: idSchema,
        operationId: idSchema,
        operationBindingDigest: idSchema,
        commandLine: string().startsWith("/drawing-apply-intent ")
      }).strict(),
      object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
      object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
    ]);
    object({
      targetCommitId: idSchema,
      expectedCurrentRef: drawingRefSchema
    }).strict();
    discriminatedUnion("status", [
      object({
        status: literal("staged"),
        targetCommitId: idSchema,
        expectedCurrentRef: drawingRefSchema,
        operationId: idSchema,
        operationBindingDigest: idSchema,
        commandLine: string().startsWith("/drawing-undo ")
      }).strict(),
      object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
    ]);
    discriminatedUnion("status", [
      object({
        status: literal("staged"),
        targetCommitId: idSchema,
        expectedCurrentRef: drawingRefSchema,
        operationId: idSchema,
        operationBindingDigest: idSchema,
        commandLine: string().startsWith("/drawing-redo ")
      }).strict(),
      object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
    ]);
    object({
      expectedRef: drawingRefSchema,
      nodeIds: array(idSchema).max(256)
    }).strict();
    discriminatedUnion("status", [
      object({ status: literal("projected"), projection: selectionProjectionRefSchema }).strict(),
      object({ status: literal("cleared") }).strict(),
      object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
    ]);
    const drawingMotionRigConnectorSchema = object({
      nodeId: idSchema,
      movingEndpoint: _enum(["start", "end", "first", "last"]),
      fixedPoint: vec2Schema
    }).strict();
    const drawingMotionRigProjectionSchema = object({
      version: literal(1),
      drawingRef: drawingRefSchema,
      state: _enum(["ready", "needs-correction"]),
      message: string().min(1).optional(),
      carrierNodeId: idSchema.optional(),
      controlBodyNodeIds: array(idSchema).min(1).max(256),
      connectors: array(drawingMotionRigConnectorSchema).min(1).max(256),
      anchor: vec2Schema,
      handle: vec2Schema,
      keepAnchorFixed: literal(true),
      keepControlBodyRigid: literal(true),
      preserveConnectivity: literal(true),
      allowControlRotation: literal(false)
    }).strict();
    object({
      ref: drawingRefSchema,
      nodeIds: array(idSchema).min(1).max(256)
    }).strict();
    discriminatedUnion("status", [
      object({ status: literal("ready"), projection: drawingMotionRigProjectionSchema }).strict(),
      object({
        status: literal("needs-correction"),
        projection: drawingMotionRigProjectionSchema.optional(),
        message: string().min(1)
      }).strict(),
      object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
    ]);
    object({ ref: drawingRefSchema }).strict();
    discriminatedUnion("status", [
      object({ status: literal("discarded") }).strict(),
      object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
    ]);
    const drawingGroundingOverlayInterfaceSchema = object({
      interfaceId: idSchema,
      nodeId: idSchema,
      endpoint: _enum(["start", "end"])
    }).strict();
    const drawingGroundingOverlayGroupSchema = object({
      groundingId: idSchema,
      partKey: string().trim().min(1).max(64),
      label: string().trim().min(1).max(80),
      role: _enum(["target", "reference"]).optional(),
      colorIndex: number().int().nonnegative(),
      nodeIds: array(idSchema).min(1).max(256),
      interfaces: array(drawingGroundingOverlayInterfaceSchema).max(256)
    }).strict();
    object({
      version: literal(1),
      drawingRef: drawingRefSchema,
      taskId: idSchema,
      stateEpoch: number().int().nonnegative(),
      disposition: _enum(["active", "committed", "discarded", "failed"]),
      groups: array(drawingGroundingOverlayGroupSchema).max(16)
    }).strict().superRefine(({ disposition, groups }, context) => {
      if (disposition === "active" && groups.length === 0) {
        context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_ACTIVE_GROUP_REQUIRED" });
      }
      if (disposition !== "active" && groups.length > 0) {
        context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_TERMINAL_GROUP_FORBIDDEN" });
      }
      const groundingIds = /* @__PURE__ */ new Set();
      const partKeys = /* @__PURE__ */ new Set();
      for (const [index, group] of groups.entries()) {
        if (groundingIds.has(group.groundingId)) {
          context.addIssue({
            code: "custom",
            path: ["groups", index, "groundingId"],
            message: "GROUNDING_ID_DUPLICATE"
          });
        }
        if (partKeys.has(group.partKey)) {
          context.addIssue({
            code: "custom",
            path: ["groups", index, "partKey"],
            message: "GROUNDING_PART_KEY_DUPLICATE"
          });
        }
        groundingIds.add(group.groundingId);
        partKeys.add(group.partKey);
      }
    });
    object({
      ref: drawingRefSchema,
      commands: array(workspaceCommandSchema).min(1),
      summary: string().min(1).optional()
    }).strict();
    const drawingPreviewSchema = object({
      version: literal(1),
      handle: idSchema,
      baseRef: drawingRefSchema,
      commands: array(workspaceCommandSchema).min(1),
      candidate: drawingWorkspaceSnapshotSchema.unwrap(),
      diff: object({
        createdNodeIds: array(idSchema),
        updatedNodeIds: array(idSchema),
        deletedNodeIds: array(idSchema)
      }).strict(),
      createdAt: number(),
      summary: string().min(1).optional()
    }).strict();
    discriminatedUnion("status", [
      object({ status: literal("previewed"), preview: drawingPreviewSchema }).strict(),
      object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
      object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
    ]);
    object({ handle: idSchema }).strict();
    discriminatedUnion("status", [
      object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
    ]);
    const extensionOwnershipShape = {
      extensionId: idSchema,
      workflowId: idSchema,
      ref: drawingRefSchema
    };
    const extensionInterfaceSchema = object({
      interfaceId: idSchema,
      nodeId: idSchema,
      endpoint: _enum(["start", "end"])
    }).strict();
    object({
      ...extensionOwnershipShape,
      targetNodeIds: array(idSchema).min(1).max(256),
      interfaces: array(extensionInterfaceSchema).max(256).optional(),
      program: spatialEditProgramSchema
    }).strict();
    object({
      ...extensionOwnershipShape,
      previewToken: idSchema,
      candidateDigest: idSchema
    }).strict();
    object({
      ...extensionOwnershipShape,
      previewToken: idSchema,
      candidateDigest: idSchema,
      program: spatialEditProgramSchema
    }).strict();
    const extensionNeedsRebaseResultSchema = object({
      status: literal("needs-rebase"),
      currentRef: drawingRefSchema
    }).strict();
    const extensionRejectedResultSchema = object({
      status: literal("rejected"),
      code: idSchema,
      message: string().min(1)
    }).strict();
    const extensionPreviewReadyResultSchema = object({
      status: literal("previewed"),
      previewToken: idSchema,
      candidateDigest: idSchema,
      ref: drawingRefSchema,
      expiresAt: number().int().nonnegative()
    }).strict();
    discriminatedUnion("status", [
      extensionPreviewReadyResultSchema,
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    discriminatedUnion("status", [
      object({
        status: literal("assessed"),
        previewToken: idSchema,
        candidateDigest: idSchema,
        assessment: assessmentSchema
      }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    discriminatedUnion("status", [
      object({ status: literal("finalized"), result: finalizePreviewResultSchema }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    discriminatedUnion("status", [
      object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    const annotationSessionStateSchema = object({
      version: literal(1),
      workspaceClaimed: boolean(),
      activationEpoch: number().int().nonnegative(),
      workflow: object({
        status: _enum(["idle", "running", "reviewing", "completed", "canceled", "failed", "needs-rebase"]),
        workflowId: idSchema.optional(),
        message: string().min(1).optional()
      }).strict()
    }).strict();
    object({
      bytes: _instanceof(Uint8Array),
      digest: idSchema,
      name: string().trim().min(1).max(255).optional()
    }).strict();
    const drawingObservationOverlaySchema = object({
      id: idSchema,
      label: string().trim().min(1).max(80),
      polygon: array(vec2Schema).min(3).max(16)
    }).strict();
    object({
      ref: drawingRefSchema,
      overlays: array(drawingObservationOverlaySchema).max(128).optional()
    }).strict();
    discriminatedUnion("status", [
      object({
        status: literal("rendered"),
        png: _instanceof(Uint8Array),
        contentDigest: idSchema,
        width: number().int().positive(),
        height: number().int().positive()
      }).strict(),
      object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
    ]);
    const drawingSessionIdSchema = string().min(1);
    const partitionEvidenceSchema = object({
      id: idSchema,
      origin: _enum(["document", "geometry", "fused", "ai", "manual"]),
      label: string(),
      sourceLines: array(number().int().positive()).optional(),
      geometryNodeIds: array(idSchema).optional()
    }).strict();
    const partitionDiagnosticSchema = object({
      id: idSchema,
      severity: _enum(["info", "warning", "error"]),
      code: idSchema,
      message: string(),
      segmentIds: array(idSchema).optional(),
      evidenceIds: array(idSchema).optional()
    }).strict();
    const shaftAxisSchema = object({
      origin: vec2Schema,
      direction: vec2Schema,
      normal: vec2Schema,
      zMin: number(),
      zMax: number(),
      orientation: _enum(["forward", "reversed"]),
      geometryNodeIds: array(idSchema).optional()
    }).strict();
    const stepCandidateSchema = object({
      id: idSchema,
      z: number(),
      score: number(),
      evidenceIds: array(idSchema),
      accepted: boolean()
    }).strict();
    const partitionSegmentSchema = object({
      id: idSchema,
      zStart: number(),
      zEnd: number(),
      profile: object({ minRadius: number(), maxRadius: number(), sampleCount: number().int().nonnegative() }).strict(),
      semanticType: string().optional(),
      name: string().optional(),
      boundaryConfidence: number(),
      semanticConfidence: number().optional(),
      geometryNodeIds: array(idSchema),
      boundaryEvidenceIds: array(idSchema),
      semanticEvidenceIds: array(idSchema),
      diagnosticIds: array(idSchema),
      profileSamples: array(object({ z: number(), radius: number().nonnegative(), geometryNodeId: idSchema }).strict()).optional()
    }).strict();
    const partitionGroupSchema = object({
      id: idSchema,
      segmentIds: array(idSchema),
      semanticType: string(),
      name: string().optional(),
      evidenceIds: array(idSchema)
    }).strict();
    const partitionDraftSchema = object({
      version: literal(1),
      drawingRef: drawingRefSchema,
      axis: shaftAxisSchema,
      segments: array(partitionSegmentSchema),
      semanticGroups: array(partitionGroupSchema),
      stepCandidates: array(stepCandidateSchema),
      evidence: array(partitionEvidenceSchema),
      diagnostics: array(partitionDiagnosticSchema),
      basePartitionRevisionId: idSchema.optional()
    }).strict();
    const partitionRevisionSchema = object({
      version: literal(1),
      drawingRef: drawingRefSchema,
      axis: shaftAxisSchema,
      segments: array(partitionSegmentSchema),
      semanticGroups: array(partitionGroupSchema),
      evidence: array(partitionEvidenceSchema),
      diagnostics: array(partitionDiagnosticSchema),
      id: idSchema,
      parentRevisionId: idSchema.optional(),
      confirmedAt: number()
    }).strict();
    const partitionEditCommandSchema = discriminatedUnion("type", [
      object({ type: literal("boundary.move"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive(), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
      object({ type: literal("segment.split"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, z: number(), snapTolerance: number().nonnegative() }).strict(),
      object({ type: literal("boundary.merge"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive() }).strict(),
      object({ type: literal("segment.metadata"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, name: string().max(120).optional(), semanticType: string().max(80).optional() }).strict()
    ]);
    const partitionSessionSnapshotSchema = object({
      version: literal(1),
      phase: _enum(["idle", "analyzing", "editing", "confirmed", "needs-rebase", "failed"]),
      drawingRef: drawingRefSchema.optional(),
      draft: partitionDraftSchema.optional(),
      confirmed: partitionRevisionSchema.optional(),
      canUndo: boolean(),
      canRedo: boolean(),
      message: string().optional(),
      updatedAt: number()
    }).strict();
    const partitionImportRequestSchema = object({
      dxf: object({ name: string().min(1).max(255), digest: idSchema, base64: string().min(1).max(27962028) }).strict(),
      engineeringDocument: object({ name: string().min(1).max(255), text: string() }).strict().optional()
    }).strict();
    const agentParameter = {
      name: "agent",
      wire: "agentId",
      source: "lookup",
      lookup: "agent",
      codec: {
        mode: "strict",
        typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
        schema: drawingSessionIdSchema
      }
    };
    const ANNOTATION_REMOTE = {
      package: "@vectorai/plugin-dsh-annotation-host",
      descriptors: [{
        id: "@vectorai/plugin-dsh-annotation-host#drawingAnnotation/getSessionState",
        service: "drawingAnnotation",
        namespace: "drawingAnnotation",
        method: "getSessionState",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter],
        result: {
          mode: "strict",
          typeSymbol: "@vectorai/plugin-space-contracts#AnnotationSessionState",
          schema: annotationSessionStateSchema
        }
      }, ...partitionDescriptors()]
    };
    function partitionDescriptors() {
      return [
        descriptor("importAndAnalyze", [jsonParameter("request", "@vectorai/plugin-space-contracts#PartitionImportRequest", partitionImportRequestSchema)]),
        descriptor("getPartitionState", []),
        descriptor("editPartition", [jsonParameter("command", "@vectorai/plugin-space-contracts#PartitionEditCommand", partitionEditCommandSchema)]),
        descriptor("confirmPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
        descriptor("cancelPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
        descriptor("undoPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
        descriptor("redoPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)])
      ];
    }
    function descriptor(method, parameters) {
      return {
        id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
        service: "drawingAnnotation",
        namespace: "drawingAnnotation",
        method,
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, ...parameters],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#PartitionSessionSnapshot", schema: partitionSessionSnapshotSchema }
      };
    }
    function jsonParameter(name, typeSymbol, schema) {
      return { name, wire: name, source: "json", codec: { mode: "strict", typeSymbol, schema } };
    }
    function createPartitionController(sessionId, remote) {
      let current = { partition: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null };
      const listeners = /* @__PURE__ */ new Set();
      let queue = Promise.resolve();
      let disposed = false;
      const update = (changes) => {
        if (disposed) return;
        current = { ...current, ...changes };
        for (const listener of listeners) listener();
      };
      const run = (operation) => {
        const task = queue.then(async () => {
          update({ busy: true, error: null });
          try {
            update({ partition: unwrap(await operation()) });
          } catch (error) {
            update({ error: error instanceof Error ? error.message : String(error) });
            throw error;
          } finally {
            update({ busy: false });
          }
        });
        queue = task.catch(() => void 0);
        return task;
      };
      const ref = () => {
        if (!current.partition.drawingRef) throw new Error("PARTITION_DRAWING_REQUIRED");
        return current.partition.drawingRef;
      };
      const edit = (command) => run(() => remote.editPartition(sessionId, { ...command, expectedDrawingRef: ref() }));
      return {
        state: {
          getSnapshot: () => current,
          subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
          }
        },
        actions: {
          refresh: () => run(() => remote.getPartitionState(sessionId)),
          async importFiles(dxf, engineeringDocument) {
            if (dxf.size > 20 * 1024 * 1024) throw new Error("DXF_SIZE_LIMIT");
            if (engineeringDocument && engineeringDocument.size > 2 * 1024 * 1024) throw new Error("ENGINEERING_DOCUMENT_SIZE_LIMIT");
            const bytes = new Uint8Array(await dxf.arrayBuffer());
            const digest = `sha256:${hex(await crypto.subtle.digest("SHA-256", bytes))}`;
            const request = {
              dxf: { name: dxf.name, digest, base64: base64(bytes) },
              ...engineeringDocument === void 0 ? {} : { engineeringDocument: { name: engineeringDocument.name, text: await engineeringDocument.text() } }
            };
            await run(() => remote.importAndAnalyze(sessionId, request));
          },
          moveBoundary: (boundaryIndex, requestedZ, snapTolerance) => edit({ type: "boundary.move", boundaryIndex, requestedZ, snapTolerance }),
          splitSegment: (segmentId, z, snapTolerance) => edit({ type: "segment.split", segmentId, z, snapTolerance }),
          mergeBoundary: (boundaryIndex) => edit({ type: "boundary.merge", boundaryIndex }),
          updateSegment: (segmentId, value) => edit({ type: "segment.metadata", segmentId, ...value }),
          confirm: () => run(() => remote.confirmPartition(sessionId, ref())),
          cancel: () => run(() => remote.cancelPartition(sessionId, ref())),
          undo: () => run(() => remote.undoPartition(sessionId, ref())),
          redo: () => run(() => remote.redoPartition(sessionId, ref())),
          setPreviewHeld: (previewHeld) => update({ previewHeld })
        },
        dispose() {
          disposed = true;
          listeners.clear();
        }
      };
    }
    function unwrap(result) {
      if (result.ok !== true) throw new Error("PARTITION_REMOTE_FAILED");
      return structuredClone(result.value);
    }
    function hex(value) {
      return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    function base64(bytes) {
      let binary = "";
      const size = 32768;
      for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size));
      return btoa(binary);
    }
    const inject = ["remote", "drawingSurfaceRegistry"];
    async function apply(ctx) {
      const remote = ctx.get("remote");
      const disposeRemote = await remote.$mount(ANNOTATION_REMOTE);
      const fiber = ctx.inject(
        ["remote.drawingAnnotation", "drawingSurfaceRegistry"],
        (scope) => {
          const annotationRemote = scope.get("remote").drawingAnnotation;
          const registry2 = scope.get("drawingSurfaceRegistry");
          const stateSource = createAnnotationRemoteStateSource(annotationRemote);
          const partitionControllers = /* @__PURE__ */ new Map();
          const partitionFor = (sessionId) => {
            const current = partitionControllers.get(sessionId);
            if (current) return current;
            const controller = createPartitionController(sessionId, annotationRemote);
            partitionControllers.set(sessionId, controller);
            void controller.actions.refresh();
            return controller;
          };
          const registration = registry2.registerWorkspace({
            id: "engineering-annotation",
            apiVersion: 1,
            priority: 100,
            claimSource: stateSource.claimSource,
            Component: (props) => /* @__PURE__ */ jsxRuntime.jsx(
              AnnotationWorkspace,
              {
                ...props,
                state: stateSource.observeState(props.sessionId),
                partition: partitionFor(props.sessionId)
              }
            )
          });
          return () => {
            registration.dispose();
            stateSource.dispose();
            for (const controller of partitionControllers.values()) controller.dispose();
            partitionControllers.clear();
          };
        }
      );
      return async () => {
        await fiber.dispose();
        await disposeRemote();
      };
    }
    exports.apply = apply;
    exports.inject = inject;
    var originalApply = module.exports.apply;
    module.exports.apply = async (ctx) => {
      var style = document.createElement("style");
      style.dataset["vectoraiDshAnnotation"] = "true";
      style.textContent = ".vai-workspace {\n  --vai-bg: #090b0e;\n  --vai-panel: #12161b;\n  --vai-panel-deep: #0d1014;\n  --vai-panel-hover: rgba(255, 255, 255, 0.035);\n  --vai-border: rgba(255, 255, 255, 0.07);\n  --vai-text: #cbd5e1;\n  --vai-muted: #64748b;\n  --vai-subtle: #334155;\n  --vai-accent: #6da9d2;\n  --vai-danger: #ef6a6a;\n  --vai-success: #4ade80;\n  box-sizing: border-box;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--vai-text);\n  background: var(--vai-bg);\n  font: 13px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\n.vai-workspace *,\n.vai-workspace *::before,\n.vai-workspace *::after {\n  box-sizing: border-box;\n}\n\n.vai-workspace__header {\n  display: flex;\n  height: 44px;\n  min-height: 44px;\n  align-items: center;\n  gap: 8px;\n  padding: 0 10px;\n  border-bottom: 1px solid var(--vai-border);\n  background: var(--vai-bg);\n  color: var(--vai-muted);\n}\n\n.vai-workspace__identity {\n  display: flex;\n  min-width: 0;\n  max-width: 220px;\n  align-items: center;\n  gap: 7px;\n  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-workspace__drawing-id {\n  overflow: hidden;\n  color: var(--vai-text);\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.vai-workspace__badge {\n  border-radius: 999px;\n  padding: 2px 7px;\n  color: #d7a45e;\n  background: rgba(230, 161, 93, 0.1);\n}\n\n.vai-workspace__badge--preview {\n  border-color: rgba(56, 189, 248, 0.55);\n  background: rgba(14, 165, 233, 0.14);\n  color: #7dd3fc;\n}\n\n.vai-entity--preview-created,\n.vai-entity--preview-updated {\n  color: #38bdf8;\n  filter: drop-shadow(0 0 2px rgba(56, 189, 248, 0.65));\n}\n\n.vai-entity--preview-before {\n  opacity: 0.28;\n  color: #f59e0b;\n  pointer-events: none;\n}\n\n.vai-entity--preview-deleted {\n  opacity: 0.24;\n  color: #fb7185;\n  stroke-dasharray: 5 4;\n  pointer-events: none;\n}\n\n.vai-workspace__busy {\n  margin-left: auto;\n}\n\n.vai-workspace__error {\n  padding: 7px 14px;\n  border-bottom: 1px solid #f1c4c1;\n  color: var(--vai-danger);\n  background: #fff1f0;\n}\n\n.vai-workspace__body {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  flex: 1;\n}\n\n.vai-workspace__canvas-region {\n  position: relative;\n  display: flex;\n  min-width: 0;\n  min-height: 0;\n  flex: 1;\n  overflow: hidden;\n}\n\n.vai-workspace button {\n  border: 1px solid transparent;\n  border-radius: 6px;\n  padding: 5px 7px;\n  color: var(--vai-muted);\n  background: transparent;\n  font: inherit;\n  cursor: pointer;\n}\n\n.vai-workspace button:hover:not(:disabled),\n.vai-workspace button[aria-pressed=\"true\"] {\n  border-color: rgba(109, 169, 210, 0.22);\n  color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.08);\n}\n\n.vai-workspace button:disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.vai-toolbar {\n  position: absolute;\n  z-index: 8;\n  bottom: 16px;\n  left: 50%;\n  display: flex;\n  max-width: calc(100% - 32px);\n  align-items: center;\n  gap: 5px;\n  padding: 6px;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 12px;\n  background: rgba(18, 22, 27, 0.92);\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);\n  backdrop-filter: blur(14px);\n  transform: translateX(-50%);\n}\n\n.vai-toolbar--motion-rig {\n  bottom: 70px;\n  gap: 0;\n  padding: 4px;\n  border-color: rgba(255, 255, 255, 0.08);\n  border-radius: 10px;\n  background: rgba(15, 19, 24, 0.9);\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--cancel {\n  border-color: transparent;\n  color: var(--vai-danger);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--cancel:hover:not(:disabled) {\n  border-color: transparent;\n  color: #fca5a5;\n  background: rgba(239, 106, 106, 0.1);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm {\n  border-color: transparent;\n  color: var(--vai-success);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--preview {\n  border-color: transparent;\n  color: var(--vai-accent);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--preview:hover:not(:disabled),\n.vai-toolbar--motion-rig .vai-toolbar__action--preview[aria-pressed=\"true\"] {\n  border-color: transparent;\n  color: #bae6fd;\n  background: rgba(109, 169, 210, 0.12);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm:hover:not(:disabled) {\n  border-color: transparent;\n  color: #86efac;\n  background: rgba(74, 222, 128, 0.1);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm:disabled {\n  color: #476455;\n  background: transparent;\n  opacity: 0.55;\n}\n\n.vai-toolbar__separator--motion-rig {\n  height: 18px;\n  margin: 0 2px;\n  background: rgba(255, 255, 255, 0.09);\n}\n\n.vai-toolbar button,\n.vai-toolbar__upload {\n  display: inline-flex;\n  width: 32px;\n  height: 32px;\n  flex: 0 0 auto;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n  white-space: nowrap;\n}\n\n.vai-toolbar__separator {\n  width: 1px;\n  height: 20px;\n  background: var(--vai-border);\n}\n\n.vai-toolbar__upload {\n  border: 1px solid transparent;\n  border-radius: 6px;\n  color: var(--vai-muted);\n  cursor: pointer;\n}\n\n.vai-toolbar__upload:hover {\n  border-color: rgba(109, 169, 210, 0.22);\n  color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.08);\n}\n\n.vai-toolbar__upload--disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.vai-toolbar__upload input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  clip-path: inset(50%);\n}\n\n.vai-inspector-stack {\n  display: flex;\n  width: 240px;\n  min-width: 210px;\n  min-height: 0;\n  flex: 0 0 240px;\n  flex-direction: column;\n  overflow: hidden;\n  border-right: 1px solid var(--vai-border);\n  background: var(--vai-panel);\n}\n\n.vai-activity-bar {\n  z-index: 6;\n  display: flex;\n  width: 42px;\n  min-width: 42px;\n  flex: 0 0 42px;\n  flex-direction: column;\n  align-items: center;\n  gap: 4px;\n  padding: 6px 4px;\n  border-right: 1px solid var(--vai-border);\n  background: var(--vai-panel-deep);\n}\n\n.vai-activity-bar__button {\n  position: relative;\n  display: inline-flex;\n  width: 34px;\n  height: 34px;\n  flex: 0 0 34px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 !important;\n  border-radius: 7px !important;\n}\n\n.vai-activity-bar__button[aria-pressed=\"true\"]::before {\n  position: absolute;\n  top: 7px;\n  bottom: 7px;\n  left: -5px;\n  width: 2px;\n  border-radius: 0 2px 2px 0;\n  background: var(--vai-accent);\n  content: \"\";\n}\n\n.vai-inspector-stack--activity {\n  position: relative;\n  width: 260px;\n  min-width: 220px;\n  max-width: 420px;\n  flex: 0 0 auto;\n}\n\n.vai-inspector-stack--activity > .vai-panel {\n  min-height: 0;\n  flex: 1 1 auto;\n}\n\n.vai-inspector-stack--activity > .vai-inspector {\n  height: auto;\n  border-top: 0;\n}\n\n.vai-inspector-stack--activity .vai-panel__title {\n  padding-right: 42px;\n}\n\n.vai-panel-close {\n  position: absolute;\n  z-index: 2;\n  top: 7px;\n  right: 7px;\n  display: inline-flex;\n  width: 28px;\n  height: 28px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 !important;\n}\n\n.vai-panel-resizer {\n  position: absolute;\n  z-index: 3;\n  top: 0;\n  right: -3px;\n  bottom: 0;\n  width: 6px;\n  cursor: col-resize;\n  touch-action: none;\n}\n\n.vai-panel-resizer::after {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 2px;\n  width: 1px;\n  background: var(--vai-accent);\n  content: \"\";\n  opacity: 0;\n  transition: opacity 120ms ease;\n}\n\n.vai-panel-resizer:hover::after,\n.vai-panel-resizer:focus-visible::after {\n  opacity: 0.9;\n}\n\n.vai-panel-resizer:focus-visible {\n  outline: none;\n}\n\n.vai-panel {\n  display: flex;\n  width: 100%;\n  min-width: 0;\n  min-height: 0;\n  flex-direction: column;\n  border: 0;\n  background: var(--vai-panel);\n}\n\n.vai-object-list {\n  flex: 1 1 auto;\n}\n\n.vai-inspector {\n  height: 256px;\n  flex: 0 0 256px;\n  border-top: 1px solid var(--vai-border);\n}\n\n.vai-panel__title {\n  display: flex;\n  min-height: 44px;\n  align-items: center;\n  padding: 0 12px;\n  border-bottom: 1px solid var(--vai-border);\n  color: #cbd5e1;\n  font-size: 11px;\n  font-weight: 500;\n}\n\n.vai-panel__empty,\n.vai-object-group__empty {\n  padding: 12px;\n  color: var(--vai-muted);\n}\n\n.vai-object-list__scroll,\n.vai-inspector__scroll {\n  min-height: 0;\n  flex: 1;\n  overflow: auto;\n}\n\n.vai-object-group h3 {\n  display: flex;\n  margin: 0;\n  padding: 8px 10px 5px;\n  justify-content: space-between;\n  color: #475569;\n  font-size: 9px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n}\n\n.vai-object-row {\n  display: flex;\n  align-items: center;\n  gap: 3px;\n  border-left: 2px solid transparent;\n  padding: 3px 7px;\n}\n\n.vai-object-row--selected {\n  border-left-color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.07);\n}\n\n.vai-object-row--ai-grounded {\n  border-left-color: #2dd4bf;\n  background: rgba(45, 212, 191, 0.12);\n  animation: vai-ai-grounded-pulse 0.85s ease-in-out infinite;\n}\n\n.vai-object-row__main {\n  display: flex;\n  min-width: 0;\n  flex: 1;\n  align-items: center;\n  gap: 7px;\n  border: 0 !important;\n  text-align: left;\n}\n\n.vai-object-row__glyph {\n  width: 18px;\n  color: var(--vai-accent);\n  text-align: center;\n}\n\n.vai-object-row__identity {\n  display: flex;\n  min-width: 0;\n  flex-direction: column;\n}\n\n.vai-object-row__identity strong,\n.vai-object-row__identity small {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.vai-object-row__identity strong {\n  color: #94a3b8;\n  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-weight: 400;\n}\n\n.vai-object-row__identity small {\n  color: var(--vai-muted);\n  font-size: 10px;\n}\n\n.vai-icon-button {\n  width: 26px;\n  padding: 3px !important;\n}\n\n.vai-icon-button--danger:hover:not(:disabled) {\n  color: var(--vai-danger) !important;\n}\n\n.vai-inspector__identity {\n  display: grid;\n  grid-template-columns: 70px minmax(0, 1fr);\n  margin: 0;\n  padding: 10px;\n  gap: 6px;\n  border-bottom: 1px solid var(--vai-border);\n}\n\n.vai-inspector__identity dt {\n  color: var(--vai-muted);\n}\n\n.vai-inspector__identity dd {\n  min-width: 0;\n  margin: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.vai-inspector__fields {\n  display: grid;\n  padding: 10px;\n  gap: 8px;\n}\n\n.vai-field {\n  display: grid;\n  grid-template-columns: 80px minmax(0, 1fr);\n  align-items: center;\n  gap: 7px;\n}\n\n.vai-field span {\n  color: var(--vai-muted);\n}\n\n.vai-field input:not([type=\"checkbox\"]) {\n  min-width: 0;\n  width: 100%;\n  border: 1px solid var(--vai-border);\n  border-radius: 4px;\n  padding: 5px 6px;\n  color: inherit;\n  background: var(--vai-panel-deep);\n  font: inherit;\n}\n\n.vai-inspector__raw {\n  margin: 0 10px 12px;\n  color: var(--vai-muted);\n}\n\n.vai-inspector__raw pre {\n  overflow: auto;\n  padding: 8px;\n  border-radius: 5px;\n  background: var(--vai-bg);\n  font-size: 10px;\n}\n\n.vai-status {\n  display: flex;\n  min-height: 28px;\n  align-items: center;\n  gap: 14px;\n  padding: 0 10px;\n  border-top: 1px solid var(--vai-border);\n  color: var(--vai-muted);\n  background: var(--vai-panel);\n  font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-status__coords {\n  margin-left: auto;\n}\n\n@media (max-width: 760px) {\n  .vai-inspector-stack {\n    position: absolute;\n    z-index: 5;\n    top: 0;\n    bottom: 0;\n    box-shadow: 4px 0 18px rgba(0, 0, 0, 0.18);\n  }\n\n  .vai-workspace__identity {\n    display: none;\n  }\n\n  .vai-status > span:nth-child(-n+3) {\n    display: none;\n  }\n}\n\n.vai-canvas {\n  position: relative;\n  min-width: 0;\n  min-height: 0;\n  flex: 1;\n  overflow: hidden;\n  outline: none;\n  background: #101419;\n}\n\n.vai-canvas:focus-visible {\n  box-shadow: inset 0 0 0 2px var(--vai-accent);\n}\n\n.vai-canvas__svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  user-select: none;\n  touch-action: none;\n}\n\n.vai-grid__minor {\n  stroke: rgba(148, 163, 184, 0.025);\n  stroke-width: 1;\n}\n\n.vai-grid__major {\n  stroke: rgba(148, 163, 184, 0.075);\n  stroke-width: 1;\n}\n\n.vai-grid__axes line {\n  stroke: rgba(148, 163, 184, 0.3);\n  stroke-width: 1;\n}\n\n.vai-grid__axes text {\n  fill: rgba(148, 163, 184, 0.45);\n  font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-entity {\n  cursor: pointer;\n  fill: #d7e0ea;\n  stroke: #d7e0ea;\n  stroke-width: 1.35;\n}\n\n.vai-entity--candidate {\n  stroke: #e6a15d;\n  stroke-dasharray: 6 4;\n}\n\n.vai-entity--selected {\n  fill: #72b9e8;\n  stroke: #72b9e8;\n  stroke-width: 2;\n}\n\n.vai-entity--motion-rig {\n  fill: #38bdf8;\n  stroke: #38bdf8;\n  stroke-width: 2.25;\n  filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.5));\n}\n\n.vai-motion-rig__guide {\n  stroke: rgba(125, 211, 252, 0.65);\n  stroke-width: 1.5;\n  stroke-dasharray: 5 5;\n}\n\n.vai-motion-rig__anchor {\n  fill: #101419;\n  stroke: #e2e8f0;\n  stroke-width: 2;\n}\n\n.vai-motion-rig__handle {\n  cursor: grab;\n  fill: #0ea5e9;\n  stroke: #e0f2fe;\n  stroke-width: 2;\n}\n\n.vai-motion-rig--dragging .vai-motion-rig__handle {\n  cursor: grabbing;\n}\n\n.vai-motion-rig--preview .vai-motion-rig__handle {\n  cursor: grab;\n  fill: #22c55e;\n}\n\n.vai-motion-rig__connector-handle {\n  cursor: grab;\n  fill: #101419;\n  stroke: #38bdf8;\n  stroke-width: 2;\n}\n\n.vai-motion-rig--dragging .vai-motion-rig__connector-handle {\n  cursor: grabbing;\n}\n\n.vai-motion-rig__status {\n  fill: #e0f2fe;\n  stroke: none;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-entity--ai-grounded {\n  fill: #2dd4bf;\n  stroke: #2dd4bf;\n  stroke-width: 2;\n  filter: drop-shadow(0 0 3px rgba(45, 212, 191, 0.75));\n  animation: vai-ai-grounded-pulse 0.85s ease-in-out infinite;\n}\n\n.vai-entity--motion-rig.vai-entity--ai-grounded {\n  fill: #38bdf8;\n  stroke: #38bdf8;\n  animation: none;\n}\n\n.vai-motion-preview__before .vai-entity {\n  cursor: default;\n  opacity: 0.32;\n  fill: #a69b87;\n  stroke: #a69b87;\n  stroke-width: 1.2;\n  stroke-dasharray: 5 4;\n  filter: none;\n  pointer-events: none;\n}\n\n@keyframes vai-ai-grounded-pulse {\n  0%, 100% { opacity: 0.42; }\n  50% { opacity: 1; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .vai-entity--ai-grounded,\n  .vai-object-row--ai-grounded {\n    animation: none;\n  }\n}\n\n.vai-entity text {\n  fill: currentColor;\n  stroke: none;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-relations {\n  color: #88a5bb;\n  fill: #88a5bb;\n  stroke: #88a5bb;\n  stroke-width: 1;\n  stroke-dasharray: 4 4;\n}\n\n.vai-canvas__selection-box {\n  fill: rgba(22, 119, 255, 0.16);\n  stroke: #4ea0ff;\n  stroke-width: 1;\n  stroke-dasharray: 4 3;\n}\n\n.vai-preview-motion {\n  fill: none;\n  stroke: #54b9ff;\n  stroke-width: 2;\n  stroke-dasharray: 7 5;\n  animation: vai-preview-motion-flow 0.8s linear infinite;\n}\n\n#vai-preview-motion-arrow path {\n  fill: #54b9ff;\n}\n\n@keyframes vai-preview-motion-flow {\n  to { stroke-dashoffset: -24; }\n}\n\n.vai-workspace__state {\n  max-width: 440px;\n  margin: auto;\n  padding: 32px;\n  text-align: center;\n}\n\n.vai-workspace__state-title {\n  font-size: 16px;\n  font-weight: 650;\n}\n\n.vai-workspace__state-detail {\n  margin-top: 7px;\n  color: var(--vai-muted);\n}\n.vai-annotation-workspace {\n  display: flex;\n  min-height: 0;\n  height: 100%;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--vai-text, #d8e0eb);\n  background: var(--vai-bg, #0e141b);\n}\n\n.vai-annotation-workspace__header {\n  display: flex;\n  min-height: 48px;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 16px;\n  border-bottom: 1px solid rgba(148, 163, 184, .18);\n}\n\n.vai-annotation-workspace__header > div { display: flex; gap: 12px; align-items: baseline; }\n.vai-annotation-workspace__header span { color: #8fa1b5; font-size: 12px; }\n.vai-annotation-workspace__header .vai-annotation-provisional { color: #f6b94d; border: 1px solid #6d5427; border-radius: 999px; padding: 2px 8px; }\n.vai-annotation-workspace__body { display: grid; min-height: 0; flex: 1; grid-template-columns: 48px minmax(0, 1fr) 248px; }\n.vai-annotation-workspace__rail { display: flex; flex-direction: column; gap: 8px; padding: 10px 6px; border-right: 1px solid rgba(148, 163, 184, .18); }\n.vai-annotation-workspace__rail button { width: 36px; height: 36px; border: 0; border-radius: 8px; color: #8fa1b5; background: transparent; }\n.vai-annotation-workspace__rail button:hover { color: #e2e8f0; background: rgba(96, 165, 250, .12); }\n.vai-annotation-workspace__canvas { position: relative; min-width: 0; min-height: 0; }\n.vai-annotation-workspace__surface { position: absolute; inset: 0; }\n.vai-annotation-workspace__empty { display: grid; height: 100%; place-items: center; color: #8fa1b5; }\n.vai-annotation-workspace__inspector { padding: 14px; border-left: 1px solid rgba(148, 163, 184, .18); background: rgba(15, 23, 32, .72); }\n.vai-annotation-workspace__inspector h2 { margin: 0 0 16px; font-size: 13px; }\n.vai-annotation-workspace__inspector dl { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin: 0; font-size: 12px; }\n.vai-annotation-workspace__inspector dt { color: #8fa1b5; }\n.vai-annotation-workspace__inspector dd { margin: 0; }\n\n.vai-annotation-import { display: grid; width: min(440px, calc(100% - 48px)); gap: 14px; margin: auto; padding: 24px; border: 1px solid rgba(148, 163, 184, .22); border-radius: 14px; background: rgba(17, 25, 35, .94); box-shadow: 0 18px 45px rgba(0, 0, 0, .3); }\n.vai-annotation-import p { margin: 0; color: #8fa1b5; font-size: 12px; line-height: 1.6; }\n.vai-annotation-import label { display: grid; gap: 7px; color: #b9c6d6; font-size: 12px; }\n.vai-annotation-import input { padding: 10px; border: 1px dashed rgba(148, 163, 184, .32); border-radius: 9px; color: #cbd5e1; background: #0c1219; }\n.vai-annotation-import button { min-height: 38px; border: 1px solid #2789b8; border-radius: 9px; color: #e8f8ff; background: #126286; }\n\n.vai-partition-band { fill: rgba(63, 187, 238, .08); stroke: #46bcec; stroke-width: 1.5; vector-effect: non-scaling-stroke; }\n.vai-partition-band--document { fill: rgba(87, 202, 142, .1); stroke: #61d79c; }\n.vai-partition-band--ai { fill: rgba(177, 128, 255, .08); stroke: #b58aff; stroke-dasharray: 2 4; }\n.vai-partition-band--manual { fill: rgba(255, 205, 92, .08); stroke: #ffd166; }\n.vai-partition-band--geometry { stroke-dasharray: 8 5; }\n.vai-partition-label { fill: #dff6ff; font: 600 11px ui-monospace, monospace; paint-order: stroke; stroke: #0d151d; stroke-width: 3px; vector-effect: non-scaling-stroke; }\n.vai-partition-handle { fill: #0e1821; stroke: #54c8f7; stroke-width: 2.5; vector-effect: non-scaling-stroke; cursor: ew-resize; }\n\n.vai-partition-actions { position: absolute; z-index: 8; left: 50%; bottom: 82px; display: flex; gap: 8px; padding: 7px; transform: translateX(-50%); border: 1px solid rgba(148, 163, 184, .2); border-radius: 14px; background: rgba(14, 21, 29, .94); box-shadow: 0 12px 30px rgba(0, 0, 0, .36); backdrop-filter: blur(12px); }\n.vai-partition-action { display: grid; width: 42px; height: 38px; place-items: center; border: 1px solid transparent; border-radius: 10px; color: #b9c6d6; background: rgba(148, 163, 184, .08); font-size: 22px; }\n.vai-partition-action--cancel { color: #ff7c86; border-color: rgba(239, 68, 68, .35); background: rgba(127, 29, 29, .24); }\n.vai-partition-action--confirm { color: #56e29a; border-color: rgba(34, 197, 94, .35); background: rgba(20, 83, 45, .3); }\n.vai-partition-action--preview.is-held { color: #7dd3fc; border-color: rgba(56, 189, 248, .42); background: rgba(3, 105, 161, .24); }\n.vai-partition-inspector ol { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }\n.vai-partition-inspector li { display: grid; gap: 3px; padding: 9px; border-radius: 8px; background: rgba(148, 163, 184, .06); font-size: 12px; }\n.vai-partition-inspector small { color: #8295aa; }\n.vai-partition-inspector__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }\n.vai-partition-inspector input { min-width: 0; padding: 5px 7px; border: 1px solid rgba(148, 163, 184, .18); border-radius: 6px; color: #d8e0eb; background: #0b1219; font-size: 11px; }\n.vai-partition-inspector__commands { display: flex; gap: 5px; }\n.vai-partition-inspector__commands button { padding: 4px 7px; border: 1px solid rgba(148, 163, 184, .2); border-radius: 6px; color: #aebdce; background: rgba(148, 163, 184, .06); font-size: 10px; }\n.vai-partition-inspector__boundary { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px; color: #8295aa; font-size: 10px; }\n.vai-partition-diagnostics { margin-top: 14px; color: #f6bf73; font-size: 11px; }\n.vai-partition-history { position: absolute; z-index: 8; left: 50%; bottom: 28px; display: flex; gap: 6px; transform: translateX(-50%); }\n.vai-partition-history button { width: 36px; height: 32px; border: 1px solid rgba(148, 163, 184, .2); border-radius: 9px; color: #aebdce; background: rgba(14, 21, 29, .92); font-size: 18px; }\n.vai-partition-history button:disabled { opacity: .3; }\n";
      document.head.append(style);
      var dispose;
      try {
        dispose = await originalApply(ctx);
      } catch (error) {
        style.remove();
        throw error;
      }
      return async () => {
        try {
          await dispose?.();
        } finally {
          style.remove();
        }
      };
    };
    return module.exports;
  }
});
