window.__ModuleLoader__.load({
  id: "@vectorai/plugin-dsh-space-client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    var __defProp = Object.defineProperty;
    var __typeError = (msg) => {
      throw TypeError(msg);
    };
    var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
    var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
    var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    var _lines;
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
        const point3 = node.controlPoints[sourceIndex];
        work.push([point3[0] * weight, point3[1] * weight, weight]);
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
      const flatness = Math.max(0, ...points.slice(1, -1).map((point3) => pointSegmentDistance(point3, start, end)));
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
      const levels = [controls.map((point3) => [...point3])];
      while (levels.at(-1).length > 1) {
        const previous = levels.at(-1);
        levels.push(previous.slice(1).map((point3, index) => mixHomogeneous(previous[index], point3, 0.5)));
      }
      return [levels.map((level) => level[0]), levels.map((level) => level.at(-1)).reverse()];
    }
    function project(point3) {
      if (!(Math.abs(point3[2]) > Number.EPSILON)) throw new TypeError("SPLINE_WEIGHT_SUM_INVALID");
      return [point3[0] / point3[2], point3[1] / point3[2]];
    }
    function bernstein(degree, index, parameter) {
      return binomial(degree, index) * parameter ** index * (1 - parameter) ** (degree - index);
    }
    function binomial(n, k) {
      let result = 1;
      for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
      return result;
    }
    function pointSegmentDistance(point3, start, end) {
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) return Math.hypot(point3[0] - start[0], point3[1] - start[1]);
      const projection = Math.min(1, Math.max(0, ((point3[0] - start[0]) * dx + (point3[1] - start[1]) * dy) / lengthSquared));
      return Math.hypot(
        point3[0] - (start[0] + projection * dx),
        point3[1] - (start[1] + projection * dy)
      );
    }
    function samePoint(first, second) {
      return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
    }
    const GEOMETRY_LAYER = "GEOMETRY";
    const ANNOTATION_LAYER = "ANNOTATIONS";
    function exportDrawingDxf(document2) {
      const writer = new DxfWriter();
      writer.section("HEADER", () => {
        writer.pair(9, "$ACADVER");
        writer.pair(1, "AC1015");
        writer.pair(9, "$INSUNITS");
        writer.pair(70, insertionUnit(document2.unitSystem.length));
      });
      writer.section("TABLES", () => {
        writer.pair(0, "TABLE");
        writer.pair(2, "LAYER");
        writer.pair(70, 2);
        writeLayer(writer, GEOMETRY_LAYER, 7);
        writeLayer(writer, ANNOTATION_LAYER, 3);
        writer.pair(0, "ENDTAB");
      });
      writer.section("ENTITIES", () => {
        for (const node of document2.geometry) {
          if (node.visible) writeGeometry(writer, node);
        }
        for (const node of document2.annotations) {
          if (node.visible) writeAnnotation(writer, node);
        }
      });
      writer.pair(0, "EOF");
      return writer.toString();
    }
    class DxfWriter {
      constructor() {
        __privateAdd(this, _lines, []);
      }
      pair(code, value) {
        __privateGet(this, _lines).push(String(code), typeof value === "number" ? formatNumber(value) : value);
      }
      section(name, write) {
        this.pair(0, "SECTION");
        this.pair(2, name);
        write();
        this.pair(0, "ENDSEC");
      }
      toString() {
        return `${__privateGet(this, _lines).join("\r\n")}\r
    `;
      }
    }
    _lines = new WeakMap();
    function writeLayer(writer, name, color) {
      writer.pair(0, "LAYER");
      writer.pair(2, name);
      writer.pair(70, 0);
      writer.pair(62, color);
      writer.pair(6, "CONTINUOUS");
    }
    function writeGeometry(writer, node) {
      switch (node.type) {
        case "point":
          entity(writer, "POINT", GEOMETRY_LAYER);
          point(writer, 10, [node.x, node.y]);
          return;
        case "line":
          writeLine(writer, node.start, node.end, GEOMETRY_LAYER);
          return;
        case "ray":
        case "xline":
          entity(writer, node.type === "ray" ? "RAY" : "XLINE", GEOMETRY_LAYER);
          point(writer, 10, node.origin);
          point(writer, 11, node.direction);
          return;
        case "circle":
          entity(writer, "CIRCLE", GEOMETRY_LAYER);
          point(writer, 10, node.center);
          writer.pair(40, node.radius);
          return;
        case "arc": {
          entity(writer, "ARC", GEOMETRY_LAYER);
          point(writer, 10, node.center);
          writer.pair(40, node.radius);
          writer.pair(50, normalizeDegrees(node.counterClockwise ? node.startAngle : node.endAngle));
          writer.pair(51, normalizeDegrees(node.counterClockwise ? node.endAngle : node.startAngle));
          return;
        }
        case "ellipse":
          entity(writer, "ELLIPSE", GEOMETRY_LAYER);
          point(writer, 10, node.center);
          point(writer, 11, node.majorAxis);
          writer.pair(40, node.ratio);
          writer.pair(41, node.startParam ?? 0);
          writer.pair(42, node.endParam ?? Math.PI * 2);
          return;
        case "polyline":
          if (node.vertices.length === 0) return;
          entity(writer, "LWPOLYLINE", GEOMETRY_LAYER);
          writer.pair(90, node.vertices.length);
          writer.pair(70, node.closed ? 1 : 0);
          for (const vertex of node.vertices) {
            writer.pair(10, vertex.point[0]);
            writer.pair(20, vertex.point[1]);
            if (vertex.bulge !== void 0) writer.pair(42, vertex.bulge);
          }
          return;
        case "spline":
          if (node.controlPoints.length === 0) return;
          entity(writer, "SPLINE", GEOMETRY_LAYER);
          writer.pair(70, 8 | (node.closed ? 1 : 0) | (node.periodic ? 2 : 0) | (node.weights ? 4 : 0));
          writer.pair(71, node.degree);
          writer.pair(72, node.knots.length);
          writer.pair(73, node.controlPoints.length);
          writer.pair(74, 0);
          for (const knot of node.knots) writer.pair(40, knot);
          for (const weight of node.weights ?? []) writer.pair(41, weight);
          for (const controlPoint of node.controlPoints) point(writer, 10, controlPoint);
      }
    }
    function writeAnnotation(writer, node) {
      switch (node.type) {
        case "text":
          writeText(
            writer,
            node.position,
            node.content,
            node.height,
            node.rotation,
            node.alignment,
            node.verticalAlignment
          );
          return;
        case "dimension": {
          writePolyline(writer, node.definitionPoints, false, ANNOTATION_LAYER);
          writeText(writer, node.textPosition, dimensionLabel$1(node), annotationTextHeight(node), 0, "center", "middle");
          return;
        }
        case "leader": {
          writePolyline(writer, node.points, false, ANNOTATION_LAYER);
          const textPosition = node.points.at(-1);
          if (textPosition !== void 0) {
            writeText(writer, textPosition, node.content, node.textHeight, 0, "left", "baseline");
          }
          return;
        }
        case "centerline": {
          const [start, end] = extendLine(node.start, node.end, node.extension);
          writeLine(writer, start, end, ANNOTATION_LAYER, "CENTER");
          return;
        }
        case "section-hatch":
          if (node.hatch !== void 0) {
            writeHatch(writer, node);
            return;
          }
          for (const segment of node.segments ?? []) {
            writeLine(writer, segment.start, segment.end, ANNOTATION_LAYER);
          }
      }
    }
    function writeHatch(writer, node) {
      var _a2;
      const hatch = node.hatch;
      entity(writer, "HATCH", ANNOTATION_LAYER);
      writer.pair(100, "AcDbHatch");
      writer.pair(10, 0);
      writer.pair(20, 0);
      writer.pair(30, hatch.elevation);
      writer.pair(210, hatch.extrusion[0]);
      writer.pair(220, hatch.extrusion[1]);
      writer.pair(230, hatch.extrusion[2]);
      writer.pair(2, node.pattern);
      writer.pair(70, 0);
      writer.pair(71, 0);
      writer.pair(91, hatch.boundaryPaths.length);
      for (const path of hatch.boundaryPaths) {
        writer.pair(92, path.flags & -3);
        writer.pair(93, path.edges.length);
        for (const edge of path.edges) {
          if (edge.type === "line") {
            writer.pair(72, 1);
            point2(writer, 10, edge.start);
            point2(writer, 11, edge.end);
          } else if (edge.type === "arc") {
            writer.pair(72, 2);
            point2(writer, 10, edge.center);
            writer.pair(40, edge.radius);
            writer.pair(50, edge.startAngle);
            writer.pair(51, edge.endAngle);
            writer.pair(73, edge.counterClockwise ? 1 : 0);
          } else if (edge.type === "ellipse") {
            writer.pair(72, 3);
            point2(writer, 10, edge.center);
            point2(writer, 11, edge.majorAxis);
            writer.pair(40, edge.axisRatio);
            writer.pair(50, edge.startParameter);
            writer.pair(51, edge.endParameter);
            writer.pair(73, edge.counterClockwise ? 1 : 0);
          } else {
            writer.pair(72, 4);
            writer.pair(94, edge.degree);
            writer.pair(73, edge.rational ? 1 : 0);
            writer.pair(74, edge.periodic ? 1 : 0);
            writer.pair(95, edge.knots.length);
            writer.pair(96, edge.controlPoints.length);
            for (const knot of edge.knots) writer.pair(40, knot);
            edge.controlPoints.forEach((controlPoint, index) => {
              var _a3;
              point2(writer, 10, controlPoint);
              if (edge.rational) writer.pair(42, ((_a3 = edge.weights) == null ? void 0 : _a3[index]) ?? 1);
            });
            writer.pair(97, ((_a2 = edge.fitPoints) == null ? void 0 : _a2.length) ?? 0);
            for (const fitPoint of edge.fitPoints ?? []) point2(writer, 11, fitPoint);
          }
        }
        writer.pair(97, 0);
      }
      writer.pair(75, { normal: 0, outer: 1, ignore: 2 }[hatch.style]);
      writer.pair(76, 0);
      writer.pair(52, hatch.patternAngle);
      writer.pair(41, hatch.patternScale);
      writer.pair(77, hatch.double ? 1 : 0);
      writer.pair(78, hatch.patternLines.length);
      for (const line of hatch.patternLines) {
        writer.pair(53, line.angle);
        writer.pair(43, line.base[0]);
        writer.pair(44, line.base[1]);
        writer.pair(45, line.offset[0]);
        writer.pair(46, line.offset[1]);
        writer.pair(79, line.dashLengths.length);
        for (const dash of line.dashLengths) writer.pair(49, dash);
      }
      writer.pair(98, 0);
    }
    function entity(writer, type, layer) {
      writer.pair(0, type);
      writer.pair(8, layer);
    }
    function point(writer, xCode, value) {
      writer.pair(xCode, value[0]);
      writer.pair(xCode + 10, value[1]);
      writer.pair(xCode + 20, 0);
    }
    function point2(writer, xCode, value) {
      writer.pair(xCode, value[0]);
      writer.pair(xCode + 10, value[1]);
    }
    function writeLine(writer, start, end, layer, lineType) {
      entity(writer, "LINE", layer);
      if (lineType !== void 0) writer.pair(6, lineType);
      point(writer, 10, start);
      point(writer, 11, end);
    }
    function writePolyline(writer, points, closed, layer) {
      if (points.length === 0) return;
      entity(writer, "LWPOLYLINE", layer);
      writer.pair(90, points.length);
      writer.pair(70, 0);
      for (const value of points) {
        writer.pair(10, value[0]);
        writer.pair(20, value[1]);
      }
    }
    function writeText(writer, position, content, height, rotation, alignment, verticalAlignment) {
      entity(writer, "TEXT", ANNOTATION_LAYER);
      point(writer, 10, position);
      writer.pair(40, Math.max(height, Number.EPSILON));
      writer.pair(1, dxfText(content));
      writer.pair(50, rotation);
      writer.pair(72, { left: 0, center: 1, right: 2 }[alignment]);
      writer.pair(73, { baseline: 0, bottom: 1, middle: 2, top: 3 }[verticalAlignment]);
      if (alignment !== "left" || verticalAlignment !== "baseline") point(writer, 11, position);
    }
    function extendLine(start, end, extension) {
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const length = Math.hypot(dx, dy);
      if (!(length > 0) || !(extension > 0)) return [start, end];
      const extendX = dx / length * extension;
      const extendY = dy / length * extension;
      return [
        [start[0] - extendX, start[1] - extendY],
        [end[0] + extendX, end[1] + extendY]
      ];
    }
    function annotationTextHeight(node) {
      const points = node.definitionPoints;
      if (points.length < 2) return 2.5;
      return Math.max(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) * 0.05, 0.1);
    }
    function dimensionLabel$1(node) {
      const base = baseDimensionLabel(node);
      const tolerance = toleranceLabel(node);
      return tolerance === void 0 ? base : `${base} ${tolerance}`;
    }
    function baseDimensionLabel(node) {
      if (node.displayText !== void 0) return node.displayText;
      const value = node.observedValue ?? node.computedValue;
      if (value === void 0) return "—";
      return `${node.prefix ?? ""}${value}${node.unit ? ` ${node.unit}` : ""}${node.suffix ?? ""}`;
    }
    function toleranceLabel(node) {
      var _a2;
      const projection = node.toleranceProjection;
      if (projection && (projection.status === "resolved" || projection.status === "confirmed")) {
        switch (projection.mode) {
          case "bilateral":
            if (finite(projection.upperDeviation) && finite(projection.lowerDeviation)) {
              return `${signed(projection.upperDeviation)}/${signed(projection.lowerDeviation)}`;
            }
            return void 0;
          case "unilateral":
            if (finite(projection.upperDeviation) || finite(projection.lowerDeviation)) {
              return `${signed(projection.upperDeviation ?? 0)}/${signed(projection.lowerDeviation ?? 0)}`;
            }
            return void 0;
          case "limits":
            if (finite(projection.upperLimit) && finite(projection.lowerLimit) && projection.lowerLimit <= projection.upperLimit) {
              return `[${textNumber(projection.upperLimit)}/${textNumber(projection.lowerLimit)}]`;
            }
            return void 0;
          case "fit":
            return ((_a2 = projection.fitDesignation) == null ? void 0 : _a2.trim()) || void 0;
          case "none":
            return void 0;
        }
      }
      const legacy = node.tolerance;
      if (legacy && (finite(legacy.upper) || finite(legacy.lower))) {
        return `${signed(legacy.upper ?? 0)}/${signed(legacy.lower ?? 0)}`;
      }
      return void 0;
    }
    function finite(value) {
      return typeof value === "number" && Number.isFinite(value);
    }
    function signed(value) {
      if (Object.is(value, -0) || value === 0) return "0";
      return value > 0 ? `+${textNumber(value)}` : textNumber(value);
    }
    function textNumber(value) {
      return Object.is(value, -0) ? "0" : String(value);
    }
    function dxfText(value) {
      return [...value.replace(/\r\n|\r|\n/g, "\\P")].filter((character) => {
        const code = character.charCodeAt(0);
        return code === 9 || code >= 32 && code !== 127;
      }).join("");
    }
    function insertionUnit(unit) {
      return { mm: 4, cm: 5, m: 6 }[unit];
    }
    function normalizeDegrees(value) {
      return (value % 360 + 360) % 360;
    }
    function formatNumber(value) {
      if (!Number.isFinite(value)) throw new TypeError("DXF values must be finite numbers");
      return Object.is(value, -0) ? "0" : String(value);
    }
    const DrawingWorkspaceStoreContext = react.createContext(null);
    function DrawingWorkspaceProvider({
      store,
      autoLoad = true,
      children
    }) {
      react.useEffect(() => {
        if (autoLoad) void store.getState().load();
        return () => store.getState().destroy();
      }, [autoLoad, store]);
      return /* @__PURE__ */ jsxRuntime.jsx(DrawingWorkspaceStoreContext.Provider, { value: store, children });
    }
    function useDrawingWorkspaceStore() {
      const store = react.useContext(DrawingWorkspaceStoreContext);
      if (store === null) {
        throw new Error("Drawing workspace components require DrawingWorkspaceProvider");
      }
      return store;
    }
    function useDrawingWorkspace(selector) {
      const store = useDrawingWorkspaceStore();
      return react.useSyncExternalStore(
        store.subscribe,
        () => selector(store.getState()),
        () => selector(store.getState())
      );
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
    const TAU = Math.PI * 2;
    function flattenHatchEdge(edge, tolerance) {
      if (edge.type === "line") return [edge.start, edge.end];
      if (edge.type === "arc") {
        const orientation = edge.counterClockwise ? 1 : -1;
        return sampleAngularCurve(
          degrees(edge.startAngle),
          degrees(edge.endAngle),
          Math.abs(edge.radius),
          tolerance,
          (angle) => [
            edge.center[0] + Math.cos(angle) * edge.radius,
            edge.center[1] + Math.sin(angle) * edge.radius * orientation
          ]
        );
      }
      if (edge.type === "ellipse") {
        const majorLength = Math.hypot(...edge.majorAxis);
        const minorLength = majorLength * edge.axisRatio;
        const orientation = edge.counterClockwise ? 1 : -1;
        const ux = majorLength > 0 ? edge.majorAxis[0] / majorLength : 1;
        const uy = majorLength > 0 ? edge.majorAxis[1] / majorLength : 0;
        return sampleAngularCurve(
          edge.startParameter,
          edge.endParameter,
          Math.max(majorLength, minorLength),
          tolerance,
          (parameter) => [
            edge.center[0] + ux * majorLength * Math.cos(parameter) - uy * minorLength * Math.sin(parameter) * orientation,
            edge.center[1] + uy * majorLength * Math.cos(parameter) + ux * minorLength * Math.sin(parameter) * orientation
          ]
        );
      }
      return flattenSpline(edge, tolerance);
    }
    function sampleAngularCurve(start, end, radius, tolerance, pointAt) {
      const rawSweep = end - start;
      const sweep = (rawSweep % TAU + TAU) % TAU || TAU;
      const safeRadius = Math.max(radius, tolerance);
      const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / safeRadius)));
      const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(maxStep, Math.PI / 90)));
      return Array.from({ length: count + 1 }, (_, index) => pointAt(start + sweep * index / count));
    }
    function flattenSpline(edge, tolerance) {
      const domainStart = edge.knots[edge.degree] ?? 0;
      const domainEnd = edge.knots[edge.controlPoints.length] ?? 1;
      const first = splinePoint(edge, domainStart);
      const last = splinePoint(edge, domainEnd);
      const output = [first];
      subdivideSpline(edge, domainStart, domainEnd, first, last, tolerance, 0, output);
      return output;
    }
    function subdivideSpline(edge, start, end, a, b, tolerance, depth, output) {
      const middleParameter = (start + end) / 2;
      const middle = splinePoint(edge, middleParameter);
      const chordMiddle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (depth >= 16 || Math.hypot(middle[0] - chordMiddle[0], middle[1] - chordMiddle[1]) <= tolerance) {
        output.push(b);
        return;
      }
      subdivideSpline(edge, start, middleParameter, a, middle, tolerance, depth + 1, output);
      subdivideSpline(edge, middleParameter, end, middle, b, tolerance, depth + 1, output);
    }
    function splinePoint(edge, parameter) {
      var _a2, _b, _c;
      const degree = edge.degree;
      const count = edge.controlPoints.length;
      const basis = Array.from({ length: count }, (_, index) => basisValue(index, degree, parameter, edge.knots, parameter === edge.knots[count]));
      let x = 0;
      let y = 0;
      let denominator = 0;
      for (let index = 0; index < count; index += 1) {
        const weight = ((_a2 = edge.weights) == null ? void 0 : _a2[index]) ?? 1;
        const weightedBasis = (basis[index] ?? 0) * weight;
        x += (((_b = edge.controlPoints[index]) == null ? void 0 : _b[0]) ?? 0) * weightedBasis;
        y += (((_c = edge.controlPoints[index]) == null ? void 0 : _c[1]) ?? 0) * weightedBasis;
        denominator += weightedBasis;
      }
      return denominator === 0 ? edge.controlPoints[0] ?? [0, 0] : [x / denominator, y / denominator];
    }
    function basisValue(index, degree, parameter, knots, atEnd) {
      if (degree === 0) {
        if (atEnd && parameter === knots[index + 1] && parameter === knots[knots.length - 1]) return 1;
        return knots[index] <= parameter && parameter < knots[index + 1] ? 1 : 0;
      }
      const leftDenominator = knots[index + degree] - knots[index];
      const rightDenominator = knots[index + degree + 1] - knots[index + 1];
      const left = leftDenominator === 0 ? 0 : (parameter - knots[index]) / leftDenominator * basisValue(index, degree - 1, parameter, knots, atEnd);
      const right = rightDenominator === 0 ? 0 : (knots[index + degree + 1] - parameter) / rightDenominator * basisValue(index + 1, degree - 1, parameter, knots, atEnd);
      return left + right;
    }
    function degrees(value) {
      return value * Math.PI / 180;
    }
    var ClipType;
    (function(ClipType2) {
      ClipType2[ClipType2["NoClip"] = 0] = "NoClip";
      ClipType2[ClipType2["Intersection"] = 1] = "Intersection";
      ClipType2[ClipType2["Union"] = 2] = "Union";
      ClipType2[ClipType2["Difference"] = 3] = "Difference";
      ClipType2[ClipType2["Xor"] = 4] = "Xor";
    })(ClipType || (ClipType = {}));
    var PathType;
    (function(PathType2) {
      PathType2[PathType2["Subject"] = 0] = "Subject";
      PathType2[PathType2["Clip"] = 1] = "Clip";
    })(PathType || (PathType = {}));
    var FillRule;
    (function(FillRule2) {
      FillRule2[FillRule2["EvenOdd"] = 0] = "EvenOdd";
      FillRule2[FillRule2["NonZero"] = 1] = "NonZero";
      FillRule2[FillRule2["Positive"] = 2] = "Positive";
      FillRule2[FillRule2["Negative"] = 3] = "Negative";
    })(FillRule || (FillRule = {}));
    var PointInPolygonResult;
    (function(PointInPolygonResult2) {
      PointInPolygonResult2[PointInPolygonResult2["IsOn"] = 0] = "IsOn";
      PointInPolygonResult2[PointInPolygonResult2["IsInside"] = 1] = "IsInside";
      PointInPolygonResult2[PointInPolygonResult2["IsOutside"] = 2] = "IsOutside";
    })(PointInPolygonResult || (PointInPolygonResult = {}));
    const maxSafeInteger = Number.MAX_SAFE_INTEGER;
    const maxDeltaForSafeProduct = Math.floor(Math.sqrt(maxSafeInteger));
    function isSafeProduct(a, b) {
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b))
        return false;
      if (a === 0 || b === 0)
        return true;
      return Math.abs(a) <= maxSafeInteger / Math.abs(b);
    }
    function isSafeSum(a, b) {
      return Math.abs(a) + Math.abs(b) <= maxSafeInteger;
    }
    function safeMultiplyDifference(a, b, c, d) {
      if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
        const prod1 = a * b;
        const prod2 = c * d;
        if (isSafeSum(prod1, prod2)) {
          return prod1 - prod2;
        }
      }
      if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
        return Number(BigInt(a) * BigInt(b) - BigInt(c) * BigInt(d));
      }
      return a * b - c * d;
    }
    function safeMultiplySum(a, b, c, d) {
      if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
        const prod1 = a * b;
        const prod2 = c * d;
        if (isSafeSum(prod1, prod2)) {
          return prod1 + prod2;
        }
      }
      if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
        return Number(BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d));
      }
      return a * b + c * d;
    }
    const B0$1 = BigInt(0);
    const B2$1 = BigInt(2);
    const B4$1 = BigInt(4);
    const B64 = BigInt(64);
    const UINT64_MASK = BigInt("0xFFFFFFFFFFFFFFFF");
    const IC_MaxInt64 = BigInt("9223372036854775807");
    const IC_MaxCoord = Number(IC_MaxInt64 / B4$1);
    const IC_Invalid64 = Number(IC_MaxInt64);
    const IC_floatingPointTolerance = 1e-12;
    const IC_defaultMinimumEdgeLength = 0.1;
    const IC_maxCoordForSafeAreaProduct = Math.floor(maxDeltaForSafeProduct / 2);
    const IC_maxCoordForSafeCrossSq = Math.floor(Math.sqrt(Math.sqrt(maxSafeInteger / 4)));
    function maxSafeCoordinateForScale(scale2) {
      if (!Number.isFinite(scale2)) {
        throw new RangeError("Scale must be a finite number");
      }
      const absScale = Math.abs(scale2);
      if (absScale === 0)
        return Number.POSITIVE_INFINITY;
      return maxSafeInteger / absScale;
    }
    function checkSafeScaleValue(value, maxAbs, context) {
      if (!Number.isFinite(value) || Math.abs(value) > maxAbs) {
        throw new RangeError(`Scaled coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
      }
    }
    function ensureSafeInteger(value, context) {
      if (!Number.isFinite(value) || Math.abs(value) > maxSafeInteger) {
        throw new RangeError(`Coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
      }
    }
    function crossProduct(pt1, pt2, pt3) {
      const a = pt2.x - pt1.x;
      const b = pt3.y - pt2.y;
      const c = pt2.y - pt1.y;
      const d = pt3.x - pt2.x;
      if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
        return a * b - c * d;
      }
      return safeMultiplyDifference(a, b, c, d);
    }
    function crossProductSign(pt1, pt2, pt3) {
      const a = pt2.x - pt1.x;
      const b = pt3.y - pt2.y;
      const c = pt2.y - pt1.y;
      const d = pt3.x - pt2.x;
      if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
        const prod1 = a * b;
        const prod2 = c * d;
        return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
      }
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
        const prod1 = a * b;
        const prod2 = c * d;
        return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
      }
      const bigProd1 = BigInt(a) * BigInt(b);
      const bigProd2 = BigInt(c) * BigInt(d);
      if (bigProd1 === bigProd2)
        return 0;
      return bigProd1 > bigProd2 ? 1 : -1;
    }
    function checkPrecision(precision) {
      if (precision < -8 || precision > 8) {
        throw new Error("Error: Precision is out of range.");
      }
    }
    function isAlmostZero(value) {
      return Math.abs(value) <= IC_floatingPointTolerance;
    }
    function triSign(x) {
      return x < 0 ? -1 : x > 0 ? 1 : 0;
    }
    function multiplyUInt64(a, b) {
      const aBig = BigInt(a);
      const bBig = BigInt(b);
      const res = aBig * bBig;
      return {
        lo64: res & UINT64_MASK,
        hi64: res >> B64
      };
    }
    function productsAreEqual(a, b, c, d) {
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      const absC = Math.abs(c);
      const absD = Math.abs(d);
      if (absA < maxDeltaForSafeProduct && absB < maxDeltaForSafeProduct && absC < maxDeltaForSafeProduct && absD < maxDeltaForSafeProduct) {
        return a * b === c * d;
      }
      const signAb = (a < 0 ? -1 : a > 0 ? 1 : 0) * (b < 0 ? -1 : b > 0 ? 1 : 0);
      const signCd = (c < 0 ? -1 : c > 0 ? 1 : 0) * (d < 0 ? -1 : d > 0 ? 1 : 0);
      if (signAb !== signCd)
        return false;
      if (signAb === 0)
        return true;
      if (!Number.isSafeInteger(absA) || !Number.isSafeInteger(absB) || !Number.isSafeInteger(absC) || !Number.isSafeInteger(absD)) {
        return a * b === c * d;
      }
      const bigA = BigInt(absA);
      const bigB = BigInt(absB);
      const bigC = BigInt(absC);
      const bigD = BigInt(absD);
      return bigA * bigB === bigC * bigD;
    }
    function isCollinear(pt1, sharedPt, pt2) {
      const a = sharedPt.x - pt1.x;
      const b = pt2.y - sharedPt.y;
      const c = sharedPt.y - pt1.y;
      const d = pt2.x - sharedPt.x;
      return productsAreEqual(a, b, c, d);
    }
    function dotProduct(pt1, pt2, pt3) {
      const a = pt2.x - pt1.x;
      const b = pt3.x - pt2.x;
      const c = pt2.y - pt1.y;
      const d = pt3.y - pt2.y;
      if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
        return a * b + c * d;
      }
      return safeMultiplySum(a, b, c, d);
    }
    function dotProductSign(pt1, pt2, pt3) {
      const a = pt2.x - pt1.x;
      const b = pt3.x - pt2.x;
      const c = pt2.y - pt1.y;
      const d = pt3.y - pt2.y;
      if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
        const sum = a * b + c * d;
        return sum > 0 ? 1 : sum < 0 ? -1 : 0;
      }
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
        const sum = a * b + c * d;
        return sum > 0 ? 1 : sum < 0 ? -1 : 0;
      }
      const bigSum = BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d);
      if (bigSum === B0$1)
        return 0;
      return bigSum > B0$1 ? 1 : -1;
    }
    function icArea(path) {
      const cnt = path.length;
      if (cnt < 3)
        return 0;
      let allSmall = true;
      for (let i = 0; i < cnt && allSmall; i++) {
        const pt = path[i];
        if (Math.abs(pt.x) >= IC_maxCoordForSafeAreaProduct || Math.abs(pt.y) >= IC_maxCoordForSafeAreaProduct) {
          allSmall = false;
        }
      }
      let prevPt = path[cnt - 1];
      if (allSmall) {
        let total = 0;
        for (const pt of path) {
          total += (prevPt.y + pt.y) * (prevPt.x - pt.x);
          prevPt = pt;
        }
        return total * 0.5;
      }
      let totalBig = B0$1;
      for (const pt of path) {
        const sum = prevPt.y + pt.y;
        const diff = prevPt.x - pt.x;
        if (Number.isSafeInteger(sum) && Number.isSafeInteger(diff)) {
          totalBig += BigInt(sum) * BigInt(diff);
        } else if (Number.isSafeInteger(prevPt.y) && Number.isSafeInteger(pt.y) && Number.isSafeInteger(prevPt.x) && Number.isSafeInteger(pt.x)) {
          const sumBig = BigInt(prevPt.y) + BigInt(pt.y);
          const diffBig = BigInt(prevPt.x) - BigInt(pt.x);
          totalBig += sumBig * diffBig;
        } else {
          totalBig += BigInt(Math.round(sum * diff));
        }
        prevPt = pt;
      }
      return Number(totalBig) * 0.5;
    }
    function crossProductD(vec1, vec2) {
      return vec1.y * vec2.x - vec2.y * vec1.x;
    }
    function dotProductD(vec1, vec2) {
      return vec1.x * vec2.x + vec1.y * vec2.y;
    }
    function roundToEven(value) {
      const r = Math.round(value);
      if (value === r - 0.5 && (r & 1) !== 0)
        return r - 1;
      return r;
    }
    function checkCastInt64(val) {
      if (val >= IC_MaxCoord || val <= -IC_MaxCoord)
        return IC_Invalid64;
      return Math.round(val);
    }
    function getLineIntersectPt(ln1a, ln1b, ln2a, ln2b) {
      const dy1 = ln1b.y - ln1a.y;
      const dx1 = ln1b.x - ln1a.x;
      const dy2 = ln2b.y - ln2a.y;
      const dx2 = ln2b.x - ln2a.x;
      const det = safeMultiplyDifference(dy1, dx2, dy2, dx1);
      if (det === 0) {
        return null;
      }
      const t = safeMultiplyDifference(ln1a.x - ln2a.x, dy2, ln1a.y - ln2a.y, dx2) / det;
      if (t <= 0) {
        return { x: ln1a.x, y: ln1a.y, z: ln1a.z || 0 };
      } else if (t >= 1) {
        return { x: ln1b.x, y: ln1b.y, z: ln1b.z || 0 };
      } else {
        return {
          x: Math.trunc(ln1a.x + t * dx1),
          y: Math.trunc(ln1a.y + t * dy1),
          z: 0
        };
      }
    }
    function getLineIntersectPtD(ln1a, ln1b, ln2a, ln2b) {
      const dy1 = ln1b.y - ln1a.y;
      const dx1 = ln1b.x - ln1a.x;
      const dy2 = ln2b.y - ln2a.y;
      const dx2 = ln2b.x - ln2a.x;
      const det = dy1 * dx2 - dy2 * dx1;
      if (det === 0) {
        return { success: false, ip: { x: 0, y: 0, z: 0 } };
      }
      const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
      let ip;
      if (t <= 0) {
        ip = { ...ln1a, z: 0 };
      } else if (t >= 1) {
        ip = { ...ln1b, z: 0 };
      } else {
        ip = {
          x: ln1a.x + t * dx1,
          y: ln1a.y + t * dy1,
          z: 0
        };
      }
      return { success: true, ip };
    }
    function segsIntersect(seg1a, seg1b, seg2a, seg2b, inclusive = false) {
      if (!inclusive) {
        const s1 = crossProductSign(seg1a, seg2a, seg2b);
        const s2 = crossProductSign(seg1b, seg2a, seg2b);
        const s3 = crossProductSign(seg2a, seg1a, seg1b);
        const s4 = crossProductSign(seg2b, seg1a, seg1b);
        return s1 !== 0 && s2 !== 0 && s1 !== s2 && (s3 !== 0 && s4 !== 0 && s3 !== s4);
      }
      const res1 = crossProductSign(seg1a, seg2a, seg2b);
      const res2 = crossProductSign(seg1b, seg2a, seg2b);
      if (res1 !== 0 && res1 === res2)
        return false;
      const res3 = crossProductSign(seg2a, seg1a, seg1b);
      const res4 = crossProductSign(seg2b, seg1a, seg1b);
      if (res3 !== 0 && res3 === res4)
        return false;
      return res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0;
    }
    function icGetBounds(path) {
      if (path.length === 0)
        return { left: 0, top: 0, right: 0, bottom: 0 };
      const result = {
        left: Number.MAX_SAFE_INTEGER,
        top: Number.MAX_SAFE_INTEGER,
        right: Number.MIN_SAFE_INTEGER,
        bottom: Number.MIN_SAFE_INTEGER
      };
      for (const pt of path) {
        if (pt.x < result.left)
          result.left = pt.x;
        if (pt.x > result.right)
          result.right = pt.x;
        if (pt.y < result.top)
          result.top = pt.y;
        if (pt.y > result.bottom)
          result.bottom = pt.y;
      }
      return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, top: 0, right: 0, bottom: 0 } : result;
    }
    function getClosestPtOnSegment(offPt, seg1, seg2) {
      if (seg1.x === seg2.x && seg1.y === seg2.y)
        return { x: seg1.x, y: seg1.y, z: 0 };
      const dx = seg2.x - seg1.x;
      const dy = seg2.y - seg1.y;
      const q = safeMultiplySum(offPt.x - seg1.x, dx, offPt.y - seg1.y, dy) / safeMultiplySum(dx, dx, dy, dy);
      const qClamped = q < 0 ? 0 : q > 1 ? 1 : q;
      return {
        // use Math.round to match the C# MidpointRounding.ToEven behavior
        x: Math.round(seg1.x + qClamped * dx),
        y: Math.round(seg1.y + qClamped * dy),
        z: 0
      };
    }
    function icPointInPolygon(pt, polygon) {
      const len = polygon.length;
      let start = 0;
      if (len < 3)
        return PointInPolygonResult.IsOutside;
      while (start < len && polygon[start].y === pt.y)
        start++;
      if (start === len)
        return PointInPolygonResult.IsOutside;
      let isAbove = polygon[start].y < pt.y;
      const startingAbove = isAbove;
      let val = 0;
      let i = start + 1;
      let end = len;
      while (true) {
        if (i === end) {
          if (end === 0 || start === 0)
            break;
          end = start;
          i = 0;
        }
        if (isAbove) {
          while (i < end && polygon[i].y < pt.y)
            i++;
        } else {
          while (i < end && polygon[i].y > pt.y)
            i++;
        }
        if (i === end)
          continue;
        const curr = polygon[i];
        const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];
        if (curr.y === pt.y) {
          if (curr.x === pt.x || curr.y === prev.y && pt.x < prev.x !== pt.x < curr.x) {
            return PointInPolygonResult.IsOn;
          }
          i++;
          if (i === start)
            break;
          continue;
        }
        if (pt.x < curr.x && pt.x < prev.x) ;
        else if (pt.x > prev.x && pt.x > curr.x) {
          val = 1 - val;
        } else {
          const cps2 = crossProductSign(prev, curr, pt);
          if (cps2 === 0)
            return PointInPolygonResult.IsOn;
          if (cps2 < 0 === isAbove)
            val = 1 - val;
        }
        isAbove = !isAbove;
        i++;
      }
      if (isAbove === startingAbove) {
        return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
      }
      if (i === len)
        i = 0;
      const cps = i === 0 ? crossProductSign(polygon[len - 1], polygon[0], pt) : crossProductSign(polygon[i - 1], polygon[i], pt);
      if (cps === 0)
        return PointInPolygonResult.IsOn;
      if (cps < 0 === isAbove)
        val = 1 - val;
      return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
    }
    function path2ContainsPath1(path1, path2) {
      let pip = PointInPolygonResult.IsOn;
      for (const pt of path1) {
        switch (icPointInPolygon(pt, path2)) {
          case PointInPolygonResult.IsOutside:
            if (pip === PointInPolygonResult.IsOutside)
              return false;
            pip = PointInPolygonResult.IsOutside;
            break;
          case PointInPolygonResult.IsInside:
            if (pip === PointInPolygonResult.IsInside)
              return true;
            pip = PointInPolygonResult.IsInside;
            break;
        }
      }
      const mp = icGetBounds(path1);
      let midX, midY;
      if (Number.isSafeInteger(mp.left) && Number.isSafeInteger(mp.right) && Math.abs(mp.left) + Math.abs(mp.right) > Number.MAX_SAFE_INTEGER) {
        midX = Number((BigInt(mp.left) + BigInt(mp.right)) / B2$1);
        midY = Number((BigInt(mp.top) + BigInt(mp.bottom)) / B2$1);
      } else {
        midX = Math.round((mp.left + mp.right) / 2);
        midY = Math.round((mp.top + mp.bottom) / 2);
      }
      const midPt = { x: midX, y: midY };
      return icPointInPolygon(midPt, path2) !== PointInPolygonResult.IsOutside;
    }
    const InternalClipper = {
      MaxInt64: IC_MaxInt64,
      MaxCoord: IC_MaxCoord,
      max_coord: IC_MaxCoord,
      min_coord: -IC_MaxCoord,
      Invalid64: IC_Invalid64,
      floatingPointTolerance: IC_floatingPointTolerance,
      defaultMinimumEdgeLength: IC_defaultMinimumEdgeLength,
      maxCoordForSafeAreaProduct: IC_maxCoordForSafeAreaProduct,
      maxCoordForSafeCrossSq: IC_maxCoordForSafeCrossSq,
      maxSafeCoordinateForScale,
      checkSafeScaleValue,
      ensureSafeInteger,
      crossProduct,
      crossProductSign,
      checkPrecision,
      isAlmostZero,
      triSign,
      multiplyUInt64,
      productsAreEqual,
      isCollinear,
      dotProduct,
      dotProductSign,
      area: icArea,
      crossProductD,
      dotProductD,
      roundToEven,
      checkCastInt64,
      getLineIntersectPt,
      getLineIntersectPtD,
      segsIntersect,
      getBounds: icGetBounds,
      getClosestPtOnSegment,
      pointInPolygon: icPointInPolygon,
      path2ContainsPath1
    };
    const Rect64Utils = {
      create(l = 0, t = 0, r = 0, b = 0) {
        return { left: l, top: t, right: r, bottom: b };
      },
      createInvalid() {
        return {
          left: Number.MAX_SAFE_INTEGER,
          top: Number.MAX_SAFE_INTEGER,
          right: Number.MIN_SAFE_INTEGER,
          bottom: Number.MIN_SAFE_INTEGER
        };
      },
      width(rect) {
        return rect.right - rect.left;
      },
      height(rect) {
        return rect.bottom - rect.top;
      },
      isEmpty(rect) {
        return rect.bottom <= rect.top || rect.right <= rect.left;
      },
      isValid(rect) {
        return rect.left < Number.MAX_SAFE_INTEGER;
      },
      midPoint(rect) {
        if (Number.isSafeInteger(rect.left) && Number.isSafeInteger(rect.right) && Math.abs(rect.left) + Math.abs(rect.right) > Number.MAX_SAFE_INTEGER) {
          const midX = Number((BigInt(rect.left) + BigInt(rect.right)) / B2$1);
          const midY = Number((BigInt(rect.top) + BigInt(rect.bottom)) / B2$1);
          return { x: midX, y: midY };
        }
        return {
          x: Math.round((rect.left + rect.right) / 2),
          y: Math.round((rect.top + rect.bottom) / 2)
        };
      },
      contains(rect, pt) {
        return pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom;
      },
      containsRect(rect, rec) {
        return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
      },
      intersects(rect, rec) {
        return Math.max(rect.left, rec.left) <= Math.min(rect.right, rec.right) && Math.max(rect.top, rec.top) <= Math.min(rect.bottom, rec.bottom);
      },
      asPath(rect) {
        return [
          { x: rect.left, y: rect.top, z: 0 },
          { x: rect.right, y: rect.top, z: 0 },
          { x: rect.right, y: rect.bottom, z: 0 },
          { x: rect.left, y: rect.bottom, z: 0 }
        ];
      }
    };
    const B0 = BigInt(0);
    const B2 = BigInt(2);
    const B4 = BigInt(4);
    var VertexFlags;
    (function(VertexFlags2) {
      VertexFlags2[VertexFlags2["None"] = 0] = "None";
      VertexFlags2[VertexFlags2["OpenStart"] = 1] = "OpenStart";
      VertexFlags2[VertexFlags2["OpenEnd"] = 2] = "OpenEnd";
      VertexFlags2[VertexFlags2["LocalMax"] = 4] = "LocalMax";
      VertexFlags2[VertexFlags2["LocalMin"] = 8] = "LocalMin";
    })(VertexFlags || (VertexFlags = {}));
    class ScanlineHeap {
      constructor() {
        __publicField(this, "data", []);
      }
      push(value) {
        this.data.push(value);
        this.siftUp(this.data.length - 1);
      }
      pop() {
        if (this.data.length === 0)
          return null;
        const max = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
          this.data[0] = last;
          this.siftDown(0);
        }
        return max;
      }
      clear() {
        this.data.length = 0;
      }
      // Hole-sift: lift the value once, shift parents/children, then place.
      // Avoids temporary array allocation from destructuring swap on every step.
      siftUp(index) {
        const val = this.data[index];
        while (index > 0) {
          const parent = index - 1 >> 1;
          if (this.data[parent] >= val)
            break;
          this.data[index] = this.data[parent];
          index = parent;
        }
        this.data[index] = val;
      }
      siftDown(index) {
        const length = this.data.length;
        const val = this.data[index];
        while (true) {
          const left = (index << 1) + 1;
          if (left >= length)
            break;
          const right = left + 1;
          let child = left;
          if (right < length && this.data[right] > this.data[left])
            child = right;
          if (this.data[child] <= val)
            break;
          this.data[index] = this.data[child];
          index = child;
        }
        this.data[index] = val;
      }
    }
    class Vertex {
      constructor(pt, flags, prev) {
        __publicField(this, "pt");
        __publicField(this, "next", null);
        __publicField(this, "prev", null);
        __publicField(this, "flags");
        this.pt = pt;
        this.flags = flags;
        this.prev = prev;
      }
    }
    class LocalMinima {
      constructor(vertex, polytype, isOpen = false) {
        __publicField(this, "vertex");
        __publicField(this, "polytype");
        __publicField(this, "isOpen");
        this.vertex = vertex;
        this.polytype = polytype;
        this.isOpen = isOpen;
      }
      equals(other) {
        return other !== null && this.vertex === other.vertex;
      }
    }
    function createIntersectNode(pt, edge1, edge2) {
      return { pt, edge1, edge2 };
    }
    class OutPt {
      constructor(pt, outrec) {
        __publicField(this, "pt");
        __publicField(this, "next");
        __publicField(this, "prev");
        __publicField(this, "outrec");
        __publicField(this, "horz");
        this.pt = pt;
        this.outrec = outrec;
        this.next = this;
        this.prev = this;
        this.horz = null;
      }
    }
    var JoinWith;
    (function(JoinWith2) {
      JoinWith2[JoinWith2["None"] = 0] = "None";
      JoinWith2[JoinWith2["Left"] = 1] = "Left";
      JoinWith2[JoinWith2["Right"] = 2] = "Right";
    })(JoinWith || (JoinWith = {}));
    var HorzPosition;
    (function(HorzPosition2) {
      HorzPosition2[HorzPosition2["Bottom"] = 0] = "Bottom";
      HorzPosition2[HorzPosition2["Middle"] = 1] = "Middle";
      HorzPosition2[HorzPosition2["Top"] = 2] = "Top";
    })(HorzPosition || (HorzPosition = {}));
    class OutRec {
      constructor() {
        __publicField(this, "idx", 0);
        __publicField(this, "owner", null);
        __publicField(this, "frontEdge", null);
        __publicField(this, "backEdge", null);
        __publicField(this, "pts", null);
        __publicField(this, "polypath", null);
        __publicField(this, "bounds", { left: 0, top: 0, right: 0, bottom: 0 });
        __publicField(this, "path", []);
        __publicField(this, "isOpen", false);
        __publicField(this, "splits", null);
        __publicField(this, "recursiveSplit", null);
      }
    }
    class HorzSegment {
      constructor(op) {
        __publicField(this, "leftOp");
        __publicField(this, "rightOp");
        __publicField(this, "leftToRight");
        this.leftOp = op;
        this.rightOp = null;
        this.leftToRight = true;
      }
    }
    class HorzJoin {
      constructor(ltor, rtol) {
        __publicField(this, "op1");
        __publicField(this, "op2");
        this.op1 = ltor;
        this.op2 = rtol;
      }
    }
    function compareHorzSegments(hs1, hs2) {
      if (hs1.rightOp === null) {
        return hs2.rightOp === null ? 0 : 1;
      }
      if (hs2.rightOp === null)
        return -1;
      return hs1.leftOp.pt.x - hs2.leftOp.pt.x;
    }
    function compareIntersectNodes(a, b) {
      if (a.pt.y !== b.pt.y)
        return a.pt.y > b.pt.y ? -1 : 1;
      if (a.pt.x !== b.pt.x)
        return a.pt.x < b.pt.x ? -1 : 1;
      if (a.edge1.curX !== b.edge1.curX)
        return a.edge1.curX < b.edge1.curX ? -1 : 1;
      return a.edge2.curX < b.edge2.curX ? -1 : a.edge2.curX > b.edge2.curX ? 1 : 0;
    }
    class Active {
      constructor() {
        __publicField(this, "bot", { x: 0, y: 0 });
        __publicField(this, "top", { x: 0, y: 0 });
        __publicField(this, "curX", 0);
        // current (updated at every new scanline) - keep as number but ensure integer precision
        __publicField(this, "dx", 0);
        __publicField(this, "windDx", 0);
        // 1 or -1 depending on winding direction
        __publicField(this, "windCount", 0);
        __publicField(this, "windCount2", 0);
        // winding count of the opposite polytype
        __publicField(this, "outrec", null);
        // AEL: 'active edge list' (Vatti's AET - active edge table)
        //     a linked list of all edges (from left to right) that are present
        //     (or 'active') within the current scanbeam (a horizontal 'beam' that
        //     sweeps from bottom to top over the paths in the clipping operation).
        __publicField(this, "prevInAEL", null);
        __publicField(this, "nextInAEL", null);
        // SEL: 'sorted edge list' (Vatti's ST - sorted table)
        //     linked list used when sorting edges into their new positions at the
        //     top of scanbeams, but also (re)used to process horizontals.
        __publicField(this, "prevInSEL", null);
        __publicField(this, "nextInSEL", null);
        __publicField(this, "jump", null);
        __publicField(this, "vertexTop", null);
        __publicField(this, "localMin", null);
        // the bottom of an edge 'bound' (also Vatti)
        __publicField(this, "isLeftBound", false);
        __publicField(this, "joinWith", JoinWith.None);
      }
    }
    const ClipperEngine = {
      addLocMin(vert, polytype, isOpen, minimaList) {
        if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None)
          return;
        vert.flags |= VertexFlags.LocalMin;
        const lm = new LocalMinima(vert, polytype, isOpen);
        minimaList.push(lm);
      },
      addPathsToVertexList(paths, polytype, isOpen, minimaList, vertexList) {
        for (let i = 0, len = paths.length; i < len; i++) {
          const path = paths[i];
          let v0 = null;
          let prevV = null;
          let prevPt = null;
          for (let j = 0, len2 = path.length; j < len2; j++) {
            const pt = path[j];
            if (v0 === null) {
              v0 = new Vertex(pt, VertexFlags.None, null);
              vertexList.push(v0);
              prevV = v0;
              prevPt = pt;
            } else if (!(prevPt.x === pt.x && prevPt.y === pt.y)) {
              const currV2 = new Vertex(pt, VertexFlags.None, prevV);
              prevV.next = currV2;
              prevV = currV2;
              prevPt = pt;
            }
          }
          if ((prevV == null ? void 0 : prevV.prev) == null)
            continue;
          if (!isOpen && prevV.pt.x === v0.pt.x && prevV.pt.y === v0.pt.y)
            prevV = prevV.prev;
          prevV.next = v0;
          v0.prev = prevV;
          if (!isOpen && prevV.next === prevV)
            continue;
          let goingUp;
          if (isOpen) {
            let currV2 = v0.next;
            while (currV2 !== v0 && currV2.pt.y === v0.pt.y)
              currV2 = currV2.next;
            goingUp = currV2.pt.y <= v0.pt.y;
            if (goingUp) {
              v0.flags = VertexFlags.OpenStart;
              ClipperEngine.addLocMin(v0, polytype, true, minimaList);
            } else {
              v0.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
            }
          } else {
            prevV = v0.prev;
            while (prevV !== v0 && prevV.pt.y === v0.pt.y)
              prevV = prevV.prev;
            if (prevV === v0)
              continue;
            goingUp = prevV.pt.y > v0.pt.y;
          }
          const goingUp0 = goingUp;
          prevV = v0;
          let currV = v0.next;
          while (currV !== v0) {
            if (currV.pt.y > prevV.pt.y && goingUp) {
              prevV.flags |= VertexFlags.LocalMax;
              goingUp = false;
            } else if (currV.pt.y < prevV.pt.y && !goingUp) {
              goingUp = true;
              ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
            }
            prevV = currV;
            currV = currV.next;
          }
          if (isOpen) {
            prevV.flags |= VertexFlags.OpenEnd;
            if (goingUp)
              prevV.flags |= VertexFlags.LocalMax;
            else
              ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
          } else if (goingUp !== goingUp0) {
            if (goingUp0)
              ClipperEngine.addLocMin(prevV, polytype, false, minimaList);
            else
              prevV.flags |= VertexFlags.LocalMax;
          }
        }
      }
    };
    const _ClipperBase = class _ClipperBase {
      constructor() {
        __publicField(this, "cliptype", ClipType.NoClip);
        __publicField(this, "fillrule", FillRule.EvenOdd);
        __publicField(this, "actives", null);
        __publicField(this, "sel", null);
        __publicField(this, "minimaList", []);
        __publicField(this, "intersectList", []);
        __publicField(this, "vertexList", []);
        __publicField(this, "outrecList", []);
        __publicField(this, "scanlineHeap", new ScanlineHeap());
        __publicField(this, "scanlineSet", /* @__PURE__ */ new Set());
        // For very small inputs, a heap + set can cost more than it saves.
        // Use an array-based scanline mode initially, and upgrade to heap+set
        // automatically if the scanline list grows beyond a threshold.
        __publicField(this, "scanlineArr", []);
        __publicField(this, "useScanlineArray", false);
        __publicField(this, "horzSegList", []);
        __publicField(this, "horzJoinList", []);
        __publicField(this, "currentLocMin", 0);
        __publicField(this, "currentBotY", 0);
        // True when every active edge's curX already equals topX(edge, topY) for the
        // scanbeam top being processed (set by buildIntersectList when the SEL scan
        // finds no inversions, i.e. no intersections; consumed by doTopOfScanbeam).
        __publicField(this, "curXValidAtTop", false);
        __publicField(this, "isSortedMinimaList", false);
        __publicField(this, "hasOpenPaths", false);
        __publicField(this, "usingPolytree", false);
        __publicField(this, "succeeded", false);
        // Cache Z callback for the duration of an execute to avoid repeated virtual calls
        // to getZCallback() in hot paths.
        __publicField(this, "zCallbackInternal");
        __publicField(this, "preserveCollinear", true);
        __publicField(this, "reverseSolution", false);
      }
      // Z-coordinate callback support
      // Override in subclasses (Clipper64/ClipperD) to provide callback
      getZCallback() {
        return void 0;
      }
      xyEqual(pt1, pt2) {
        return pt1.x === pt2.x && pt1.y === pt2.y;
      }
      setZ(ae1, ae2, intersectPt) {
        const zCallback = this.zCallbackInternal;
        if (!zCallback)
          return;
        if (_ClipperBase.getPolyType(ae1) === PathType.Subject) {
          if (this.xyEqual(intersectPt, ae1.bot)) {
            intersectPt.z = ae1.bot.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae1.top)) {
            intersectPt.z = ae1.top.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae2.bot)) {
            intersectPt.z = ae2.bot.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae2.top)) {
            intersectPt.z = ae2.top.z ?? 0;
          } else {
            intersectPt.z = 0;
          }
          zCallback(ae1.bot, ae1.top, ae2.bot, ae2.top, intersectPt);
        } else {
          if (this.xyEqual(intersectPt, ae2.bot)) {
            intersectPt.z = ae2.bot.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae2.top)) {
            intersectPt.z = ae2.top.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae1.bot)) {
            intersectPt.z = ae1.bot.z ?? 0;
          } else if (this.xyEqual(intersectPt, ae1.top)) {
            intersectPt.z = ae1.top.z ?? 0;
          } else {
            intersectPt.z = 0;
          }
          zCallback(ae2.bot, ae2.top, ae1.bot, ae1.top, intersectPt);
        }
      }
      // Helper functions
      static isOdd(val) {
        return (val & 1) !== 0;
      }
      static isHotEdge(ae) {
        return ae.outrec != null;
      }
      static isOpen(ae) {
        return _ClipperBase.openPathsEnabled && ae.localMin.isOpen;
      }
      static isOpenEnd(ae) {
        return _ClipperBase.openPathsEnabled && ae.localMin.isOpen && _ClipperBase.isOpenEndVertex(ae.vertexTop);
      }
      static isOpenEndVertex(v) {
        return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
      }
      static getPrevHotEdge(ae) {
        let prev = ae.prevInAEL;
        if (!_ClipperBase.openPathsEnabled) {
          while (prev !== null && !_ClipperBase.isHotEdge(prev)) {
            prev = prev.prevInAEL;
          }
          return prev;
        }
        while (prev !== null && (prev.localMin.isOpen || !_ClipperBase.isHotEdge(prev))) {
          prev = prev.prevInAEL;
        }
        return prev;
      }
      static isFront(ae) {
        return ae === ae.outrec.frontEdge;
      }
      /*******************************************************************************
      *  Dx:                             0(90deg)                                    *
      *                                  |                                           *
      *               +inf (180deg) <--- o ---> -inf (0deg)                          *
      *******************************************************************************/
      static getDx(pt1, pt2) {
        const dy = pt2.y - pt1.y;
        if (dy !== 0) {
          return (pt2.x - pt1.x) / dy;
        }
        return pt2.x > pt1.x ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      }
      static topX(ae, currentY) {
        if (currentY === ae.top.y || ae.top.x === ae.bot.x)
          return ae.top.x;
        if (currentY === ae.bot.y)
          return ae.bot.x;
        return InternalClipper.roundToEven(ae.bot.x + ae.dx * (currentY - ae.bot.y));
      }
      static isHorizontal(ae) {
        return ae.dx === Number.NEGATIVE_INFINITY || ae.dx === Number.POSITIVE_INFINITY;
      }
      static isHeadingRightHorz(ae) {
        return ae.dx === Number.NEGATIVE_INFINITY;
      }
      static isHeadingLeftHorz(ae) {
        return ae.dx === Number.POSITIVE_INFINITY;
      }
      static getPolyType(ae) {
        return ae.localMin.polytype;
      }
      static isSamePolyType(ae1, ae2) {
        return ae1.localMin.polytype === ae2.localMin.polytype;
      }
      static setDx(ae) {
        ae.dx = _ClipperBase.getDx(ae.bot, ae.top);
      }
      static nextVertex(ae) {
        return ae.windDx > 0 ? ae.vertexTop.next : ae.vertexTop.prev;
      }
      static prevPrevVertex(ae) {
        return ae.windDx > 0 ? ae.vertexTop.prev.prev : ae.vertexTop.next.next;
      }
      static isMaximaVertex(v) {
        return (v.flags & VertexFlags.LocalMax) !== VertexFlags.None;
      }
      static isMaximaEdge(ae) {
        return (ae.vertexTop.flags & VertexFlags.LocalMax) !== VertexFlags.None;
      }
      static getMaximaPair(ae) {
        let ae2 = ae.nextInAEL;
        while (ae2 !== null) {
          if (ae2.vertexTop === ae.vertexTop)
            return ae2;
          ae2 = ae2.nextInAEL;
        }
        return null;
      }
      // optimization (not in C# reference): fast bounding box overlap check for segment intersection
      boundingBoxesOverlap(p1, p2, p3, p4) {
        const min1x = p1.x < p2.x ? p1.x : p2.x;
        const max2x = p3.x > p4.x ? p3.x : p4.x;
        if (max2x < min1x)
          return false;
        const max1x = p1.x > p2.x ? p1.x : p2.x;
        const min2x = p3.x < p4.x ? p3.x : p4.x;
        if (max1x < min2x)
          return false;
        const min1y = p1.y < p2.y ? p1.y : p2.y;
        const max2y = p3.y > p4.y ? p3.y : p4.y;
        if (max2y < min1y)
          return false;
        const max1y = p1.y > p2.y ? p1.y : p2.y;
        const min2y = p3.y < p4.y ? p3.y : p4.y;
        return max1y >= min2y;
      }
      clearSolutionOnly() {
        while (this.actives !== null)
          this.deleteFromAEL(this.actives);
        this.scanlineHeap.clear();
        this.scanlineSet.clear();
        this.scanlineArr.length = 0;
        this.disposeIntersectNodes();
        this.outrecList.length = 0;
        this.horzSegList.length = 0;
        this.horzJoinList.length = 0;
      }
      clear() {
        this.clearSolutionOnly();
        this.minimaList.length = 0;
        this.vertexList.length = 0;
        this.currentLocMin = 0;
        this.isSortedMinimaList = false;
        this.hasOpenPaths = false;
      }
      reset() {
        if (!this.isSortedMinimaList) {
          this.minimaList.sort((a, b) => b.vertex.pt.y - a.vertex.pt.y);
          this.isSortedMinimaList = true;
        }
        this.scanlineHeap.clear();
        this.scanlineSet.clear();
        this.scanlineArr.length = 0;
        this.useScanlineArray = this.minimaList.length <= 16;
        for (let i = this.minimaList.length - 1; i >= 0; i--) {
          this.insertScanline(this.minimaList[i].vertex.pt.y);
        }
        this.currentBotY = 0;
        this.currentLocMin = 0;
        this.actives = null;
        this.sel = null;
        this.curXValidAtTop = false;
        this.succeeded = true;
      }
      upgradeScanlineStructureFromArray() {
        const arr = this.scanlineArr;
        for (let i = 0, len = arr.length; i < len; i++) {
          const y = arr[i];
          this.scanlineSet.add(y);
          this.scanlineHeap.push(y);
        }
        arr.length = 0;
        this.useScanlineArray = false;
      }
      insertScanline(y) {
        if (this.useScanlineArray) {
          const arr = this.scanlineArr;
          for (let i = 0, len = arr.length; i < len; i++) {
            if (arr[i] === y)
              return;
          }
          arr.push(y);
          if (arr.length > 64)
            this.upgradeScanlineStructureFromArray();
          return;
        }
        if (this.scanlineSet.has(y))
          return;
        this.scanlineSet.add(y);
        this.scanlineHeap.push(y);
      }
      // Returns the next scanline Y value, or null if empty.
      // Avoids allocating a wrapper object on every call in the main sweep loop.
      popScanline() {
        if (this.useScanlineArray) {
          const arr = this.scanlineArr;
          const len = arr.length;
          if (len === 0)
            return null;
          let bestIdx = 0;
          let bestY = arr[0];
          for (let i = 1; i < len; i++) {
            const v = arr[i];
            if (v > bestY) {
              bestY = v;
              bestIdx = i;
            }
          }
          arr[bestIdx] = arr[len - 1];
          arr.pop();
          return bestY;
        }
        const y = this.scanlineHeap.pop();
        if (y === null)
          return null;
        this.scanlineSet.delete(y);
        return y;
      }
      hasLocMinAtY(y) {
        return this.currentLocMin < this.minimaList.length && this.minimaList[this.currentLocMin].vertex.pt.y === y;
      }
      popLocalMinima() {
        return this.minimaList[this.currentLocMin++];
      }
      addPath(path, polytype, isOpen = false) {
        const tmp = [path];
        this.addPaths(tmp, polytype, isOpen);
      }
      addPaths(paths, polytype, isOpen = false) {
        if (isOpen)
          this.hasOpenPaths = true;
        this.isSortedMinimaList = false;
        ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this.minimaList, this.vertexList);
      }
      addReuseableData(reuseableData) {
        if (reuseableData["minimaList"].length === 0)
          return;
        this.isSortedMinimaList = false;
        for (const lm of reuseableData["minimaList"]) {
          this.minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
          if (lm.isOpen)
            this.hasOpenPaths = true;
        }
      }
      deleteFromAEL(ae) {
        const prev = ae.prevInAEL;
        const next = ae.nextInAEL;
        if (prev === null && next === null && ae !== this.actives)
          return;
        if (prev !== null) {
          prev.nextInAEL = next;
        } else {
          this.actives = next;
        }
        if (next !== null)
          next.prevInAEL = prev;
      }
      getBounds() {
        const bounds = {
          left: Number.MAX_SAFE_INTEGER,
          top: Number.MAX_SAFE_INTEGER,
          right: Number.MIN_SAFE_INTEGER,
          bottom: Number.MIN_SAFE_INTEGER
        };
        for (const t of this.vertexList) {
          let v = t;
          do {
            if (v.pt.x < bounds.left)
              bounds.left = v.pt.x;
            if (v.pt.x > bounds.right)
              bounds.right = v.pt.x;
            if (v.pt.y < bounds.top)
              bounds.top = v.pt.y;
            if (v.pt.y > bounds.bottom)
              bounds.bottom = v.pt.y;
            v = v.next;
          } while (v !== t);
        }
        return Rect64Utils.isEmpty(bounds) ? { left: 0, top: 0, right: 0, bottom: 0 } : bounds;
      }
      executeInternal(ct, fillRule) {
        if (ct === ClipType.NoClip)
          return;
        _ClipperBase.openPathsEnabled = this.hasOpenPaths;
        this.zCallbackInternal = this.getZCallback();
        this.fillrule = fillRule;
        this.cliptype = ct;
        this.reset();
        let y = this.popScanline();
        if (y === null)
          return;
        while (this.succeeded) {
          this.insertLocalMinimaIntoAEL(y);
          let ae;
          while ((ae = this.popHorz()) !== null)
            this.doHorizontal(ae);
          if (this.horzSegList.length > 0) {
            this.convertHorzSegsToJoins();
            this.horzSegList.length = 0;
          }
          this.currentBotY = y;
          const nextY = this.popScanline();
          if (nextY === null)
            break;
          y = nextY;
          this.doIntersections(y);
          this.doTopOfScanbeam(y);
          while ((ae = this.popHorz()) !== null)
            this.doHorizontal(ae);
        }
        if (this.succeeded)
          this.processHorzJoins();
      }
      insertLocalMinimaIntoAEL(botY) {
        while (this.hasLocMinAtY(botY)) {
          const localMinima = this.popLocalMinima();
          let leftBound;
          if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
            leftBound = null;
          } else {
            leftBound = new Active();
            leftBound.bot = localMinima.vertex.pt;
            leftBound.curX = localMinima.vertex.pt.x;
            leftBound.windDx = -1;
            leftBound.vertexTop = localMinima.vertex.prev;
            leftBound.top = localMinima.vertex.prev.pt;
            leftBound.outrec = null;
            leftBound.localMin = localMinima;
            _ClipperBase.setDx(leftBound);
          }
          let rightBound;
          if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
            rightBound = null;
          } else {
            rightBound = new Active();
            rightBound.bot = localMinima.vertex.pt;
            rightBound.curX = localMinima.vertex.pt.x;
            rightBound.windDx = 1;
            rightBound.vertexTop = localMinima.vertex.next;
            rightBound.top = localMinima.vertex.next.pt;
            rightBound.outrec = null;
            rightBound.localMin = localMinima;
            _ClipperBase.setDx(rightBound);
          }
          if (leftBound !== null && rightBound !== null) {
            if (_ClipperBase.isHorizontal(leftBound)) {
              if (_ClipperBase.isHeadingRightHorz(leftBound)) {
                const tmp = leftBound;
                leftBound = rightBound;
                rightBound = tmp;
              }
            } else if (_ClipperBase.isHorizontal(rightBound)) {
              if (_ClipperBase.isHeadingLeftHorz(rightBound)) {
                const tmp = leftBound;
                leftBound = rightBound;
                rightBound = tmp;
              }
            } else if (leftBound.dx < rightBound.dx) {
              const tmp = leftBound;
              leftBound = rightBound;
              rightBound = tmp;
            }
          } else if (leftBound === null) {
            leftBound = rightBound;
            rightBound = null;
          }
          let contributing;
          leftBound.isLeftBound = true;
          this.insertLeftEdge(leftBound);
          if (!_ClipperBase.openPathsEnabled) {
            this.setWindCountForClosedPathEdge(leftBound);
            contributing = this.isContributingClosed(leftBound);
          } else if (_ClipperBase.isOpen(leftBound)) {
            this.setWindCountForOpenPathEdge(leftBound);
            contributing = this.isContributingOpen(leftBound);
          } else {
            this.setWindCountForClosedPathEdge(leftBound);
            contributing = this.isContributingClosed(leftBound);
          }
          if (rightBound !== null) {
            rightBound.windCount = leftBound.windCount;
            rightBound.windCount2 = leftBound.windCount2;
            this.insertRightEdge(leftBound, rightBound);
            if (contributing) {
              this.addLocalMinPoly(leftBound, rightBound, leftBound.bot, true);
              if (!_ClipperBase.isHorizontal(leftBound)) {
                this.checkJoinLeft(leftBound, leftBound.bot);
              }
            }
            while (rightBound.nextInAEL !== null && this.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
              this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
              this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
            }
            if (_ClipperBase.isHorizontal(rightBound)) {
              this.pushHorz(rightBound);
            } else {
              this.checkJoinRight(rightBound, rightBound.bot);
              this.insertScanline(rightBound.top.y);
            }
          } else if (contributing && _ClipperBase.openPathsEnabled) {
            this.startOpenPath(leftBound, leftBound.bot);
          }
          if (_ClipperBase.isHorizontal(leftBound)) {
            this.pushHorz(leftBound);
          } else {
            this.insertScanline(leftBound.top.y);
          }
        }
      }
      pushHorz(ae) {
        ae.nextInSEL = this.sel;
        this.sel = ae;
      }
      popHorz() {
        const ae = this.sel;
        if (ae === null)
          return null;
        this.sel = this.sel.nextInSEL;
        return ae;
      }
      doHorizontal(horz) {
        if (!_ClipperBase.openPathsEnabled) {
          this.doHorizontalClosed(horz);
          return;
        }
        const horzIsOpen = _ClipperBase.isOpen(horz);
        const y = horz.bot.y;
        const vertexMax = horzIsOpen ? this.getCurrYMaximaVertexOpen(horz) : this.getCurrYMaximaVertex(horz);
        const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
        let leftX2 = leftX;
        let rightX2 = rightX;
        if (_ClipperBase.isHotEdge(horz)) {
          const op = this.addOutPt(horz, { x: horz.curX, y });
          this.addToHorzSegList(op);
        }
        while (true) {
          let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
          while (ae !== null) {
            if (ae.vertexTop === vertexMax) {
              if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
                this.split(ae, ae.top);
              if (_ClipperBase.isHotEdge(horz)) {
                while (horz.vertexTop !== vertexMax) {
                  this.addOutPt(horz, horz.top);
                  this.updateEdgeIntoAEL(horz);
                }
                if (isLeftToRight) {
                  this.addLocalMaxPoly(horz, ae, horz.top);
                } else {
                  this.addLocalMaxPoly(ae, horz, horz.top);
                }
              }
              this.deleteFromAEL(ae);
              this.deleteFromAEL(horz);
              return;
            }
            if (vertexMax !== horz.vertexTop || _ClipperBase.isOpenEnd(horz)) {
              if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
                break;
              if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
                const pt2 = _ClipperBase.nextVertex(horz).pt;
                if (_ClipperBase.isOpen(ae) && !_ClipperBase.isSamePolyType(ae, horz) && !_ClipperBase.isHotEdge(ae)) {
                  if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) > pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) < pt2.x)
                    break;
                } else if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) >= pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) <= pt2.x)
                  break;
              }
            }
            const pt = { x: ae.curX, y };
            if (isLeftToRight) {
              this.intersectEdges(horz, ae, pt);
              this.swapPositionsInAEL(horz, ae);
              this.checkJoinLeft(ae, pt);
              horz.curX = ae.curX;
              ae = horz.nextInAEL;
            } else {
              this.intersectEdges(ae, horz, pt);
              this.swapPositionsInAEL(ae, horz);
              this.checkJoinRight(ae, pt);
              horz.curX = ae.curX;
              ae = horz.prevInAEL;
            }
            if (_ClipperBase.isHotEdge(horz)) {
              this.addToHorzSegList(this.getLastOp(horz));
            }
          }
          if (horzIsOpen && _ClipperBase.isOpenEnd(horz)) {
            if (_ClipperBase.isHotEdge(horz)) {
              this.addOutPt(horz, horz.top);
              if (_ClipperBase.isFront(horz)) {
                horz.outrec.frontEdge = null;
              } else {
                horz.outrec.backEdge = null;
              }
              horz.outrec = null;
            }
            this.deleteFromAEL(horz);
            return;
          }
          if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
            break;
          }
          if (_ClipperBase.isHotEdge(horz)) {
            this.addOutPt(horz, horz.top);
          }
          this.updateEdgeIntoAEL(horz);
          const resetResult = this.resetHorzDirection(horz, vertexMax);
          leftX2 = resetResult.leftX;
          rightX2 = resetResult.rightX;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          const op = this.addOutPt(horz, horz.top);
          this.addToHorzSegList(op);
        }
        this.updateEdgeIntoAEL(horz);
      }
      // Closed-path-only horizontal processing (no open-path branching).
      doHorizontalClosed(horz) {
        const y = horz.bot.y;
        const vertexMax = this.getCurrYMaximaVertex(horz);
        const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
        let leftX2 = leftX;
        let rightX2 = rightX;
        if (_ClipperBase.isHotEdge(horz)) {
          const op = this.addOutPt(horz, { x: horz.curX, y });
          this.addToHorzSegList(op);
        }
        while (true) {
          let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
          while (ae !== null) {
            if (ae.vertexTop === vertexMax) {
              if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
                this.split(ae, ae.top);
              if (_ClipperBase.isHotEdge(horz)) {
                while (horz.vertexTop !== vertexMax) {
                  this.addOutPt(horz, horz.top);
                  this.updateEdgeIntoAEL(horz);
                }
                if (isLeftToRight) {
                  this.addLocalMaxPoly(horz, ae, horz.top);
                } else {
                  this.addLocalMaxPoly(ae, horz, horz.top);
                }
              }
              this.deleteFromAEL(ae);
              this.deleteFromAEL(horz);
              return;
            }
            if (vertexMax !== horz.vertexTop) {
              if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
                break;
              if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
                const nextPt = _ClipperBase.nextVertex(horz).pt;
                const tx = _ClipperBase.topX(ae, nextPt.y);
                if (isLeftToRight && tx >= nextPt.x || !isLeftToRight && tx <= nextPt.x)
                  break;
              }
            }
            const pt = { x: ae.curX, y };
            if (isLeftToRight) {
              this.intersectEdges(horz, ae, pt);
              this.swapPositionsInAEL(horz, ae);
              this.checkJoinLeft(ae, pt);
              horz.curX = ae.curX;
              ae = horz.nextInAEL;
            } else {
              this.intersectEdges(ae, horz, pt);
              this.swapPositionsInAEL(ae, horz);
              this.checkJoinRight(ae, pt);
              horz.curX = ae.curX;
              ae = horz.prevInAEL;
            }
            if (_ClipperBase.isHotEdge(horz)) {
              this.addToHorzSegList(this.getLastOp(horz));
            }
          }
          if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
            break;
          }
          if (_ClipperBase.isHotEdge(horz)) {
            this.addOutPt(horz, horz.top);
          }
          this.updateEdgeIntoAEL(horz);
          const resetResult = this.resetHorzDirection(horz, vertexMax);
          leftX2 = resetResult.leftX;
          rightX2 = resetResult.rightX;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          const op = this.addOutPt(horz, horz.top);
          this.addToHorzSegList(op);
        }
        this.updateEdgeIntoAEL(horz);
      }
      convertHorzSegsToJoins() {
        const list = this.horzSegList;
        let k = 0;
        for (let i = 0, len = list.length; i < len; i++) {
          const hs = list[i];
          if (this.updateHorzSegment(hs))
            list[k++] = hs;
        }
        if (k < 2)
          return;
        list.length = k;
        this.horzSegList.sort(compareHorzSegments);
        for (let i = 0; i < k - 1; i++) {
          const hs1 = this.horzSegList[i];
          for (let j = i + 1; j < k; j++) {
            const hs2 = this.horzSegList[j];
            if (hs2.leftOp.pt.x >= hs1.rightOp.pt.x || hs2.leftToRight === hs1.leftToRight || hs2.rightOp.pt.x <= hs1.leftOp.pt.x)
              continue;
            const currY = hs1.leftOp.pt.y;
            if (hs1.leftToRight) {
              while (hs1.leftOp.next.pt.y === currY && hs1.leftOp.next.pt.x <= hs2.leftOp.pt.x)
                hs1.leftOp = hs1.leftOp.next;
              while (hs2.leftOp.prev.pt.y === currY && hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x)
                hs2.leftOp = hs2.leftOp.prev;
              const join = new HorzJoin(this.duplicateOp(hs1.leftOp, true), this.duplicateOp(hs2.leftOp, false));
              this.horzJoinList.push(join);
            } else {
              while (hs1.leftOp.prev.pt.y === currY && hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x)
                hs1.leftOp = hs1.leftOp.prev;
              while (hs2.leftOp.next.pt.y === currY && hs2.leftOp.next.pt.x <= hs1.leftOp.pt.x)
                hs2.leftOp = hs2.leftOp.next;
              const join = new HorzJoin(this.duplicateOp(hs2.leftOp, true), this.duplicateOp(hs1.leftOp, false));
              this.horzJoinList.push(join);
            }
          }
        }
      }
      updateHorzSegment(hs) {
        const op = hs.leftOp;
        const outrec = this.getRealOutRec(op.outrec);
        const outrecHasEdges = outrec.frontEdge !== null;
        const currY = op.pt.y;
        let opP = op;
        let opN = op;
        if (outrecHasEdges) {
          const opA = outrec.pts;
          const opZ = opA.next;
          while (opP !== opZ && opP.prev.pt.y === currY)
            opP = opP.prev;
          while (opN !== opA && opN.next.pt.y === currY)
            opN = opN.next;
        } else {
          while (opP.prev !== opN && opP.prev.pt.y === currY)
            opP = opP.prev;
          while (opN.next !== opP && opN.next.pt.y === currY)
            opN = opN.next;
        }
        const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp.horz === null;
        if (result) {
          hs.leftOp.horz = hs;
        } else {
          hs.rightOp = null;
        }
        return result;
      }
      setHorzSegHeadingForward(hs, opP, opN) {
        if (opP.pt.x === opN.pt.x)
          return false;
        if (opP.pt.x < opN.pt.x) {
          hs.leftOp = opP;
          hs.rightOp = opN;
          hs.leftToRight = true;
        } else {
          hs.leftOp = opN;
          hs.rightOp = opP;
          hs.leftToRight = false;
        }
        return true;
      }
      duplicateOp(op, insertAfter) {
        const result = new OutPt(op.pt, op.outrec);
        if (insertAfter) {
          result.next = op.next;
          result.next.prev = result;
          result.prev = op;
          op.next = result;
        } else {
          result.prev = op.prev;
          result.prev.next = result;
          result.next = op;
          op.prev = result;
        }
        return result;
      }
      getRealOutRec(outRec) {
        while (outRec !== null && outRec.pts === null) {
          outRec = outRec.owner;
        }
        return outRec;
      }
      doIntersections(y) {
        if (this.buildIntersectList(y)) {
          this.processIntersectList();
          this.disposeIntersectNodes();
        }
      }
      doTopOfScanbeam(y) {
        const curXValid = this.curXValidAtTop;
        this.curXValidAtTop = false;
        this.sel = null;
        let ae = this.actives;
        while (ae !== null) {
          if (ae.top.y === y) {
            ae.curX = ae.top.x;
            if (_ClipperBase.isMaximaEdge(ae)) {
              ae = this.doMaxima(ae);
              continue;
            } else {
              if (_ClipperBase.isHotEdge(ae))
                this.addOutPt(ae, ae.top);
              this.updateEdgeIntoAEL(ae);
              if (_ClipperBase.isHorizontal(ae)) {
                this.pushHorz(ae);
              }
            }
          } else if (!curXValid) {
            ae.curX = _ClipperBase.topX(ae, y);
          }
          ae = ae.nextInAEL;
        }
      }
      processHorzJoins() {
        for (const j of this.horzJoinList) {
          const or1 = this.getRealOutRec(j.op1.outrec);
          const or2 = this.getRealOutRec(j.op2.outrec);
          const op1b = j.op1.next;
          const op2b = j.op2.prev;
          j.op1.next = j.op2;
          j.op2.prev = j.op1;
          op1b.prev = op2b;
          op2b.next = op1b;
          if (or1 === or2) {
            const or2New = this.newOutRec();
            or2New.pts = op1b;
            this.fixOutRecPts(or2New);
            if (or1.pts.outrec === or2New) {
              or1.pts = j.op1;
              or1.pts.outrec = or1;
            }
            if (this.usingPolytree) {
              if (this.path1InsidePath2(or1.pts, or2New.pts)) {
                [or2New.pts, or1.pts] = [or1.pts, or2New.pts];
                this.fixOutRecPts(or1);
                this.fixOutRecPts(or2New);
                or2New.owner = or1;
              } else if (this.path1InsidePath2(or2New.pts, or1.pts)) {
                or2New.owner = or1;
              } else {
                or2New.owner = or1.owner;
              }
              if (or1.splits === null)
                or1.splits = [];
              or1.splits.push(or2New.idx);
            } else {
              or2New.owner = or1;
            }
          } else {
            or2.pts = null;
            if (this.usingPolytree) {
              this.setOwner(or2, or1);
              this.moveSplits(or2, or1);
            } else {
              or2.owner = or1;
            }
          }
        }
      }
      fixOutRecPts(outrec) {
        let op = outrec.pts;
        do {
          op.outrec = outrec;
          op = op.next;
        } while (op !== outrec.pts);
      }
      path1InsidePath2(op1, op2) {
        let pip = PointInPolygonResult.IsOn;
        let op = op1;
        do {
          switch (this.pointInOpPolygon(op.pt, op2)) {
            case PointInPolygonResult.IsOutside:
              if (pip === PointInPolygonResult.IsOutside)
                return false;
              pip = PointInPolygonResult.IsOutside;
              break;
            case PointInPolygonResult.IsInside:
              if (pip === PointInPolygonResult.IsInside)
                return true;
              pip = PointInPolygonResult.IsInside;
              break;
          }
          op = op.next;
        } while (op !== op1);
        return InternalClipper.path2ContainsPath1(this.getCleanPath(op1), this.getCleanPath(op2));
      }
      pointInOpPolygon(pt, op) {
        if (op === op.next || op.prev === op.next) {
          return PointInPolygonResult.IsOutside;
        }
        let op2 = op;
        do {
          if (op.pt.y !== pt.y)
            break;
          op = op.next;
        } while (op !== op2);
        if (op.pt.y === pt.y)
          return PointInPolygonResult.IsOutside;
        let isAbove = op.pt.y < pt.y;
        const startingAbove = isAbove;
        let val = 0;
        op2 = op.next;
        while (op2 !== op) {
          if (isAbove) {
            while (op2 !== op && op2.pt.y < pt.y)
              op2 = op2.next;
          } else {
            while (op2 !== op && op2.pt.y > pt.y)
              op2 = op2.next;
          }
          if (op2 === op)
            break;
          if (op2.pt.y === pt.y) {
            if (op2.pt.x === pt.x || op2.pt.y === op2.prev.pt.y && pt.x < op2.prev.pt.x !== pt.x < op2.pt.x)
              return PointInPolygonResult.IsOn;
            op2 = op2.next;
            if (op2 === op)
              break;
            continue;
          }
          if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
            if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x) {
              val = 1 - val;
            } else {
              const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
              if (d === 0)
                return PointInPolygonResult.IsOn;
              if (d < 0 === isAbove)
                val = 1 - val;
            }
          }
          isAbove = !isAbove;
          op2 = op2.next;
        }
        if (isAbove === startingAbove)
          return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
        {
          const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
          if (d === 0)
            return PointInPolygonResult.IsOn;
          if (d < 0 === isAbove)
            val = 1 - val;
        }
        return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
      }
      getCleanPath(op) {
        const result = [];
        let op2 = op;
        while (op2.next !== op && (op2.pt.x === op2.next.pt.x && op2.pt.x === op2.prev.pt.x || op2.pt.y === op2.next.pt.y && op2.pt.y === op2.prev.pt.y))
          op2 = op2.next;
        result.push(op2.pt);
        let prevOp = op2;
        op2 = op2.next;
        while (op2 !== op) {
          if ((op2.pt.x !== op2.next.pt.x || op2.pt.x !== prevOp.pt.x) && (op2.pt.y !== op2.next.pt.y || op2.pt.y !== prevOp.pt.y)) {
            result.push(op2.pt);
            prevOp = op2;
          }
          op2 = op2.next;
        }
        return result;
      }
      moveSplits(fromOr, toOr) {
        if (fromOr.splits === null)
          return;
        if (toOr.splits === null)
          toOr.splits = [];
        for (const i of fromOr.splits) {
          if (i !== toOr.idx) {
            toOr.splits.push(i);
          }
        }
        fromOr.splits = null;
      }
      buildIntersectList(topY) {
        var _a2;
        if (((_a2 = this.actives) == null ? void 0 : _a2.nextInAEL) === null)
          return false;
        if (!this.adjustCurrXAndCopyToSEL(topY)) {
          this.curXValidAtTop = true;
          return false;
        }
        let left = this.sel;
        while (left !== null && left.jump !== null) {
          let prevBase = null;
          while (left !== null && left.jump !== null) {
            let currBase = left;
            let right = left.jump;
            let lEnd = right;
            const rEnd = (right == null ? void 0 : right.jump) || null;
            left.jump = rEnd;
            while (left !== lEnd && right !== rEnd) {
              if (right.curX < left.curX) {
                let tmp = right.prevInSEL;
                while (true) {
                  this.addNewIntersectNode(tmp, right, topY);
                  if (tmp === left)
                    break;
                  tmp = tmp.prevInSEL;
                }
                tmp = right;
                right = this.extractFromSEL(tmp);
                lEnd = right;
                if (left !== null)
                  this.insert1Before2InSEL(tmp, left);
                if (left !== currBase)
                  continue;
                currBase = tmp;
                currBase.jump = rEnd;
                if (prevBase === null) {
                  this.sel = currBase;
                } else {
                  prevBase.jump = currBase;
                }
              } else {
                left = left.nextInSEL;
              }
            }
            prevBase = currBase;
            left = rEnd;
          }
          left = this.sel;
        }
        return this.intersectList.length > 0;
      }
      processIntersectList() {
        this.intersectList.sort(compareIntersectNodes);
        for (let i = 0; i < this.intersectList.length; ++i) {
          if (!this.edgesAdjacentInAEL(this.intersectList[i])) {
            let j = i + 1;
            while (!this.edgesAdjacentInAEL(this.intersectList[j]))
              j++;
            [this.intersectList[j], this.intersectList[i]] = [this.intersectList[i], this.intersectList[j]];
          }
          const node = this.intersectList[i];
          this.intersectEdges(node.edge1, node.edge2, node.pt);
          this.swapPositionsInAEL(node.edge1, node.edge2);
          node.edge1.curX = node.pt.x;
          node.edge2.curX = node.pt.x;
          this.checkJoinLeft(node.edge2, node.pt, true);
          this.checkJoinRight(node.edge1, node.pt, true);
        }
      }
      edgesAdjacentInAEL(inode) {
        return inode.edge1.nextInAEL === inode.edge2 || inode.edge1.prevInAEL === inode.edge2;
      }
      // Returns true if any adjacent pair is inverted at topY (i.e. at least one
      // intersection exists within this scanbeam).
      adjustCurrXAndCopyToSEL(topY) {
        let ae = this.actives;
        this.sel = ae;
        let prevX = Number.NEGATIVE_INFINITY;
        let inverted = false;
        while (ae !== null) {
          ae.prevInSEL = ae.prevInAEL;
          ae.nextInSEL = ae.nextInAEL;
          ae.jump = ae.nextInSEL;
          const x = _ClipperBase.topX(ae, topY);
          ae.curX = x;
          if (x < prevX)
            inverted = true;
          prevX = x;
          ae = ae.nextInAEL;
        }
        return inverted;
      }
      doMaxima(ae) {
        const prevE = ae.prevInAEL;
        let nextE = ae.nextInAEL;
        if (_ClipperBase.isOpenEnd(ae)) {
          if (_ClipperBase.isHotEdge(ae))
            this.addOutPt(ae, ae.top);
          if (_ClipperBase.isHorizontal(ae))
            return nextE;
          if (_ClipperBase.isHotEdge(ae)) {
            if (_ClipperBase.isFront(ae)) {
              ae.outrec.frontEdge = null;
            } else {
              ae.outrec.backEdge = null;
            }
            ae.outrec = null;
          }
          this.deleteFromAEL(ae);
          return nextE;
        }
        const maxPair = _ClipperBase.getMaximaPair(ae);
        if (maxPair === null)
          return nextE;
        if (this.isJoined(ae))
          this.split(ae, ae.top);
        if (this.isJoined(maxPair))
          this.split(maxPair, maxPair.top);
        while (nextE !== maxPair) {
          this.intersectEdges(ae, nextE, ae.top);
          this.swapPositionsInAEL(ae, nextE);
          nextE = ae.nextInAEL;
        }
        if (_ClipperBase.isOpen(ae)) {
          if (_ClipperBase.isHotEdge(ae)) {
            this.addLocalMaxPoly(ae, maxPair, ae.top);
          }
          this.deleteFromAEL(maxPair);
          this.deleteFromAEL(ae);
          return prevE !== null ? prevE.nextInAEL : this.actives;
        }
        if (_ClipperBase.isHotEdge(ae)) {
          this.addLocalMaxPoly(ae, maxPair, ae.top);
        }
        this.deleteFromAEL(ae);
        this.deleteFromAEL(maxPair);
        return prevE !== null ? prevE.nextInAEL : this.actives;
      }
      updateEdgeIntoAEL(ae) {
        ae.bot = ae.top;
        ae.vertexTop = _ClipperBase.nextVertex(ae);
        ae.top = ae.vertexTop.pt;
        ae.curX = ae.bot.x;
        _ClipperBase.setDx(ae);
        if (this.isJoined(ae))
          this.split(ae, ae.bot);
        if (_ClipperBase.isHorizontal(ae)) {
          if (!_ClipperBase.openPathsEnabled) {
            this.trimHorz(ae, this.preserveCollinear);
          } else if (!_ClipperBase.isOpen(ae)) {
            this.trimHorz(ae, this.preserveCollinear);
          }
          return;
        }
        this.insertScanline(ae.top.y);
        this.checkJoinLeft(ae, ae.bot);
        this.checkJoinRight(ae, ae.bot, true);
      }
      trimHorz(horzEdge, preserveCollinear) {
        let wasTrimmed = false;
        let pt = _ClipperBase.nextVertex(horzEdge).pt;
        while (pt.y === horzEdge.top.y) {
          if (preserveCollinear && pt.x < horzEdge.top.x !== horzEdge.bot.x < horzEdge.top.x) {
            break;
          }
          horzEdge.vertexTop = _ClipperBase.nextVertex(horzEdge);
          horzEdge.top = pt;
          wasTrimmed = true;
          if (_ClipperBase.isMaximaVertex(horzEdge.vertexTop))
            break;
          pt = _ClipperBase.nextVertex(horzEdge).pt;
        }
        if (wasTrimmed)
          _ClipperBase.setDx(horzEdge);
      }
      addToHorzSegList(op) {
        if (op.outrec.isOpen)
          return;
        this.horzSegList.push(new HorzSegment(op));
      }
      addNewIntersectNode(ae1, ae2, topY) {
        let ip = InternalClipper.getLineIntersectPt(ae1.bot, ae1.top, ae2.bot, ae2.top);
        if (ip === null) {
          ip = { x: ae1.curX, y: topY };
        }
        if (ip.y > this.currentBotY || ip.y < topY) {
          const absDx1 = Math.abs(ae1.dx);
          const absDx2 = Math.abs(ae2.dx);
          if (absDx1 > 100 && absDx2 > 100) {
            if (absDx1 > absDx2) {
              ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
            } else {
              ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
            }
          } else if (absDx1 > 100) {
            ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
          } else if (absDx2 > 100) {
            ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
          } else {
            if (ip.y < topY)
              ip.y = topY;
            else
              ip.y = this.currentBotY;
            if (absDx1 < absDx2)
              ip.x = _ClipperBase.topX(ae1, ip.y);
            else
              ip.x = _ClipperBase.topX(ae2, ip.y);
          }
        }
        const node = createIntersectNode(ip, ae1, ae2);
        this.intersectList.push(node);
      }
      extractFromSEL(ae) {
        const res = ae.nextInSEL;
        if (res !== null) {
          res.prevInSEL = ae.prevInSEL;
        }
        ae.prevInSEL.nextInSEL = res;
        return res;
      }
      insert1Before2InSEL(ae1, ae2) {
        ae1.prevInSEL = ae2.prevInSEL;
        if (ae1.prevInSEL !== null) {
          ae1.prevInSEL.nextInSEL = ae1;
        }
        ae1.nextInSEL = ae2;
        ae2.prevInSEL = ae1;
      }
      getCurrYMaximaVertexOpen(ae) {
        let result = ae.vertexTop;
        if (ae.windDx > 0) {
          while (result.next.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
            result = result.next;
        } else {
          while (result.prev.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
            result = result.prev;
        }
        if (!_ClipperBase.isMaximaVertex(result))
          result = null;
        return result;
      }
      getCurrYMaximaVertex(ae) {
        let result = ae.vertexTop;
        if (ae.windDx > 0) {
          while (result.next.pt.y === result.pt.y)
            result = result.next;
        } else {
          while (result.prev.pt.y === result.pt.y)
            result = result.prev;
        }
        if (!_ClipperBase.isMaximaVertex(result))
          result = null;
        return result;
      }
      resetHorzDirection(horz, vertexMax) {
        if (horz.bot.x === horz.top.x) {
          const leftX = horz.curX;
          const rightX = horz.curX;
          let ae = horz.nextInAEL;
          while (ae !== null && ae.vertexTop !== vertexMax)
            ae = ae.nextInAEL;
          return { isLeftToRight: ae !== null, leftX, rightX };
        }
        if (horz.curX < horz.top.x) {
          return { isLeftToRight: true, leftX: horz.curX, rightX: horz.top.x };
        } else {
          return { isLeftToRight: false, leftX: horz.top.x, rightX: horz.curX };
        }
      }
      getLastOp(hotEdge) {
        const outrec = hotEdge.outrec;
        return hotEdge === outrec.frontEdge ? outrec.pts : outrec.pts.next;
      }
      insertLeftEdge(ae) {
        if (this.actives === null) {
          ae.prevInAEL = null;
          ae.nextInAEL = null;
          this.actives = ae;
        } else if (!this.isValidAelOrder(this.actives, ae)) {
          ae.prevInAEL = null;
          ae.nextInAEL = this.actives;
          this.actives.prevInAEL = ae;
          this.actives = ae;
        } else {
          let ae2 = this.actives;
          while (ae2.nextInAEL !== null && this.isValidAelOrder(ae2.nextInAEL, ae)) {
            ae2 = ae2.nextInAEL;
          }
          if (ae2.joinWith === JoinWith.Right)
            ae2 = ae2.nextInAEL;
          ae.nextInAEL = ae2.nextInAEL;
          if (ae2.nextInAEL !== null)
            ae2.nextInAEL.prevInAEL = ae;
          ae.prevInAEL = ae2;
          ae2.nextInAEL = ae;
        }
      }
      insertRightEdge(ae1, ae2) {
        ae2.nextInAEL = ae1.nextInAEL;
        if (ae1.nextInAEL !== null)
          ae1.nextInAEL.prevInAEL = ae2;
        ae2.prevInAEL = ae1;
        ae1.nextInAEL = ae2;
      }
      setWindCountForOpenPathEdge(ae) {
        let ae2 = this.actives;
        if (this.fillrule === FillRule.EvenOdd) {
          let cnt1 = 0, cnt2 = 0;
          while (ae2 !== ae) {
            if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
              cnt2++;
            } else if (!_ClipperBase.isOpen(ae2)) {
              cnt1++;
            }
            ae2 = ae2.nextInAEL;
          }
          ae.windCount = _ClipperBase.isOdd(cnt1) ? 1 : 0;
          ae.windCount2 = _ClipperBase.isOdd(cnt2) ? 1 : 0;
        } else {
          while (ae2 !== ae) {
            if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
              ae.windCount2 += ae2.windDx;
            } else if (!_ClipperBase.isOpen(ae2)) {
              ae.windCount += ae2.windDx;
            }
            ae2 = ae2.nextInAEL;
          }
        }
      }
      setWindCountForClosedPathEdge(ae) {
        let ae2 = ae.prevInAEL;
        const pt = _ClipperBase.getPolyType(ae);
        if (!_ClipperBase.openPathsEnabled) {
          while (ae2 !== null && _ClipperBase.getPolyType(ae2) !== pt)
            ae2 = ae2.prevInAEL;
          if (ae2 === null) {
            ae.windCount = ae.windDx;
            ae2 = this.actives;
          } else if (this.fillrule === FillRule.EvenOdd) {
            ae.windCount = ae.windDx;
            ae.windCount2 = ae2.windCount2;
            ae2 = ae2.nextInAEL;
          } else {
            if (ae2.windCount * ae2.windDx < 0) {
              if (Math.abs(ae2.windCount) > 1) {
                if (ae2.windDx * ae.windDx < 0) {
                  ae.windCount = ae2.windCount;
                } else {
                  ae.windCount = ae2.windCount + ae.windDx;
                }
              } else {
                ae.windCount = ae.windDx;
              }
            } else {
              if (ae2.windDx * ae.windDx < 0) {
                ae.windCount = ae2.windCount;
              } else {
                ae.windCount = ae2.windCount + ae.windDx;
              }
            }
            ae.windCount2 = ae2.windCount2;
            ae2 = ae2.nextInAEL;
          }
          if (this.fillrule === FillRule.EvenOdd) {
            while (ae2 !== ae) {
              if (_ClipperBase.getPolyType(ae2) !== pt) {
                ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
              }
              ae2 = ae2.nextInAEL;
            }
          } else {
            while (ae2 !== ae) {
              if (_ClipperBase.getPolyType(ae2) !== pt) {
                ae.windCount2 += ae2.windDx;
              }
              ae2 = ae2.nextInAEL;
            }
          }
          return;
        }
        while (ae2 !== null && (_ClipperBase.getPolyType(ae2) !== pt || _ClipperBase.isOpen(ae2)))
          ae2 = ae2.prevInAEL;
        if (ae2 === null) {
          ae.windCount = ae.windDx;
          ae2 = this.actives;
        } else if (this.fillrule === FillRule.EvenOdd) {
          ae.windCount = ae.windDx;
          ae.windCount2 = ae2.windCount2;
          ae2 = ae2.nextInAEL;
        } else {
          if (ae2.windCount * ae2.windDx < 0) {
            if (Math.abs(ae2.windCount) > 1) {
              if (ae2.windDx * ae.windDx < 0) {
                ae.windCount = ae2.windCount;
              } else {
                ae.windCount = ae2.windCount + ae.windDx;
              }
            } else {
              ae.windCount = _ClipperBase.isOpen(ae) ? 1 : ae.windDx;
            }
          } else {
            if (ae2.windDx * ae.windDx < 0) {
              ae.windCount = ae2.windCount;
            } else {
              ae.windCount = ae2.windCount + ae.windDx;
            }
          }
          ae.windCount2 = ae2.windCount2;
          ae2 = ae2.nextInAEL;
        }
        if (this.fillrule === FillRule.EvenOdd) {
          while (ae2 !== ae) {
            if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
              ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
            }
            ae2 = ae2.nextInAEL;
          }
        } else {
          while (ae2 !== ae) {
            if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
              ae.windCount2 += ae2.windDx;
            }
            ae2 = ae2.nextInAEL;
          }
        }
      }
      isContributingOpen(ae) {
        let isInClip, isInSubj;
        switch (this.fillrule) {
          case FillRule.Positive:
            isInSubj = ae.windCount > 0;
            isInClip = ae.windCount2 > 0;
            break;
          case FillRule.Negative:
            isInSubj = ae.windCount < 0;
            isInClip = ae.windCount2 < 0;
            break;
          default:
            isInSubj = ae.windCount !== 0;
            isInClip = ae.windCount2 !== 0;
            break;
        }
        switch (this.cliptype) {
          case ClipType.Intersection:
            return isInClip;
          case ClipType.Union:
            return !isInSubj && !isInClip;
          default:
            return !isInClip;
        }
      }
      isContributingClosed(ae) {
        switch (this.fillrule) {
          case FillRule.Positive:
            if (ae.windCount !== 1)
              return false;
            break;
          case FillRule.Negative:
            if (ae.windCount !== -1)
              return false;
            break;
          case FillRule.NonZero:
            if (Math.abs(ae.windCount) !== 1)
              return false;
            break;
        }
        switch (this.cliptype) {
          case ClipType.Intersection:
            return this.fillrule === FillRule.Positive ? ae.windCount2 > 0 : this.fillrule === FillRule.Negative ? ae.windCount2 < 0 : ae.windCount2 !== 0;
          case ClipType.Union:
            return this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
          case ClipType.Difference: {
            const result = this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
            return _ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;
          }
          case ClipType.Xor:
            return true;
          // XOr is always contributing unless open
          default:
            return false;
        }
      }
      addLocalMinPoly(ae1, ae2, pt, isNew = false) {
        const outrec = this.newOutRec();
        ae1.outrec = outrec;
        ae2.outrec = outrec;
        if (_ClipperBase.isOpen(ae1)) {
          outrec.owner = null;
          outrec.isOpen = true;
          if (ae1.windDx > 0) {
            this.setSides(outrec, ae1, ae2);
          } else {
            this.setSides(outrec, ae2, ae1);
          }
        } else {
          outrec.isOpen = false;
          const prevHotEdge = _ClipperBase.getPrevHotEdge(ae1);
          if (prevHotEdge !== null) {
            if (this.usingPolytree) {
              this.setOwner(outrec, prevHotEdge.outrec);
            }
            outrec.owner = prevHotEdge.outrec;
            if (this.outrecIsAscending(prevHotEdge) === isNew) {
              this.setSides(outrec, ae2, ae1);
            } else {
              this.setSides(outrec, ae1, ae2);
            }
          } else {
            outrec.owner = null;
            if (isNew) {
              this.setSides(outrec, ae1, ae2);
            } else {
              this.setSides(outrec, ae2, ae1);
            }
          }
        }
        const op = new OutPt(pt, outrec);
        outrec.pts = op;
        return op;
      }
      outrecIsAscending(hotEdge) {
        return hotEdge === hotEdge.outrec.frontEdge;
      }
      newOutRec() {
        const result = new OutRec();
        result.idx = this.outrecList.length;
        this.outrecList.push(result);
        return result;
      }
      startOpenPath(ae, pt) {
        const outrec = this.newOutRec();
        outrec.isOpen = true;
        if (ae.windDx > 0) {
          outrec.frontEdge = ae;
          outrec.backEdge = null;
        } else {
          outrec.frontEdge = null;
          outrec.backEdge = ae;
        }
        ae.outrec = outrec;
        const op = new OutPt(pt, outrec);
        outrec.pts = op;
        return op;
      }
      checkJoinLeft(ae, pt, checkCurrX = false) {
        const prev = ae.prevInAEL;
        if (prev === null)
          return;
        if (!checkCurrX && ae.curX !== prev.curX)
          return;
        if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(prev) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(prev) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(prev))
          return;
        if ((pt.y < ae.top.y + 2 || pt.y < prev.top.y + 2) && // avoid trivial joins
        (ae.bot.y > pt.y || prev.bot.y > pt.y))
          return;
        if (checkCurrX) {
          if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, prev.bot, prev.top))
            return;
        }
        if (!InternalClipper.isCollinear(ae.top, pt, prev.top))
          return;
        if (ae.outrec.idx === prev.outrec.idx) {
          this.addLocalMaxPoly(prev, ae, pt);
        } else if (ae.outrec.idx < prev.outrec.idx) {
          this.joinOutrecPaths(ae, prev);
        } else {
          this.joinOutrecPaths(prev, ae);
        }
        prev.joinWith = JoinWith.Right;
        ae.joinWith = JoinWith.Left;
      }
      checkJoinRight(ae, pt, checkCurrX = false) {
        const next = ae.nextInAEL;
        if (next === null)
          return;
        if (!checkCurrX && ae.curX !== next.curX)
          return;
        if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(next) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(next) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(next))
          return;
        if ((pt.y < ae.top.y + 2 || pt.y < next.top.y + 2) && // avoid trivial joins
        (ae.bot.y > pt.y || next.bot.y > pt.y))
          return;
        if (checkCurrX) {
          if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, next.bot, next.top))
            return;
        }
        if (!InternalClipper.isCollinear(ae.top, pt, next.top))
          return;
        if (ae.outrec.idx === next.outrec.idx) {
          this.addLocalMaxPoly(ae, next, pt);
        } else if (ae.outrec.idx < next.outrec.idx) {
          this.joinOutrecPaths(ae, next);
        } else {
          this.joinOutrecPaths(next, ae);
        }
        ae.joinWith = JoinWith.Right;
        next.joinWith = JoinWith.Left;
      }
      perpendicDistFromLineSqrdGreaterThanQuarter(pt, line1, line2) {
        const a = pt.x - line1.x;
        const b = pt.y - line1.y;
        const c = line2.x - line1.x;
        const d = line2.y - line1.y;
        if (c === 0 && d === 0)
          return false;
        const maxCoord = InternalClipper.maxCoordForSafeCrossSq;
        if (Math.abs(a) < maxCoord && Math.abs(b) < maxCoord && Math.abs(c) < maxCoord && Math.abs(d) < maxCoord) {
          const cross2 = a * d - c * b;
          return cross2 * cross2 / (c * c + d * d) > 0.25;
        }
        if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
          const cross2 = BigInt(a) * BigInt(d) - BigInt(c) * BigInt(b);
          const crossSq = cross2 * cross2;
          const denom = BigInt(c) * BigInt(c) + BigInt(d) * BigInt(d);
          return B4 * crossSq > denom;
        }
        const cross = a * d - c * b;
        return cross * cross / (c * c + d * d) > 0.25;
      }
      intersectEdges(ae1, ae2, pt) {
        let resultOp;
        if (this.hasOpenPaths && (_ClipperBase.isOpen(ae1) || _ClipperBase.isOpen(ae2))) {
          if (_ClipperBase.isOpen(ae1) && _ClipperBase.isOpen(ae2))
            return;
          if (_ClipperBase.isOpen(ae2)) {
            const tmp = ae1;
            ae1 = ae2;
            ae2 = tmp;
          }
          if (this.isJoined(ae2))
            this.split(ae2, pt);
          if (this.cliptype === ClipType.Union) {
            if (!_ClipperBase.isHotEdge(ae2))
              return;
          } else if (ae2.localMin.polytype === PathType.Subject)
            return;
          switch (this.fillrule) {
            case FillRule.Positive:
              if (ae2.windCount !== 1)
                return;
              break;
            case FillRule.Negative:
              if (ae2.windCount !== -1)
                return;
              break;
            default:
              if (Math.abs(ae2.windCount) !== 1)
                return;
              break;
          }
          if (_ClipperBase.isHotEdge(ae1)) {
            resultOp = this.addOutPt(ae1, pt);
            this.setZ(ae1, ae2, resultOp.pt);
            if (_ClipperBase.isFront(ae1)) {
              ae1.outrec.frontEdge = null;
            } else {
              ae1.outrec.backEdge = null;
            }
            ae1.outrec = null;
          } else if (pt.x === ae1.localMin.vertex.pt.x && pt.y === ae1.localMin.vertex.pt.y && !_ClipperBase.isOpenEndVertex(ae1.localMin.vertex)) {
            const ae3 = this.findEdgeWithMatchingLocMin(ae1);
            if (ae3 !== null && _ClipperBase.isHotEdge(ae3)) {
              ae1.outrec = ae3.outrec;
              if (ae1.windDx > 0) {
                this.setSides(ae3.outrec, ae1, ae3);
              } else {
                this.setSides(ae3.outrec, ae3, ae1);
              }
              return;
            }
            resultOp = this.startOpenPath(ae1, pt);
          } else {
            resultOp = this.startOpenPath(ae1, pt);
          }
          this.setZ(ae1, ae2, resultOp.pt);
          return;
        }
        if (this.isJoined(ae1))
          this.split(ae1, pt);
        if (this.isJoined(ae2))
          this.split(ae2, pt);
        let oldE1WindCount, oldE2WindCount;
        if (ae1.localMin.polytype === ae2.localMin.polytype) {
          if (this.fillrule === FillRule.EvenOdd) {
            oldE1WindCount = ae1.windCount;
            ae1.windCount = ae2.windCount;
            ae2.windCount = oldE1WindCount;
          } else {
            if (ae1.windCount + ae2.windDx === 0) {
              ae1.windCount = -ae1.windCount;
            } else {
              ae1.windCount += ae2.windDx;
            }
            if (ae2.windCount - ae1.windDx === 0) {
              ae2.windCount = -ae2.windCount;
            } else {
              ae2.windCount -= ae1.windDx;
            }
          }
        } else {
          if (this.fillrule !== FillRule.EvenOdd) {
            ae1.windCount2 += ae2.windDx;
          } else {
            ae1.windCount2 = ae1.windCount2 === 0 ? 1 : 0;
          }
          if (this.fillrule !== FillRule.EvenOdd) {
            ae2.windCount2 -= ae1.windDx;
          } else {
            ae2.windCount2 = ae2.windCount2 === 0 ? 1 : 0;
          }
        }
        switch (this.fillrule) {
          case FillRule.Positive:
            oldE1WindCount = ae1.windCount;
            oldE2WindCount = ae2.windCount;
            break;
          case FillRule.Negative:
            oldE1WindCount = -ae1.windCount;
            oldE2WindCount = -ae2.windCount;
            break;
          default:
            oldE1WindCount = Math.abs(ae1.windCount);
            oldE2WindCount = Math.abs(ae2.windCount);
            break;
        }
        const e1WindCountIs0or1 = oldE1WindCount === 0 || oldE1WindCount === 1;
        const e2WindCountIs0or1 = oldE2WindCount === 0 || oldE2WindCount === 1;
        if (!_ClipperBase.isHotEdge(ae1) && !e1WindCountIs0or1 || !_ClipperBase.isHotEdge(ae2) && !e2WindCountIs0or1)
          return;
        if (_ClipperBase.isHotEdge(ae1) && _ClipperBase.isHotEdge(ae2)) {
          if (oldE1WindCount !== 0 && oldE1WindCount !== 1 || oldE2WindCount !== 0 && oldE2WindCount !== 1 || ae1.localMin.polytype !== ae2.localMin.polytype && this.cliptype !== ClipType.Xor) {
            resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
            if (resultOp)
              this.setZ(ae1, ae2, resultOp.pt);
          } else if (_ClipperBase.isFront(ae1) || ae1.outrec === ae2.outrec) {
            resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
            if (resultOp)
              this.setZ(ae1, ae2, resultOp.pt);
            const op2 = this.addLocalMinPoly(ae1, ae2, pt);
            this.setZ(ae1, ae2, op2.pt);
          } else {
            resultOp = this.addOutPt(ae1, pt);
            this.setZ(ae1, ae2, resultOp.pt);
            const op2 = this.addOutPt(ae2, pt);
            this.setZ(ae1, ae2, op2.pt);
            this.swapOutrecs(ae1, ae2);
          }
        } else if (_ClipperBase.isHotEdge(ae1)) {
          resultOp = this.addOutPt(ae1, pt);
          this.setZ(ae1, ae2, resultOp.pt);
          this.swapOutrecs(ae1, ae2);
        } else if (_ClipperBase.isHotEdge(ae2)) {
          resultOp = this.addOutPt(ae2, pt);
          this.setZ(ae1, ae2, resultOp.pt);
          this.swapOutrecs(ae1, ae2);
        } else {
          let e1Wc2, e2Wc2;
          switch (this.fillrule) {
            case FillRule.Positive:
              e1Wc2 = ae1.windCount2;
              e2Wc2 = ae2.windCount2;
              break;
            case FillRule.Negative:
              e1Wc2 = -ae1.windCount2;
              e2Wc2 = -ae2.windCount2;
              break;
            default:
              e1Wc2 = Math.abs(ae1.windCount2);
              e2Wc2 = Math.abs(ae2.windCount2);
              break;
          }
          if (!_ClipperBase.isSamePolyType(ae1, ae2)) {
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            this.setZ(ae1, ae2, resultOp.pt);
          } else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
            resultOp = null;
            switch (this.cliptype) {
              case ClipType.Union:
                if (e1Wc2 > 0 && e2Wc2 > 0)
                  return;
                resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                break;
              case ClipType.Difference:
                if (_ClipperBase.getPolyType(ae1) === PathType.Clip && e1Wc2 > 0 && e2Wc2 > 0 || _ClipperBase.getPolyType(ae1) === PathType.Subject && e1Wc2 <= 0 && e2Wc2 <= 0) {
                  resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                }
                break;
              case ClipType.Xor:
                resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                break;
              default:
                if (e1Wc2 <= 0 || e2Wc2 <= 0)
                  return;
                resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                break;
            }
            if (resultOp)
              this.setZ(ae1, ae2, resultOp.pt);
          }
        }
      }
      swapPositionsInAEL(ae1, ae2) {
        const next = ae2.nextInAEL;
        if (next !== null)
          next.prevInAEL = ae1;
        const prev = ae1.prevInAEL;
        if (prev !== null)
          prev.nextInAEL = ae2;
        ae2.prevInAEL = prev;
        ae2.nextInAEL = ae1;
        ae1.prevInAEL = ae2;
        ae1.nextInAEL = next;
        if (ae2.prevInAEL === null)
          this.actives = ae2;
      }
      isValidAelOrder(resident, newcomer) {
        if (newcomer.curX !== resident.curX) {
          return newcomer.curX > resident.curX;
        }
        const d = InternalClipper.crossProductSign(resident.top, newcomer.bot, newcomer.top);
        if (d !== 0)
          return d < 0;
        if (!_ClipperBase.isMaximaEdge(resident) && resident.top.y > newcomer.top.y) {
          return InternalClipper.crossProductSign(newcomer.bot, resident.top, _ClipperBase.nextVertex(resident).pt) <= 0;
        }
        if (!_ClipperBase.isMaximaEdge(newcomer) && newcomer.top.y > resident.top.y) {
          return InternalClipper.crossProductSign(newcomer.bot, newcomer.top, _ClipperBase.nextVertex(newcomer).pt) >= 0;
        }
        const y = newcomer.bot.y;
        const newcomerIsLeft = newcomer.isLeftBound;
        if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y) {
          return newcomer.isLeftBound;
        }
        if (resident.isLeftBound !== newcomerIsLeft) {
          return newcomerIsLeft;
        }
        if (InternalClipper.isCollinear(_ClipperBase.prevPrevVertex(resident).pt, resident.bot, resident.top))
          return true;
        return InternalClipper.crossProductSign(_ClipperBase.prevPrevVertex(resident).pt, newcomer.bot, _ClipperBase.prevPrevVertex(newcomer).pt) > 0 === newcomerIsLeft;
      }
      isJoined(e) {
        return e.joinWith !== JoinWith.None;
      }
      split(e, currPt) {
        if (e.joinWith === JoinWith.Right) {
          e.joinWith = JoinWith.None;
          e.nextInAEL.joinWith = JoinWith.None;
          this.addLocalMinPoly(e, e.nextInAEL, currPt, true);
        } else {
          e.joinWith = JoinWith.None;
          e.prevInAEL.joinWith = JoinWith.None;
          this.addLocalMinPoly(e.prevInAEL, e, currPt, true);
        }
      }
      setSides(outrec, startEdge, endEdge) {
        outrec.frontEdge = startEdge;
        outrec.backEdge = endEdge;
      }
      findEdgeWithMatchingLocMin(e) {
        var _a2, _b;
        let result = e.nextInAEL;
        while (result !== null) {
          if ((_a2 = result.localMin) == null ? void 0 : _a2.equals(e.localMin))
            return result;
          if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
            result = null;
          else
            result = result.nextInAEL;
        }
        result = e.prevInAEL;
        while (result !== null) {
          if ((_b = result.localMin) == null ? void 0 : _b.equals(e.localMin))
            return result;
          if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
            return null;
          result = result.prevInAEL;
        }
        return result;
      }
      addOutPt(ae, pt) {
        const outrec = ae.outrec;
        const toFront = _ClipperBase.isFront(ae);
        const opFront = outrec.pts;
        const opBack = opFront.next;
        if (toFront && pt.x === opFront.pt.x && pt.y === opFront.pt.y) {
          return opFront;
        } else if (!toFront && pt.x === opBack.pt.x && pt.y === opBack.pt.y) {
          return opBack;
        }
        const newOp = new OutPt(pt, outrec);
        opBack.prev = newOp;
        newOp.prev = opFront;
        newOp.next = opBack;
        opFront.next = newOp;
        if (toFront)
          outrec.pts = newOp;
        return newOp;
      }
      addLocalMaxPoly(ae1, ae2, pt) {
        if (this.isJoined(ae1))
          this.split(ae1, pt);
        if (this.isJoined(ae2))
          this.split(ae2, pt);
        if (_ClipperBase.isFront(ae1) === _ClipperBase.isFront(ae2)) {
          if (_ClipperBase.isOpenEnd(ae1)) {
            this.swapFrontBackSides(ae1.outrec);
          } else if (_ClipperBase.isOpenEnd(ae2)) {
            this.swapFrontBackSides(ae2.outrec);
          } else {
            this.succeeded = false;
            return null;
          }
        }
        const result = this.addOutPt(ae1, pt);
        if (ae1.outrec === ae2.outrec) {
          const outrec = ae1.outrec;
          outrec.pts = result;
          if (this.usingPolytree) {
            const e = _ClipperBase.getPrevHotEdge(ae1);
            if (e === null) {
              outrec.owner = null;
            } else {
              this.setOwner(outrec, e.outrec);
            }
          }
          this.uncoupleOutRec(ae1);
        } else if (_ClipperBase.isOpen(ae1)) {
          if (ae1.windDx < 0) {
            this.joinOutrecPaths(ae1, ae2);
          } else {
            this.joinOutrecPaths(ae2, ae1);
          }
        } else if (ae1.outrec.idx < ae2.outrec.idx) {
          this.joinOutrecPaths(ae1, ae2);
        } else {
          this.joinOutrecPaths(ae2, ae1);
        }
        return result;
      }
      swapFrontBackSides(outrec) {
        const ae2 = outrec.frontEdge;
        outrec.frontEdge = outrec.backEdge;
        outrec.backEdge = ae2;
        outrec.pts = outrec.pts.next;
      }
      setOwner(outrec, newOwner) {
        while (newOwner.owner !== null && newOwner.owner.pts === null) {
          newOwner.owner = newOwner.owner.owner;
        }
        let tmp = newOwner;
        while (tmp !== null && tmp !== outrec) {
          tmp = tmp.owner;
        }
        if (tmp !== null) {
          newOwner.owner = outrec.owner;
        }
        outrec.owner = newOwner;
      }
      uncoupleOutRec(ae) {
        const outrec = ae.outrec;
        if (outrec === null)
          return;
        outrec.frontEdge.outrec = null;
        outrec.backEdge.outrec = null;
        outrec.frontEdge = null;
        outrec.backEdge = null;
      }
      joinOutrecPaths(ae1, ae2) {
        const p1Start = ae1.outrec.pts;
        const p2Start = ae2.outrec.pts;
        const p1End = p1Start.next;
        const p2End = p2Start.next;
        if (_ClipperBase.isFront(ae1)) {
          p2End.prev = p1Start;
          p1Start.next = p2End;
          p2Start.next = p1End;
          p1End.prev = p2Start;
          ae1.outrec.pts = p2Start;
          ae1.outrec.frontEdge = ae2.outrec.frontEdge;
          if (ae1.outrec.frontEdge !== null) {
            ae1.outrec.frontEdge.outrec = ae1.outrec;
          }
        } else {
          p1End.prev = p2Start;
          p2Start.next = p1End;
          p1Start.next = p2End;
          p2End.prev = p1Start;
          ae1.outrec.backEdge = ae2.outrec.backEdge;
          if (ae1.outrec.backEdge !== null) {
            ae1.outrec.backEdge.outrec = ae1.outrec;
          }
        }
        ae2.outrec.frontEdge = null;
        ae2.outrec.backEdge = null;
        ae2.outrec.pts = null;
        this.setOwner(ae2.outrec, ae1.outrec);
        if (_ClipperBase.isOpenEnd(ae1)) {
          ae2.outrec.pts = ae1.outrec.pts;
          ae1.outrec.pts = null;
        }
        ae1.outrec = null;
        ae2.outrec = null;
      }
      swapOutrecs(ae1, ae2) {
        const or1 = ae1.outrec;
        const or2 = ae2.outrec;
        if (or1 === or2) {
          const ae = or1.frontEdge;
          or1.frontEdge = or1.backEdge;
          or1.backEdge = ae;
          return;
        }
        if (or1 !== null) {
          if (ae1 === or1.frontEdge) {
            or1.frontEdge = ae2;
          } else {
            or1.backEdge = ae2;
          }
        }
        if (or2 !== null) {
          if (ae2 === or2.frontEdge) {
            or2.frontEdge = ae1;
          } else {
            or2.backEdge = ae1;
          }
        }
        ae1.outrec = or2;
        ae2.outrec = or1;
      }
      disposeIntersectNodes() {
        this.intersectList.length = 0;
      }
      static ptsReallyClose(pt1, pt2) {
        return Math.abs(pt1.x - pt2.x) < 2 && Math.abs(pt1.y - pt2.y) < 2;
      }
      static isVerySmallTriangle(op) {
        return op.next.next === op.prev && (_ClipperBase.ptsReallyClose(op.prev.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.prev.pt));
      }
      static buildPath(op, reverse, isOpen, path) {
        if (op === null || op.next === op || !isOpen && op.next === op.prev)
          return false;
        path.length = 0;
        let lastPt;
        let op2;
        if (reverse) {
          lastPt = op.pt;
          op2 = op.prev;
        } else {
          op = op.next;
          lastPt = op.pt;
          op2 = op.next;
        }
        path.push(lastPt);
        while (op2 !== op) {
          if (!(op2.pt.x === lastPt.x && op2.pt.y === lastPt.y)) {
            lastPt = op2.pt;
            path.push(lastPt);
          }
          if (reverse) {
            op2 = op2.prev;
          } else {
            op2 = op2.next;
          }
        }
        return path.length !== 3 || isOpen || !_ClipperBase.isVerySmallTriangle(op2);
      }
      buildPaths(solutionClosed, solutionOpen) {
        solutionClosed.length = 0;
        solutionOpen.length = 0;
        let i = 0;
        while (i < this.outrecList.length) {
          const outrec = this.outrecList[i++];
          if (outrec.pts === null)
            continue;
          const path = [];
          if (outrec.isOpen) {
            if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path)) {
              solutionOpen.push(path);
            }
          } else {
            this.cleanCollinear(outrec);
            if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path)) {
              solutionClosed.push(path);
            }
          }
        }
        return true;
      }
      buildTree(polytree, solutionOpen) {
        polytree.clear();
        solutionOpen.length = 0;
        let i = 0;
        while (i < this.outrecList.length) {
          const outrec = this.outrecList[i++];
          if (outrec.pts === null)
            continue;
          if (outrec.isOpen) {
            const openPath = [];
            if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, openPath)) {
              solutionOpen.push(openPath);
            }
            continue;
          }
          if (this.checkBounds(outrec)) {
            this.recursiveCheckOwners(outrec, polytree);
          }
        }
      }
      checkBounds(outrec) {
        if (outrec.pts === null)
          return false;
        if (!Rect64Utils.isEmpty(outrec.bounds))
          return true;
        this.cleanCollinear(outrec);
        if (outrec.pts === null || !_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path)) {
          return false;
        }
        outrec.bounds = InternalClipper.getBounds(outrec.path);
        return true;
      }
      recursiveCheckOwners(outrec, polypath) {
        if (outrec.polypath !== null || Rect64Utils.isEmpty(outrec.bounds))
          return;
        while (outrec.owner !== null) {
          if (outrec.owner.splits !== null && this.checkSplitOwner(outrec, outrec.owner.splits))
            break;
          if (outrec.owner.pts !== null && this.checkBounds(outrec.owner) && // Fast reject: a container must contain the child's bounds.
          this.containsRect(outrec.owner.bounds, outrec.bounds) && this.path1InsidePath2(outrec.pts, outrec.owner.pts))
            break;
          outrec.owner = outrec.owner.owner;
        }
        if (outrec.owner !== null) {
          if (outrec.owner.polypath === null) {
            this.recursiveCheckOwners(outrec.owner, polypath);
          }
          outrec.polypath = outrec.owner.polypath.addChild(outrec.path);
        } else {
          outrec.polypath = polypath.addChild(outrec.path);
        }
      }
      cleanCollinear(outrec) {
        outrec = this.getRealOutRec(outrec);
        if (outrec === null || outrec.isOpen)
          return;
        if (!this.isValidClosedPath(outrec.pts)) {
          outrec.pts = null;
          return;
        }
        let startOp = outrec.pts;
        let op2 = startOp;
        while (true) {
          if (op2 !== null && InternalClipper.isCollinear(op2.prev.pt, op2.pt, op2.next.pt) && (op2.pt.x === op2.prev.pt.x && op2.pt.y === op2.prev.pt.y || op2.pt.x === op2.next.pt.x && op2.pt.y === op2.next.pt.y || !this.preserveCollinear || InternalClipper.dotProductSign(op2.prev.pt, op2.pt, op2.next.pt) < 0)) {
            if (op2 === outrec.pts) {
              outrec.pts = op2.prev;
            }
            op2 = this.disposeOutPt(op2);
            if (!this.isValidClosedPath(op2)) {
              outrec.pts = null;
              return;
            }
            startOp = op2;
            continue;
          }
          if (op2 === null)
            break;
          op2 = op2.next;
          if (op2 === startOp)
            break;
        }
        this.fixSelfIntersects(outrec);
      }
      isValidClosedPath(op) {
        return op !== null && op.next !== op && (op.next !== op.prev || !_ClipperBase.isVerySmallTriangle(op));
      }
      disposeOutPt(op) {
        const result = op.next === op ? null : op.next;
        op.prev.next = op.next;
        op.next.prev = op.prev;
        return result;
      }
      fixSelfIntersects(outrec) {
        let op2 = outrec.pts;
        if (op2.prev === op2.next.next) {
          return;
        }
        while (true) {
          if (op2.next && op2.next.next && this.boundingBoxesOverlap(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt) && InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt)) {
            if (op2 === outrec.pts || op2.next === outrec.pts) {
              outrec.pts = outrec.pts.prev;
            }
            this.doSplitOp(outrec, op2);
            if (outrec.pts === null)
              return;
            op2 = outrec.pts;
            if (op2.prev === op2.next.next)
              break;
            continue;
          }
          op2 = op2.next;
          if (op2 === outrec.pts)
            break;
        }
      }
      doSplitOp(outrec, splitOp) {
        const prevOp = splitOp.prev;
        const nextNextOp = splitOp.next.next;
        outrec.pts = prevOp;
        const ip = InternalClipper.getLineIntersectPt(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt);
        if (this.zCallbackInternal) {
          this.zCallbackInternal(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt, ip);
        }
        const doubleArea1 = _ClipperBase.areaOutPt(prevOp);
        const absDoubleArea1 = doubleArea1 < B0 ? -doubleArea1 : doubleArea1;
        if (absDoubleArea1 < B4) {
          outrec.pts = null;
          return;
        }
        const doubleArea2 = this.areaTriangle(ip, splitOp.pt, splitOp.next.pt);
        const absDoubleArea2 = doubleArea2 < B0 ? -doubleArea2 : doubleArea2;
        if (ip.x === prevOp.pt.x && ip.y === prevOp.pt.y || ip.x === nextNextOp.pt.x && ip.y === nextNextOp.pt.y) {
          nextNextOp.prev = prevOp;
          prevOp.next = nextNextOp;
        } else {
          const newOp2 = new OutPt(ip, outrec);
          newOp2.prev = prevOp;
          newOp2.next = nextNextOp;
          nextNextOp.prev = newOp2;
          prevOp.next = newOp2;
        }
        if (!(absDoubleArea2 > B2) || // area > 1
        !(absDoubleArea2 > absDoubleArea1) && doubleArea2 > B0 !== doubleArea1 > B0)
          return;
        const newOutRec = this.newOutRec();
        newOutRec.owner = outrec.owner;
        splitOp.outrec = newOutRec;
        splitOp.next.outrec = newOutRec;
        const newOp = new OutPt(ip, newOutRec);
        newOp.prev = splitOp.next;
        newOp.next = splitOp;
        newOutRec.pts = newOp;
        splitOp.prev = newOp;
        splitOp.next.next = newOp;
        if (!this.usingPolytree)
          return;
        if (this.path1InsidePath2(prevOp, newOp)) {
          if (newOutRec.splits === null)
            newOutRec.splits = [];
          newOutRec.splits.push(outrec.idx);
        } else {
          if (outrec.splits === null)
            outrec.splits = [];
          outrec.splits.push(newOutRec.idx);
        }
      }
      static areaOutPt(op) {
        const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
        let area = 0;
        let allSmall = true;
        let op2 = op;
        do {
          const prev = op2.prev;
          const pt = op2.pt;
          if (Math.abs(prev.pt.x) >= maxCoord || Math.abs(prev.pt.y) >= maxCoord || Math.abs(pt.x) >= maxCoord || Math.abs(pt.y) >= maxCoord) {
            allSmall = false;
            break;
          }
          area += (prev.pt.y + pt.y) * (prev.pt.x - pt.x);
          op2 = op2.next;
        } while (op2 !== op);
        if (allSmall) {
          return BigInt(Math.round(area));
        }
        let areaBig = B0;
        op2 = op;
        do {
          const prev = op2.prev;
          if (Number.isSafeInteger(prev.pt.y) && Number.isSafeInteger(op2.pt.y) && Number.isSafeInteger(prev.pt.x) && Number.isSafeInteger(op2.pt.x)) {
            const sumBig = BigInt(prev.pt.y) + BigInt(op2.pt.y);
            const diffBig = BigInt(prev.pt.x) - BigInt(op2.pt.x);
            areaBig += sumBig * diffBig;
          } else {
            const sum = prev.pt.y + op2.pt.y;
            const diff = prev.pt.x - op2.pt.x;
            areaBig += BigInt(Math.round(sum * diff));
          }
          op2 = op2.next;
        } while (op2 !== op);
        return areaBig;
      }
      areaTriangle(pt1, pt2, pt3) {
        const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
        if (Math.abs(pt1.x) < maxCoord && Math.abs(pt1.y) < maxCoord && Math.abs(pt2.x) < maxCoord && Math.abs(pt2.y) < maxCoord && Math.abs(pt3.x) < maxCoord && Math.abs(pt3.y) < maxCoord) {
          const area2 = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
          return BigInt(Math.round(area2));
        }
        if (Number.isSafeInteger(pt1.x) && Number.isSafeInteger(pt1.y) && Number.isSafeInteger(pt2.x) && Number.isSafeInteger(pt2.y) && Number.isSafeInteger(pt3.x) && Number.isSafeInteger(pt3.y)) {
          const term1 = (BigInt(pt3.y) + BigInt(pt1.y)) * (BigInt(pt3.x) - BigInt(pt1.x));
          const term2 = (BigInt(pt1.y) + BigInt(pt2.y)) * (BigInt(pt1.x) - BigInt(pt2.x));
          const term3 = (BigInt(pt2.y) + BigInt(pt3.y)) * (BigInt(pt2.x) - BigInt(pt3.x));
          return term1 + term2 + term3;
        }
        const area = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
        return BigInt(Math.round(area));
      }
      isValidOwner(outRec, testOwner) {
        while (testOwner !== null && testOwner !== outRec) {
          testOwner = testOwner.owner;
        }
        return testOwner === null;
      }
      containsRect(rect, rec) {
        return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
      }
      checkSplitOwner(outrec, splits) {
        for (let i = 0; i < splits.length; i++) {
          let split = this.outrecList[splits[i]];
          if (split.pts === null && split.splits !== null && this.checkSplitOwner(outrec, split.splits))
            return true;
          split = this.getRealOutRec(split);
          if (split === null || split === outrec || split.recursiveSplit === outrec)
            continue;
          split.recursiveSplit = outrec;
          if (split.splits !== null && this.checkSplitOwner(outrec, split.splits))
            return true;
          if (!this.checkBounds(split) || !this.containsRect(split.bounds, outrec.bounds) || !this.path1InsidePath2(outrec.pts, split.pts))
            continue;
          if (!this.isValidOwner(outrec, split)) {
            split.owner = outrec.owner;
          }
          outrec.owner = split;
          return true;
        }
        return false;
      }
    };
    // When there are no open paths, a lot of open-path branching becomes dead code.
    // We set this per execute to allow fast short-circuiting in hot helpers.
    __publicField(_ClipperBase, "openPathsEnabled", true);
    let ClipperBase = _ClipperBase;
    class Clipper64 extends ClipperBase {
      constructor() {
        super(...arguments);
        __publicField(this, "zCallback");
      }
      getZCallback() {
        return this.zCallback;
      }
      addPath(path, polytype, isOpen = false) {
        super.addPath(path, polytype, isOpen);
      }
      addReuseableData(reuseableData) {
        super.addReuseableData(reuseableData);
      }
      addPaths(paths, polytype, isOpen = false) {
        super.addPaths(paths, polytype, isOpen);
      }
      addSubject(paths) {
        this.addPaths(paths, PathType.Subject);
      }
      addOpenSubject(paths) {
        this.addPaths(paths, PathType.Subject, true);
      }
      addClip(paths) {
        this.addPaths(paths, PathType.Clip);
      }
      execute(clipType, fillRule, solutionOrTree, openPathsOrSolutionOpen) {
        if (Array.isArray(solutionOrTree)) {
          const solutionClosed = solutionOrTree;
          const solutionOpen = openPathsOrSolutionOpen;
          solutionClosed.length = 0;
          if (solutionOpen)
            solutionOpen.length = 0;
          try {
            this.executeInternal(clipType, fillRule);
            this.buildPaths(solutionClosed, solutionOpen || []);
          } catch {
            this.succeeded = false;
          }
          this.clearSolutionOnly();
          return this.succeeded;
        } else {
          const polytree = solutionOrTree;
          const openPaths = openPathsOrSolutionOpen;
          polytree.clear();
          if (openPaths)
            openPaths.length = 0;
          this.usingPolytree = true;
          try {
            this.executeInternal(clipType, fillRule);
            this.buildTree(polytree, openPaths || []);
          } catch {
            this.succeeded = false;
          }
          this.clearSolutionOnly();
          return this.succeeded;
        }
      }
    }
    BigInt(2);
    function union$1(subject, clipOrFillRule, fillRule) {
      if (typeof clipOrFillRule === "number") {
        return booleanOp(ClipType.Union, subject, null, clipOrFillRule);
      } else {
        return booleanOp(ClipType.Union, subject, clipOrFillRule, fillRule);
      }
    }
    function booleanOp(clipType, subject, clip, fillRule) {
      const solution = [];
      if (subject === null)
        return solution;
      const c = new Clipper64();
      c.addPaths(subject, PathType.Subject);
      if (clip !== null) {
        c.addPaths(clip, PathType.Clip);
      }
      c.execute(clipType, fillRule, solution);
      return solution;
    }
    function normalizeHatchRegion(hatch, tolerance) {
      const safeTolerance = Math.max(1e-9, tolerance);
      const contours = [];
      for (const path of hatch.boundaryPaths) {
        const segments = [];
        for (const edge of path.edges) {
          const points = flattenHatchEdge(edge, safeTolerance);
          for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1];
            const end = points[index];
            if (Math.hypot(end[0] - start[0], end[1] - start[1]) > safeTolerance) segments.push({ start, end });
          }
        }
        const assembled = assembleContours(segments, safeTolerance);
        if (!assembled) return { status: "invalid", code: "HATCH_BOUNDARY_OPEN" };
        contours.push(...assembled);
      }
      if (contours.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
      const largest = Math.max(...contours.flatMap((contour) => contour.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])), 1);
      const requestedScale = Math.max(1, Math.ceil(1 / safeTolerance));
      const maxScale = Math.floor(Number.MAX_SAFE_INTEGER / 1024 / largest);
      const scale2 = Math.min(requestedScale, maxScale);
      if (!(scale2 >= 1)) return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
      try {
        const paths = contours.map((contour) => contour.map(([x, y]) => ({ x: Math.round(x * scale2), y: Math.round(y * scale2) })));
        const normalized = union$1(paths, FillRule.EvenOdd).map((path) => path.map(({ x, y }) => [x / scale2, y / scale2])).filter((path) => path.length >= 3);
        if (normalized.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
        const selected = selectByStyle(normalized, hatch.style);
        return {
          status: "ok",
          region: { contours: selected, fillRule: hatch.style === "normal" ? "evenodd" : "nonzero", bounds: boundsOf(selected) }
        };
      } catch {
        return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
      }
    }
    function assembleContours(segments, tolerance) {
      if (segments.length < 3) return null;
      const key = ([x, y]) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
      const incidence = /* @__PURE__ */ new Map();
      segments.forEach((segment, index) => {
        for (const point3 of [segment.start, segment.end]) {
          const bucket = incidence.get(key(point3)) ?? [];
          bucket.push(index);
          incidence.set(key(point3), bucket);
        }
      });
      if ([...incidence.values()].some((indices) => indices.length !== 2)) return null;
      const unused = new Set(segments.map((_, index) => index));
      const contours = [];
      while (unused.size > 0) {
        const firstIndex = unused.values().next().value;
        const first = segments[firstIndex];
        unused.delete(firstIndex);
        const contour = [first.start, first.end];
        const startKey = key(first.start);
        let currentKey = key(first.end);
        while (currentKey !== startKey) {
          const nextIndex = (incidence.get(currentKey) ?? []).find((index) => unused.has(index));
          if (nextIndex === void 0) return null;
          const next = segments[nextIndex];
          unused.delete(nextIndex);
          const nextPoint = key(next.start) === currentKey ? next.end : next.start;
          contour.push(nextPoint);
          currentKey = key(nextPoint);
          if (contour.length > segments.length + 1) return null;
        }
        contour.pop();
        if (contour.length < 3) return null;
        contours.push(contour);
      }
      return contours;
    }
    function selectByStyle(contours, style) {
      if (style === "normal") return contours;
      const depths = contours.map((contour, index) => contours.reduce((depth, candidate, candidateIndex) => candidateIndex !== index && pointInPolygon(contour[0], candidate) ? depth + 1 : depth, 0));
      if (style === "outer") return contours.filter((_, index) => (depths[index] ?? 0) <= 1);
      return contours.filter((_, index) => (depths[index] ?? 0) === 0);
    }
    function pointInPolygon(point3, polygon) {
      let inside = false;
      for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const a = polygon[index];
        const b = polygon[previous];
        if (a[1] > point3[1] !== b[1] > point3[1] && point3[0] < (b[0] - a[0]) * (point3[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    }
    function boundsOf(contours) {
      const points = contours.flat();
      return {
        minX: Math.min(...points.map(([x]) => x)),
        minY: Math.min(...points.map(([, y]) => y)),
        maxX: Math.max(...points.map(([x]) => x)),
        maxY: Math.max(...points.map(([, y]) => y))
      };
    }
    const MAX_HATCH_RENDER_LINES = 2e4;
    function createHatchRenderPlan(hatch, tolerance) {
      const normalized = normalizeHatchRegion(hatch, tolerance);
      if (normalized.status !== "ok") return normalized;
      const lines = [];
      for (const family of hatch.patternLines) {
        const generated = generateFamily(transformPatternFamily(family, hatch.patternAngle, hatch.patternScale), normalized.region);
        if (lines.length + generated.length > MAX_HATCH_RENDER_LINES) {
          return { status: "invalid", code: "HATCH_PATTERN_DENSITY_LIMIT" };
        }
        lines.push(...generated);
      }
      return { status: "ok", plan: { region: normalized.region, lines } };
    }
    function transformPatternFamily(family, angleDegrees, scale2) {
      const angle = angleDegrees * Math.PI / 180;
      const rotateScale = ([x, y]) => [
        scale2 * (x * Math.cos(angle) - y * Math.sin(angle)),
        scale2 * (x * Math.sin(angle) + y * Math.cos(angle))
      ];
      return {
        angle: family.angle + angleDegrees,
        base: rotateScale(family.base),
        offset: rotateScale(family.offset),
        dashLengths: family.dashLengths.map((value) => value * scale2)
      };
    }
    function generateFamily(family, region) {
      const angle = family.angle * Math.PI / 180;
      const direction = [Math.cos(angle), Math.sin(angle)];
      const normal = [-direction[1], direction[0]];
      const spacing = dot(family.offset, normal);
      if (Math.abs(spacing) <= 1e-12) return [];
      const corners = [
        [region.bounds.minX, region.bounds.minY],
        [region.bounds.maxX, region.bounds.minY],
        [region.bounds.maxX, region.bounds.maxY],
        [region.bounds.minX, region.bounds.maxY]
      ];
      const cornerProjections = corners.map((point3) => dot(point3, normal));
      const baseProjection = dot(family.base, normal);
      const minIndex = Math.floor((Math.min(...cornerProjections) - baseProjection) / spacing) - 1;
      const maxIndex = Math.ceil((Math.max(...cornerProjections) - baseProjection) / spacing) + 1;
      const first = Math.min(minIndex, maxIndex);
      const last = Math.max(minIndex, maxIndex);
      const diagonal = Math.hypot(region.bounds.maxX - region.bounds.minX, region.bounds.maxY - region.bounds.minY);
      const alongProjections = corners.map((point3) => dot(point3, direction));
      const minimumAlong = Math.min(...alongProjections) - Math.max(1, diagonal * 0.01);
      const maximumAlong = Math.max(...alongProjections) + Math.max(1, diagonal * 0.01);
      const result = [];
      for (let index = first; index <= last; index += 1) {
        const origin = [family.base[0] + family.offset[0] * index, family.base[1] + family.offset[1] * index];
        const originAlong = dot(origin, direction);
        const startDistance = minimumAlong - originAlong;
        const endDistance = maximumAlong - originAlong;
        result.push({
          start: [origin[0] + direction[0] * startDistance, origin[1] + direction[1] * startDistance],
          end: [origin[0] + direction[0] * endDistance, origin[1] + direction[1] * endDistance],
          dashArray: family.dashLengths.map(Math.abs),
          dashOffset: startDistance
        });
      }
      return result;
    }
    function dot(a, b) {
      return a[0] * b[0] + a[1] * b[1];
    }
    const MIN_SCALE = 0.01;
    const MAX_SCALE = 1e3;
    function screenToWorld(point3, viewport) {
      return [
        (point3[0] - viewport.x) / viewport.scale,
        (viewport.y - point3[1]) / viewport.scale
      ];
    }
    function zoomViewportAt(viewport, screenPoint, factor) {
      const anchor = screenToWorld(screenPoint, viewport);
      const scale2 = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
      return {
        ...viewport,
        scale: scale2,
        x: screenPoint[0] - anchor[0] * scale2,
        y: screenPoint[1] + anchor[1] * scale2
      };
    }
    function fitViewportToDrawing(document2, size, padding = 1.2) {
      const bounds = drawingBounds(document2) ?? { minX: -50, minY: -50, maxX: 50, maxY: 50 };
      const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
      const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
      const safePadding = Number.isFinite(padding) && padding > 0 ? padding : 1.2;
      const scale2 = clamp(Math.min(
        Math.max(size.width, 1) / (boundsWidth * safePadding),
        Math.max(size.height, 1) / (boundsHeight * safePadding)
      ), MIN_SCALE, MAX_SCALE);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      return {
        x: size.width / 2 - centerX * scale2,
        y: size.height / 2 + centerY * scale2,
        scale: scale2,
        width: size.width,
        height: size.height
      };
    }
    function drawingBounds(document2) {
      const bounds = [...document2.geometry, ...document2.annotations].filter((node) => node.visible).map(nodeBounds).filter((value) => value !== null);
      return unionBounds(bounds);
    }
    function nodesInWorldBox(document2, box) {
      return [...document2.geometry, ...document2.annotations].filter((node) => node.visible).filter((node) => {
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
          return arcBounds$1(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
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
        case "section-hatch": {
          if (node.hatch !== void 0) {
            const normalized = normalizeHatchRegion(node.hatch, 1e-3);
            return normalized.status === "ok" ? normalized.region.bounds : null;
          }
          return boundsFromPoints((node.segments ?? []).flatMap(({ start, end }) => [start, end]));
        }
      }
    }
    function worldBoundsForViewport(viewport) {
      const first = screenToWorld([0, 0], viewport);
      const second = screenToWorld([viewport.width, viewport.height], viewport);
      return normalizeBounds$1(first, second);
    }
    function finiteCircleBounds(center, radius) {
      if (!finitePoint$1(center) || !Number.isFinite(radius) || radius < 0) return null;
      return {
        minX: center[0] - radius,
        minY: center[1] - radius,
        maxX: center[0] + radius,
        maxY: center[1] + radius
      };
    }
    function arcBounds$1(center, radius, start, end, counterClockwise) {
      if (finiteCircleBounds(center, radius) === null || !Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }
      const candidates = [start, end, ...[0, 90, 180, 270].filter((angle) => angleOnArc$1(angle, start, end, counterClockwise))];
      return boundsFromPoints(candidates.map((angle) => {
        const radians = angle * Math.PI / 180;
        return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
      }));
    }
    function ellipseBounds(node) {
      if (!finitePoint$1(node.center) || !finitePoint$1(node.majorAxis) || !Number.isFinite(node.ratio) || node.ratio <= 0) return null;
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
      if (!finitePoint$1(node.position) || !Number.isFinite(node.height) || !Number.isFinite(node.rotation)) {
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
      if (points.length === 0 || points.some((point3) => !finitePoint$1(point3))) return null;
      return {
        minX: Math.min(...points.map((point3) => point3[0])),
        minY: Math.min(...points.map((point3) => point3[1])),
        maxX: Math.max(...points.map((point3) => point3[0])),
        maxY: Math.max(...points.map((point3) => point3[1]))
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
    function angleOnArc$1(angle, start, end, counterClockwise) {
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
    function finitePoint$1(point3) {
      return Number.isFinite(point3[0]) && Number.isFinite(point3[1]);
    }
    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }
    function HatchRenderer({ node, viewportScale }) {
      const clipId = `vai-hatch-${react.useId().replace(/:/g, "")}`;
      const vectorStroke = { vectorEffect: "non-scaling-stroke" };
      if (node.hatch === void 0) {
        return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-section-hatch": node.pattern, children: (node.segments ?? []).map((segment, index) => /* @__PURE__ */ jsxRuntime.jsx("line", { x1: segment.start[0], y1: segment.start[1], x2: segment.end[0], y2: segment.end[1], ...vectorStroke }, index)) });
      }
      const tolerance = Math.min(0.05, Math.max(1e-6, 0.25 / Math.max(viewportScale, 1e-9)));
      const result = createHatchRenderPlan(node.hatch, tolerance);
      if (result.status !== "ok") return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-section-hatch": node.pattern, "data-hatch-error": result.code });
      const path = result.plan.region.contours.map(contourPath).join(" ");
      return /* @__PURE__ */ jsxRuntime.jsxs("g", { "data-section-hatch": node.pattern, "data-hatch-representation": "parametric", children: [
        /* @__PURE__ */ jsxRuntime.jsx("defs", { children: /* @__PURE__ */ jsxRuntime.jsx("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse", children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: path, fillRule: result.plan.region.fillRule, clipRule: result.plan.region.fillRule }) }) }),
        result.plan.lines.map((line, index) => /* @__PURE__ */ jsxRuntime.jsx(
          "line",
          {
            x1: line.start[0],
            y1: line.start[1],
            x2: line.end[0],
            y2: line.end[1],
            clipPath: `url(#${clipId})`,
            strokeDasharray: line.dashArray.length === 0 ? void 0 : line.dashArray.join(" "),
            strokeDashoffset: line.dashOffset,
            ...vectorStroke
          },
          index
        ))
      ] });
    }
    function contourPath(points) {
      if (points.length === 0) return "";
      return `M ${points[0][0]} ${points[0][1]} ${points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ")} Z`;
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
          return /* @__PURE__ */ jsxRuntime.jsx(HatchRenderer, { node, viewportScale: viewport.scale });
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
      return points.map((point3) => `${point3[0]},${point3[1]}`).join(" ");
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
      const point3 = (angle) => {
        const radians = angle * Math.PI / 180;
        return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
      };
      const first = point3(start);
      const last = point3(end);
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
    function MotionRigOverlay({
      rig,
      viewportScale,
      connectorHandles = [],
      onHandleMouseDown,
      onConnectorMouseDown
    }) {
      const scale2 = Math.max(viewportScale, 1e-3);
      const { anchor, handle } = rig.projection;
      const status = rig.phase === "preview" ? "等待确认" : rig.message ?? "拖动控制点调整部件";
      return /* @__PURE__ */ jsxRuntime.jsxs("g", { className: `vai-motion-rig vai-motion-rig--${rig.phase}`, "data-motion-rig-state": rig.phase, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "line",
          {
            className: "vai-motion-rig__guide",
            x1: anchor[0],
            y1: anchor[1],
            x2: handle[0],
            y2: handle[1],
            vectorEffect: "non-scaling-stroke",
            pointerEvents: "none"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "circle",
          {
            "data-motion-rig-anchor": true,
            className: "vai-motion-rig__anchor",
            cx: anchor[0],
            cy: anchor[1],
            r: 6 / scale2,
            vectorEffect: "non-scaling-stroke",
            pointerEvents: "none"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "circle",
          {
            role: "button",
            "aria-label": "拖动可动部件",
            tabIndex: 0,
            className: "vai-motion-rig__handle",
            cx: handle[0],
            cy: handle[1],
            r: 8 / scale2,
            vectorEffect: "non-scaling-stroke",
            onMouseDown: (event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              onHandleMouseDown(event);
            }
          }
        ),
        connectorHandles.map(({ nodeId, point: point3 }) => /* @__PURE__ */ jsxRuntime.jsx(
          "circle",
          {
            role: "button",
            "aria-label": `调整 ${nodeId} 与可动部件的接点`,
            tabIndex: 0,
            className: "vai-motion-rig__connector-handle",
            cx: point3[0],
            cy: point3[1],
            r: 5 / scale2,
            vectorEffect: "non-scaling-stroke",
            onMouseDown: (event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              onConnectorMouseDown == null ? void 0 : onConnectorMouseDown(nodeId, event);
            }
          },
          nodeId
        )),
        /* @__PURE__ */ jsxRuntime.jsx("g", { transform: `translate(${handle[0]} ${handle[1] + 14 / scale2}) scale(1 -1)`, pointerEvents: "none", children: /* @__PURE__ */ jsxRuntime.jsx(
          "text",
          {
            "data-motion-rig-status": rig.phase,
            className: "vai-motion-rig__status",
            fontSize: 11 / scale2,
            textAnchor: "middle",
            children: status
          }
        ) })
      ] });
    }
    function SourceUnderlay({
      source,
      resource,
      document: document2
    }) {
      const sourceFrame = document2.coordinateFrames.find((frame) => frame.kind === "source" && frame.id === `frame_source_${safeId(source.id)}`) ?? document2.coordinateFrames.find((frame) => frame.kind === "source");
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
    function Canvas({ motionPreviewHeld = false }) {
      const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
      const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const groundingOverlay = useDrawingWorkspace((state) => state.groundingOverlay);
      const motionRig = useDrawingWorkspace((state) => state.motionRig);
      const sourceResource = useDrawingWorkspace((state) => state.sourceResource);
      const viewport = useDrawingWorkspace((state) => state.viewport);
      const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
      const display = useDrawingWorkspace((state) => state.display);
      const setViewport = useDrawingWorkspace((state) => state.setViewport);
      const setMouseWorld = useDrawingWorkspace((state) => state.setMouseWorld);
      const setSelection = useDrawingWorkspace((state) => state.setSelection);
      const moveAnnotationText = useDrawingWorkspace((state) => state.moveAnnotationText);
      const rebuildMotionRigFromSelection = useDrawingWorkspace((state) => state.rebuildMotionRigFromSelection);
      const beginMotionRigDrag = useDrawingWorkspace((state) => state.beginMotionRigDrag);
      const beginMotionRigConnectorDrag = useDrawingWorkspace((state) => state.beginMotionRigConnectorDrag);
      const updateMotionRigDrag = useDrawingWorkspace((state) => state.updateMotionRigDrag);
      const finishMotionRigDrag = useDrawingWorkspace((state) => state.finishMotionRigDrag);
      const resetMotionRigDrag = useDrawingWorkspace((state) => state.resetMotionRigDrag);
      const cancelMotionRig = useDrawingWorkspace((state) => state.cancelMotionRig);
      const containerRef = react.useRef(null);
      const dragRef = react.useRef(null);
      const spacePressed = react.useRef(false);
      const [selectionBox, setSelectionBox] = react.useState(null);
      const document2 = snapshot == null ? void 0 : snapshot.document;
      react.useEffect(() => {
        const element = containerRef.current;
        if (element === null) return;
        const preventConversationScroll = (event) => event.preventDefault();
        element.addEventListener("wheel", preventConversationScroll, { passive: false });
        return () => element.removeEventListener("wheel", preventConversationScroll);
      }, []);
      react.useEffect(() => {
        const element = containerRef.current;
        if (element === null || document2 === void 0 || typeof ResizeObserver === "undefined") return;
        const resize = () => {
          const { width, height } = element.getBoundingClientRect();
          if (!(width > 0 && height > 0)) return;
          if (viewport.width === 0 || viewport.height === 0) {
            setViewport(fitViewportToDrawing(document2, { width, height }));
          } else if (viewport.width !== width || viewport.height !== height) {
            setViewport({ ...viewport, width, height });
          }
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
      }, [document2, setViewport, viewport]);
      if (snapshot === null) return null;
      const entities = [
        ...snapshot.document.geometry,
        ...display.annotations ? snapshot.document.annotations : []
      ];
      const groundedNodeIds = new Set(
        (groundingOverlay == null ? void 0 : groundingOverlay.groups.filter((group) => group.role !== "reference").flatMap((group) => group.nodeIds)) ?? []
      );
      const motionRigNodeIds = /* @__PURE__ */ new Set([
        ...(motionRig == null ? void 0 : motionRig.projection.controlBodyNodeIds) ?? [],
        ...(motionRig == null ? void 0 : motionRig.projection.connectors.map(({ nodeId }) => nodeId)) ?? []
      ]);
      const motionRigConnectorHandles = (motionRig == null ? void 0 : motionRig.projection.connectors.flatMap((binding) => {
        const node = snapshot.document.geometry.find(({ id }) => String(id) === binding.nodeId);
        if (!node) return [];
        const point3 = connectorMovingPoint(node, binding.movingEndpoint);
        return point3 === null ? [] : [{ nodeId: binding.nodeId, point: point3 }];
      })) ?? [];
      const motionPreviewBeforeEntities = !motionPreviewHeld || formalSnapshot === null || motionRig === null ? [] : [...motionRigNodeIds].flatMap((id) => {
        const before = formalSnapshot.document.geometry.find((node) => String(node.id) === id);
        const after = snapshot.document.geometry.find((node) => String(node.id) === id);
        return before === void 0 || after === void 0 || drawingNodesEqual(before, after) ? [] : [before];
      });
      const previewBeforeEntities = motionPreviewHeld || preview === null || formalSnapshot === null ? [] : [
        ...formalSnapshot.document.geometry,
        ...display.annotations ? formalSnapshot.document.annotations : []
      ].filter((node) => preview.diff.updatedNodeIds.includes(node.id) || preview.diff.deletedNodeIds.includes(node.id));
      const previewMotion = motionPreviewHeld || preview === null || formalSnapshot === null ? [] : preview.diff.updatedNodeIds.flatMap((id) => {
        const before = [...formalSnapshot.document.geometry, ...formalSnapshot.document.annotations].find((node) => node.id === id);
        const after = [...snapshot.document.geometry, ...snapshot.document.annotations].find((node) => node.id === id);
        const first = before === void 0 ? null : nodeBounds(before);
        const second = after === void 0 ? null : nodeBounds(after);
        if (first === null || second === null) return [];
        const from = [(first.minX + first.maxX) / 2, (first.minY + first.maxY) / 2];
        const to = [(second.minX + second.maxX) / 2, (second.minY + second.maxY) / 2];
        return Math.hypot(from[0] - to[0], from[1] - to[1]) <= 1e-9 ? [] : [{ id, from, to }];
      });
      const handleWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const point3 = eventScreenPoint(event);
        setViewport(zoomViewportAt(viewport, point3, event.deltaY < 0 ? 1.1 : 1 / 1.1));
      };
      const handleCanvasMouseDown = (event) => {
        const point3 = eventScreenPoint(event);
        const boxSelect = event.button === 0 && (event.metaKey || event.ctrlKey) && !spacePressed.current;
        if (event.button === 1 || event.button === 0 && !boxSelect) {
          event.preventDefault();
          dragRef.current = {
            kind: "pan",
            start: point3,
            viewport,
            clearSelectionOnClick: event.button === 0 && isBlankCanvasTarget(event)
          };
          return;
        }
        if (!boxSelect) return;
        dragRef.current = {
          kind: "box",
          start: point3,
          current: point3,
          additive: true
        };
        setSelectionBox({ start: point3, current: point3 });
      };
      const handleMouseMove = (event) => {
        const point3 = eventScreenPoint(event);
        setMouseWorld(screenToWorld(point3, viewport));
        const drag = dragRef.current;
        if (drag === null) return;
        if (drag.kind === "pan") {
          setViewport({
            ...drag.viewport,
            x: drag.viewport.x + point3[0] - drag.start[0],
            y: drag.viewport.y + point3[1] - drag.start[1]
          });
          return;
        }
        if (drag.kind === "box") {
          drag.current = point3;
          setSelectionBox({ start: drag.start, current: point3 });
          return;
        }
        if (drag.kind === "motion-rig") {
          drag.currentWorld = screenToWorld(point3, viewport);
          updateMotionRigDrag(drag.currentWorld);
          return;
        }
        drag.currentWorld = screenToWorld(point3, viewport);
      };
      const handleMouseUp = (event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag === null) return;
        if (drag.kind === "pan") {
          const point3 = eventScreenPoint(event);
          const distance2 = Math.hypot(point3[0] - drag.start[0], point3[1] - drag.start[1]);
          if (drag.clearSelectionOnClick && distance2 < 3) setSelection([]);
          return;
        }
        if (drag.kind === "box") {
          const point3 = eventScreenPoint(event);
          const distance2 = Math.hypot(point3[0] - drag.start[0], point3[1] - drag.start[1]);
          if (distance2 < 3) {
            if (!drag.additive) setSelection([]);
          } else {
            const first = screenToWorld(drag.start, viewport);
            const second = screenToWorld(point3, viewport);
            const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
            const nextSelection = drag.additive ? [...selectedIds, ...ids] : ids;
            setSelection(nextSelection);
            if (motionRig !== null && nextSelection.length > 0) {
              queueMicrotask(() => {
                void rebuildMotionRigFromSelection();
              });
            }
          }
          setSelectionBox(null);
          return;
        }
        if (drag.kind === "motion-rig") {
          finishMotionRigDrag();
          return;
        }
        if (drag.kind === "annotation") {
          if (Math.hypot(
            drag.currentWorld[0] - drag.startWorld[0],
            drag.currentWorld[1] - drag.startWorld[1]
          ) > 1e-3) {
            void moveAnnotationText(drag.id, drag.currentWorld);
          }
        }
      };
      const handleKeyDown = (event) => {
        var _a2;
        if (event.code === "Space") {
          spacePressed.current = true;
          event.preventDefault();
        }
        if (event.key === "Escape") {
          if (((_a2 = dragRef.current) == null ? void 0 : _a2.kind) === "motion-rig") {
            dragRef.current = null;
            resetMotionRigDrag();
            return;
          }
          if (motionRig !== null) {
            void cancelMotionRig();
            return;
          }
          dragRef.current = null;
          setSelectionBox(null);
          setSelection([]);
        }
      };
      const handleEntitySelect = (id, event) => {
        event.stopPropagation();
        const nextSelection = event.metaKey || event.ctrlKey ? selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id] : [id];
        setSelection(nextSelection);
        if (motionRig !== null && nextSelection.length > 0) {
          queueMicrotask(() => {
            void rebuildMotionRigFromSelection();
          });
        }
      };
      const handleMotionRigPointerDown = (event) => {
        const point3 = eventScreenPoint(event);
        const world = screenToWorld(point3, viewport);
        beginMotionRigDrag(world);
        dragRef.current = { kind: "motion-rig", startWorld: world, currentWorld: world };
      };
      const handleMotionRigConnectorPointerDown = (nodeId, event) => {
        const point3 = eventScreenPoint(event);
        const world = screenToWorld(point3, viewport);
        beginMotionRigConnectorDrag(nodeId, world);
        dragRef.current = { kind: "motion-rig", startWorld: world, currentWorld: world };
      };
      const handleAnnotationPointerDown = (annotation, event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const point3 = eventScreenPoint(event);
        const world = screenToWorld(point3, viewport);
        dragRef.current = { kind: "annotation", id: annotation.id, startWorld: world, currentWorld: world };
        setSelection([annotation.id]);
      };
      return /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          ref: containerRef,
          className: "vai-canvas",
          "data-canvas-root": "true",
          "data-motion-preview-held": motionPreviewHeld || void 0,
          role: "application",
          "aria-label": "可交互图纸画布",
          tabIndex: 0,
          onKeyDown: handleKeyDown,
          onKeyUp: (event) => {
            if (event.code === "Space") spacePressed.current = false;
          },
          children: /* @__PURE__ */ jsxRuntime.jsxs(
            "svg",
            {
              className: "vai-canvas__svg",
              width: "100%",
              height: "100%",
              "aria-label": "图纸画布",
              onWheel: handleWheel,
              onMouseDown: handleCanvasMouseDown,
              onMouseMove: handleMouseMove,
              onMouseUp: handleMouseUp,
              onMouseLeave: () => setMouseWorld(null),
              onDoubleClick: () => setViewport(fitViewportToDrawing(snapshot.document, viewport)),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(CadGrid, { viewport, showGrid: display.grid, showAxes: display.axes }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "rect",
                  {
                    "data-canvas-background": "true",
                    width: "100%",
                    height: "100%",
                    fill: "transparent"
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsxs("g", { transform: `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`, children: [
                  /* @__PURE__ */ jsxRuntime.jsx("defs", { children: /* @__PURE__ */ jsxRuntime.jsx("marker", { id: "vai-preview-motion-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M 0 0 L 10 5 L 0 10 z" }) }) }),
                  display.sourceUnderlay && snapshot.source !== void 0 && isRasterDrawingSource(snapshot.source) && sourceResource !== null ? /* @__PURE__ */ jsxRuntime.jsx(
                    SourceUnderlay,
                    {
                      source: snapshot.source,
                      resource: sourceResource,
                      document: snapshot.document
                    }
                  ) : null,
                  display.relations ? /* @__PURE__ */ jsxRuntime.jsx(RelationLayer, { document: snapshot.document, viewport }) : null,
                  motionPreviewBeforeEntities.map((node) => /* @__PURE__ */ jsxRuntime.jsx(
                    "g",
                    {
                      className: "vai-motion-preview__before",
                      "data-motion-preview-before": node.id,
                      pointerEvents: "none",
                      children: /* @__PURE__ */ jsxRuntime.jsx(
                        EntityRenderer,
                        {
                          node,
                          viewport,
                          selected: false,
                          onSelect: () => {
                          }
                        }
                      )
                    },
                    `motion-preview-before:${node.id}`
                  )),
                  previewBeforeEntities.map((node) => /* @__PURE__ */ jsxRuntime.jsx(
                    EntityRenderer,
                    {
                      node,
                      viewport,
                      selected: false,
                      previewDiff: (preview == null ? void 0 : preview.diff.deletedNodeIds.includes(node.id)) ? "deleted" : "before",
                      onSelect: () => {
                      }
                    },
                    `preview-before:${node.id}`
                  )),
                  previewMotion.map(({ id, from, to }) => /* @__PURE__ */ jsxRuntime.jsx(
                    "line",
                    {
                      "data-motion-vector": id,
                      className: "vai-preview-motion",
                      x1: from[0],
                      y1: from[1],
                      x2: to[0],
                      y2: to[1],
                      vectorEffect: "non-scaling-stroke",
                      markerEnd: "url(#vai-preview-motion-arrow)",
                      pointerEvents: "none"
                    },
                    `preview-motion:${id}`
                  )),
                  entities.map((node) => /* @__PURE__ */ jsxRuntime.jsx(
                    EntityRenderer,
                    {
                      node,
                      viewport,
                      selected: !motionPreviewHeld && selectedIds.includes(node.id),
                      aiGrounded: !motionPreviewHeld && groundedNodeIds.has(node.id),
                      motionRigActive: !motionPreviewHeld && motionRigNodeIds.has(node.id),
                      previewDiff: motionPreviewHeld ? void 0 : (preview == null ? void 0 : preview.diff.createdNodeIds.includes(node.id)) ? "created" : (preview == null ? void 0 : preview.diff.updatedNodeIds.includes(node.id)) ? "updated" : void 0,
                      onSelect: (event) => handleEntitySelect(node.id, event),
                      onTextPointerDown: node.type === "text" || node.type === "dimension" ? (event) => handleAnnotationPointerDown(node, event) : void 0
                    },
                    node.id
                  )),
                  motionRig === null || motionPreviewHeld ? null : /* @__PURE__ */ jsxRuntime.jsx(
                    MotionRigOverlay,
                    {
                      rig: motionRig,
                      viewportScale: viewport.scale,
                      connectorHandles: motionRigConnectorHandles,
                      onHandleMouseDown: handleMotionRigPointerDown,
                      onConnectorMouseDown: handleMotionRigConnectorPointerDown
                    }
                  )
                ] }),
                selectionBox === null || motionPreviewHeld ? null : /* @__PURE__ */ jsxRuntime.jsx(SelectionBox, { box: selectionBox })
              ]
            }
          )
        }
      );
    }
    function drawingNodesEqual(first, second) {
      return JSON.stringify(first) === JSON.stringify(second);
    }
    function connectorMovingPoint(node, movingEndpoint2) {
      var _a2, _b;
      if (node.type === "line") {
        if (movingEndpoint2 === "start" || movingEndpoint2 === "end") return node[movingEndpoint2];
      }
      if (node.type === "polyline") {
        if (movingEndpoint2 === "first") return ((_a2 = node.vertices[0]) == null ? void 0 : _a2.point) ?? null;
        if (movingEndpoint2 === "last") return ((_b = node.vertices[node.vertices.length - 1]) == null ? void 0 : _b.point) ?? null;
      }
      if (node.type === "spline") {
        if (movingEndpoint2 === "first") return node.controlPoints[0] ?? null;
        if (movingEndpoint2 === "last") return node.controlPoints[node.controlPoints.length - 1] ?? null;
      }
      return null;
    }
    function RelationLayer({
      document: document2,
      viewport
    }) {
      return /* @__PURE__ */ jsxRuntime.jsx("g", { className: "vai-relations", children: document2.relations.filter((relation) => relation.visible && relation.plane !== "topology").flatMap((relation) => {
        const centers = relationNodeIds(relation).flatMap((id) => {
          const node = [...document2.geometry, ...document2.annotations].find((candidate) => candidate.id === id);
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
      }) });
    }
    function SelectionBox({ box }) {
      const x = Math.min(box.start[0], box.current[0]);
      const y = Math.min(box.start[1], box.current[1]);
      return /* @__PURE__ */ jsxRuntime.jsx(
        "rect",
        {
          "data-selection-box": "true",
          x,
          y,
          width: Math.abs(box.current[0] - box.start[0]),
          height: Math.abs(box.current[1] - box.start[1]),
          className: "vai-canvas__selection-box",
          pointerEvents: "none"
        }
      );
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
    function eventScreenPoint(event) {
      const target = event.currentTarget;
      const svg = target.tagName.toLowerCase() === "svg" ? target : target.ownerSVGElement;
      const rect = (svg == null ? void 0 : svg.getBoundingClientRect()) ?? { left: 0, top: 0 };
      return [event.clientX - rect.left, event.clientY - rect.top];
    }
    function normalizeBounds(first, second) {
      return {
        minX: Math.min(first[0], second[0]),
        minY: Math.min(first[1], second[1]),
        maxX: Math.max(first[0], second[0]),
        maxY: Math.max(first[1], second[1])
      };
    }
    function isBlankCanvasTarget(event) {
      var _a2;
      if (event.target === event.currentTarget) return true;
      const target = event.target;
      return ((_a2 = target.dataset) == null ? void 0 : _a2.canvasBackground) === "true";
    }
    function WorkspaceStatus() {
      const snapshot = useDrawingWorkspace((state) => state.snapshot);
      const displaySnapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const viewport = useDrawingWorkspace((state) => state.viewport);
      const mouseWorld = useDrawingWorkspace((state) => state.mouseWorld);
      const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
      const busy = useDrawingWorkspace((state) => state.busy);
      if (snapshot === null) return null;
      return /* @__PURE__ */ jsxRuntime.jsxs("footer", { className: "vai-status", "aria-label": "图纸状态", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: snapshot.ref.drawingId }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
          "Revision ",
          snapshot.ref.revision
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: (displaySnapshot == null ? void 0 : displaySnapshot.document.unitSystem.length) ?? snapshot.document.unitSystem.length }),
        preview === null ? null : /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
          "Preview ",
          preview.handle
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
          Math.round(viewport.scale * 100),
          "%"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
          selectedIds.length,
          " 个已选"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-status__coords", children: mouseWorld === null ? "X —  Y —" : `X ${mouseWorld[0].toFixed(3)}  Y ${mouseWorld[1].toFixed(3)}` }),
        busy ? /* @__PURE__ */ jsxRuntime.jsx("span", { children: "正在保存…" }) : null
      ] });
    }
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const toKebabCase = (string2) => string2.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const toCamelCase = (string2) => string2.replace(
      /^([A-Z])|[\s-_]+(\w)/g,
      (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
    );
    const toPascalCase = (string2) => {
      const camelCase = toCamelCase(string2);
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    };
    const mergeClasses = (...classes) => classes.filter((className, index, array2) => {
      return Boolean(className) && className.trim() !== "" && array2.indexOf(className) === index;
    }).join(" ").trim();
    const hasA11yProp = (props) => {
      for (const prop in props) {
        if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
          return true;
        }
      }
    };
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    var defaultAttributes = {
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    };
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const Icon = react.forwardRef(
      ({
        color = "currentColor",
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className = "",
        children,
        iconNode,
        ...rest
      }, ref) => react.createElement(
        "svg",
        {
          ref,
          ...defaultAttributes,
          width: size,
          height: size,
          stroke: color,
          strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
          className: mergeClasses("lucide", className),
          ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
          ...rest
        },
        [
          ...iconNode.map(([tag, attrs]) => react.createElement(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      )
    );
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const createLucideIcon = (iconName, iconNode) => {
      const Component = react.forwardRef(
        ({ className, ...props }, ref) => react.createElement(Icon, {
          ref,
          iconNode,
          className: mergeClasses(
            `lucide-${toKebabCase(toPascalCase(iconName))}`,
            `lucide-${iconName}`,
            className
          ),
          ...props
        })
      );
      Component.displayName = toPascalCase(iconName);
      return Component;
    };
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$9 = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
    const Check = createLucideIcon("check", __iconNode$9);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$8 = [
      ["path", { d: "M12 15V3", key: "m9g1x1" }],
      ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
      ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
    ];
    const Download = createLucideIcon("download", __iconNode$8);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$7 = [
      [
        "path",
        {
          d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
          key: "1nclc0"
        }
      ],
      ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
    ];
    const Eye = createLucideIcon("eye", __iconNode$7);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$6 = [
      [
        "path",
        {
          d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
          key: "zw3jo"
        }
      ],
      [
        "path",
        {
          d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
          key: "1wduqc"
        }
      ],
      [
        "path",
        {
          d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",
          key: "kqbvx6"
        }
      ]
    ];
    const Layers = createLucideIcon("layers", __iconNode$6);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$5 = [
      ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
      ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13", key: "6uklza" }]
    ];
    const Redo2 = createLucideIcon("redo-2", __iconNode$5);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$4 = [
      ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
      ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
      ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
      ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }]
    ];
    const Scan = createLucideIcon("scan", __iconNode$4);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$3 = [
      ["line", { x1: "21", x2: "14", y1: "4", y2: "4", key: "obuewd" }],
      ["line", { x1: "10", x2: "3", y1: "4", y2: "4", key: "1q6298" }],
      ["line", { x1: "21", x2: "12", y1: "12", y2: "12", key: "1iu8h1" }],
      ["line", { x1: "8", x2: "3", y1: "12", y2: "12", key: "ntss68" }],
      ["line", { x1: "21", x2: "16", y1: "20", y2: "20", key: "14d8ph" }],
      ["line", { x1: "12", x2: "3", y1: "20", y2: "20", key: "m0wm8r" }],
      ["line", { x1: "14", x2: "14", y1: "2", y2: "6", key: "14e1ph" }],
      ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
      ["line", { x1: "16", x2: "16", y1: "18", y2: "22", key: "1lctlv" }]
    ];
    const SlidersHorizontal = createLucideIcon("sliders-horizontal", __iconNode$3);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$2 = [
      ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
      ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
    ];
    const Undo2 = createLucideIcon("undo-2", __iconNode$2);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode$1 = [
      ["path", { d: "M12 3v12", key: "1x0j5s" }],
      ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
      ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }]
    ];
    const Upload = createLucideIcon("upload", __iconNode$1);
    /**
     * @license lucide-react v0.511.0 - ISC
     *
     * This source code is licensed under the ISC license.
     * See the LICENSE file in the root directory of this source tree.
     */
    const __iconNode = [
      ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
      ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
    ];
    const X = createLucideIcon("x", __iconNode);
    function WorkspaceToolbar({
      onUploadFiles,
      onExport,
      motionPreviewHeld = false,
      onMotionPreviewHeldChange,
      history,
      uploadAccept = "image/png,image/jpeg,image/webp,image/gif",
      uploadMultiple = false
    }) {
      const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const viewport = useDrawingWorkspace((state) => state.viewport);
      const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const motionRig = useDrawingWorkspace((state) => state.motionRig);
      const canRestoreMotionRig = useDrawingWorkspace((state) => state.canRestoreMotionRig);
      const busy = useDrawingWorkspace((state) => state.busy);
      const setViewport = useDrawingWorkspace((state) => state.setViewport);
      const undoLast = useDrawingWorkspace((state) => state.undoLast);
      const redoLast = useDrawingWorkspace((state) => state.redoLast);
      const confirmMotionRig = useDrawingWorkspace((state) => state.confirmMotionRig);
      const cancelMotionRig = useDrawingWorkspace((state) => state.cancelMotionRig);
      const motionPreviewAvailable = (motionRig == null ? void 0 : motionRig.phase) === "preview" && onMotionPreviewHeldChange !== void 0;
      react.useEffect(() => {
        if (!motionPreviewHeld || onMotionPreviewHeldChange === void 0) return;
        if ((motionRig == null ? void 0 : motionRig.phase) !== "preview") onMotionPreviewHeldChange(false);
      }, [motionPreviewHeld, motionRig == null ? void 0 : motionRig.phase, onMotionPreviewHeldChange]);
      react.useEffect(() => {
        if (!motionPreviewHeld || onMotionPreviewHeldChange === void 0 || typeof window === "undefined") return;
        const release = () => onMotionPreviewHeldChange(false);
        window.addEventListener("blur", release);
        return () => window.removeEventListener("blur", release);
      }, [motionPreviewHeld, onMotionPreviewHeldChange]);
      if (snapshot === null) return null;
      const lastCommit = formalSnapshot == null ? void 0 : formalSnapshot.lastCommit;
      const unavailable = busy || preview !== null || motionRig !== null;
      const beginMotionPreview = (event) => {
        if (event.button !== 0 || !motionPreviewAvailable) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onMotionPreviewHeldChange(true);
      };
      const endMotionPreview = () => {
        onMotionPreviewHeldChange == null ? void 0 : onMotionPreviewHeldChange(false);
      };
      const handleMotionPreviewKeyDown = (event) => {
        if (!motionPreviewAvailable || event.repeat || event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        onMotionPreviewHeldChange(true);
      };
      const handleMotionPreviewKeyUp = (event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        onMotionPreviewHeldChange == null ? void 0 : onMotionPreviewHeldChange(false);
      };
      return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        motionRig !== null ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-toolbar vai-toolbar--motion-rig", role: "toolbar", "aria-label": "姿态编辑操作", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "vai-toolbar__action vai-toolbar__action--cancel",
              type: "button",
              "aria-label": "取消姿态",
              title: "取消姿态",
              onClick: () => {
                void cancelMotionRig();
              },
              children: /* @__PURE__ */ jsxRuntime.jsx(X, { "aria-hidden": "true", size: 17 })
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "span",
            {
              className: "vai-toolbar__separator vai-toolbar__separator--motion-rig",
              "aria-hidden": "true"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "vai-toolbar__action vai-toolbar__action--preview",
              type: "button",
              "aria-label": "按住预览修改效果",
              "aria-pressed": motionPreviewHeld,
              disabled: !motionPreviewAvailable,
              title: "按住预览修改前后位置",
              onPointerDown: beginMotionPreview,
              onPointerUp: endMotionPreview,
              onPointerCancel: endMotionPreview,
              onBlur: endMotionPreview,
              onKeyDown: handleMotionPreviewKeyDown,
              onKeyUp: handleMotionPreviewKeyUp,
              onClick: (event) => event.preventDefault(),
              children: /* @__PURE__ */ jsxRuntime.jsx(Eye, { "aria-hidden": "true", size: 17 })
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "span",
            {
              className: "vai-toolbar__separator vai-toolbar__separator--motion-rig",
              "aria-hidden": "true"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "vai-toolbar__action vai-toolbar__action--confirm",
              type: "button",
              "aria-label": "确认姿态",
              disabled: motionRig.phase !== "preview",
              title: "确认姿态",
              onClick: () => {
                void confirmMotionRig();
              },
              children: /* @__PURE__ */ jsxRuntime.jsx(Check, { "aria-hidden": "true", size: 17 })
            }
          )
        ] }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          WorkspaceToolbarView,
          {
            snapshot,
            viewport,
            unavailable,
            canUndo: (history == null ? void 0 : history.canUndo) ?? Boolean(canRestoreMotionRig || (lastCommit == null ? void 0 : lastCommit.undoable)),
            canRedo: (history == null ? void 0 : history.canRedo) ?? Boolean(lastCommit == null ? void 0 : lastCommit.redoable),
            onFit: (next) => setViewport(next),
            onUndo: () => history ? history.undo() : undoLast(),
            onRedo: () => history ? history.redo() : redoLast(),
            onUploadFiles,
            uploadAccept,
            uploadMultiple,
            onExport
          }
        )
      ] });
    }
    function WorkspaceToolbarView({
      snapshot,
      viewport,
      unavailable = false,
      canUndo,
      canRedo,
      onFit,
      onUndo,
      onRedo,
      onUploadFiles,
      uploadAccept = "image/png,image/jpeg,image/webp,image/gif",
      uploadMultiple = false,
      onExport
    }) {
      const handleUpload = (event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        if (files.length > 0) onUploadFiles == null ? void 0 : onUploadFiles(files);
      };
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-toolbar", role: "toolbar", "aria-label": "图纸操作工具", children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            "aria-label": "适配图纸",
            title: "缩放并居中显示整张图纸",
            onClick: () => onFit(fitViewportToDrawing(snapshot.document, viewport)),
            children: /* @__PURE__ */ jsxRuntime.jsx(Scan, { "aria-hidden": "true", size: 17 })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-toolbar__separator" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            "aria-label": "撤销",
            disabled: unavailable || !canUndo,
            title: "撤销最近一次图纸修改",
            onClick: () => {
              void onUndo();
            },
            children: /* @__PURE__ */ jsxRuntime.jsx(Undo2, { "aria-hidden": "true", size: 17 })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            "aria-label": "反撤销",
            disabled: unavailable || !canRedo,
            title: "恢复最近一次撤销",
            onClick: () => {
              void onRedo();
            },
            children: /* @__PURE__ */ jsxRuntime.jsx(Redo2, { "aria-hidden": "true", size: 17 })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-toolbar__separator" }),
        /* @__PURE__ */ jsxRuntime.jsxs(
          "label",
          {
            className: `vai-toolbar__upload${onUploadFiles === void 0 ? " vai-toolbar__upload--disabled" : ""}`,
            "aria-label": "上传图纸",
            title: "上传图纸",
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(Upload, { "aria-hidden": "true", size: 17 }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  type: "file",
                  accept: uploadAccept,
                  multiple: uploadMultiple,
                  disabled: onUploadFiles === void 0,
                  onChange: handleUpload
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            "aria-label": "导出 DXF",
            disabled: false,
            title: "导出当前 DXF 图纸",
            onClick: onExport ?? (() => exportSnapshotDxf(snapshot)),
            children: /* @__PURE__ */ jsxRuntime.jsx(Download, { "aria-hidden": "true", size: 17 })
          }
        )
      ] });
    }
    function exportSnapshotDxf(snapshot) {
      const blob = new Blob([exportDrawingDxf(snapshot.document)], { type: "application/dxf;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${snapshot.ref.drawingId}-R${snapshot.ref.revision}.dxf`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    function ObjectList() {
      const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const groundingOverlay = useDrawingWorkspace((state) => state.groundingOverlay);
      const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
      const busy = useDrawingWorkspace((state) => state.busy);
      const setSelection = useDrawingWorkspace((state) => state.setSelection);
      const updateNode = useDrawingWorkspace((state) => state.updateNode);
      const deleteNodes = useDrawingWorkspace((state) => state.deleteNodes);
      if (snapshot === null) return null;
      const groups = [
        { label: "几何图元", nodes: snapshot.document.geometry },
        { label: "标注", nodes: snapshot.document.annotations },
        { label: "关系", nodes: snapshot.document.relations },
        { label: "语义特征", nodes: snapshot.document.features }
      ];
      const groundedNodeIds = new Set(
        (groundingOverlay == null ? void 0 : groundingOverlay.groups.filter((group) => group.role !== "reference").flatMap((group) => group.nodeIds)) ?? []
      );
      return /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "vai-panel vai-object-list", "aria-label": "图纸对象", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-panel__title", children: "对象" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-object-list__scroll", children: groups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "vai-object-group", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { children: [
            group.label,
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: group.nodes.length })
          ] }),
          group.nodes.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-object-group__empty", children: "无" }) : group.nodes.map((node) => {
            const selected = selectedIds.includes(node.id);
            const aiGrounded = groundedNodeIds.has(node.id);
            return /* @__PURE__ */ jsxRuntime.jsxs(
              "div",
              {
                className: `vai-object-row${selected ? " vai-object-row--selected" : ""}${aiGrounded ? " vai-object-row--ai-grounded" : ""}`,
                "data-object-id": node.id,
                "data-ai-grounded": aiGrounded || void 0,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsxs(
                    "button",
                    {
                      type: "button",
                      className: "vai-object-row__main",
                      onClick: (event) => {
                        if (event.metaKey || event.ctrlKey) {
                          setSelection(selectedIds.includes(node.id) ? selectedIds.filter((id) => id !== node.id) : [...selectedIds, node.id]);
                        } else setSelection([node.id]);
                      },
                      children: [
                        /* @__PURE__ */ jsxRuntime.jsx(ObjectGlyph, { type: node.type }),
                        /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "vai-object-row__identity", children: [
                          /* @__PURE__ */ jsxRuntime.jsx("strong", { children: node.id }),
                          /* @__PURE__ */ jsxRuntime.jsx("small", { children: node.type })
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "button",
                    {
                      type: "button",
                      className: "vai-icon-button",
                      "aria-label": `${node.visible ? "隐藏" : "显示"} ${node.id}`,
                      disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.edit),
                      onClick: () => {
                        void updateNode(node.id, { visible: !node.visible });
                      },
                      children: node.visible ? "◉" : "○"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "button",
                    {
                      type: "button",
                      className: "vai-icon-button vai-icon-button--danger",
                      "aria-label": `删除 ${node.id}`,
                      disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.delete),
                      onClick: () => {
                        void deleteNodes([node.id]);
                      },
                      children: "×"
                    }
                  )
                ]
              },
              node.id
            );
          })
        ] }, group.label)) })
      ] });
    }
    function ObjectGlyph({ type }) {
      const glyph = type === "circle" ? "○" : type === "point" ? "·" : type === "text" ? "T" : type === "dimension" ? "↔" : type === "feature" ? "◇" : type === "topology" || type === "constraint" || type === "association" || type === "semantic" ? "⌁" : "∕";
      return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-object-row__glyph", "aria-hidden": "true", children: glyph });
    }
    function PropertyInspector() {
      const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
      const busy = useDrawingWorkspace((state) => state.busy);
      const updateNode = useDrawingWorkspace((state) => state.updateNode);
      if (snapshot === null) return null;
      const node = locateNode(snapshot.document, selectedIds[0]);
      return /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "vai-panel vai-inspector", "aria-label": "图元属性", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-panel__title", children: "图元属性" }),
        node === null ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-panel__empty", children: "选择图元查看和编辑属性" }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-inspector__scroll", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("dl", { className: "vai-inspector__identity", children: [
            /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "ID" }),
            /* @__PURE__ */ jsxRuntime.jsx("dd", { children: node.id }),
            /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "类型" }),
            /* @__PURE__ */ jsxRuntime.jsx("dd", { children: node.type }),
            /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "状态" }),
            /* @__PURE__ */ jsxRuntime.jsx("dd", { children: node.quality.status }),
            /* @__PURE__ */ jsxRuntime.jsx("dt", { children: "置信度" }),
            /* @__PURE__ */ jsxRuntime.jsx("dd", { children: node.quality.confidence === void 0 ? "—" : `${Math.round(node.quality.confidence * 100)}%` })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-inspector__fields", children: editableProperties(node).map((property) => /* @__PURE__ */ jsxRuntime.jsx(
            PropertyField,
            {
              property,
              disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.edit),
              commit: (value) => {
                void updateNode(node.id, property.change(value));
              }
            },
            property.key
          )) }),
          /* @__PURE__ */ jsxRuntime.jsxs("details", { className: "vai-inspector__raw", children: [
            /* @__PURE__ */ jsxRuntime.jsx("summary", { children: "完整属性" }),
            /* @__PURE__ */ jsxRuntime.jsx("pre", { children: JSON.stringify(node, null, 2) })
          ] })
        ] })
      ] });
    }
    function PropertyField({
      property,
      disabled,
      commit
    }) {
      if (property.kind === "boolean") {
        return /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "vai-field vai-field--check", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: property.label }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "checkbox",
              defaultChecked: Boolean(property.value),
              disabled,
              onChange: (event) => commit(event.currentTarget.checked)
            }
          )
        ] });
      }
      return /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "vai-field", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: property.label }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: property.kind,
            defaultValue: String(property.value),
            disabled,
            step: property.kind === "number" ? "any" : void 0,
            onBlur: (event) => {
              const value = property.kind === "number" ? Number(event.currentTarget.value) : event.currentTarget.value;
              if (property.kind === "number" && !Number.isFinite(value)) return;
              if (value !== property.value) commit(value);
            }
          }
        )
      ] });
    }
    function editableProperties(node) {
      const fields = [booleanField("visible", "可见", node.visible, "visible")];
      switch (node.type) {
        case "point":
          return [...fields, numberField("x", "X", node.x, "x"), numberField("y", "Y", node.y, "y")];
        case "line":
          return [...fields, ...vec2Fields("start", "起点", node.start), ...vec2Fields("end", "终点", node.end)];
        case "ray":
        case "xline":
          return [...fields, ...vec2Fields("origin", "原点", node.origin), ...vec2Fields("direction", "方向", node.direction)];
        case "circle":
          return [...fields, ...vec2Fields("center", "圆心", node.center), numberField("radius", "半径", node.radius, "radius")];
        case "arc":
          return [
            ...fields,
            ...vec2Fields("center", "圆心", node.center),
            numberField("radius", "半径", node.radius, "radius"),
            numberField("startAngle", "起始角", node.startAngle, "startAngle"),
            numberField("endAngle", "结束角", node.endAngle, "endAngle"),
            booleanField("counterClockwise", "逆时针", node.counterClockwise, "counterClockwise")
          ];
        case "ellipse":
          return [
            ...fields,
            ...vec2Fields("center", "中心", node.center),
            ...vec2Fields("majorAxis", "主轴", node.majorAxis),
            numberField("ratio", "轴比", node.ratio, "ratio")
          ];
        case "polyline":
          return [...fields, booleanField("closed", "闭合", node.closed, "closed")];
        case "spline":
          return [
            ...fields,
            numberField("degree", "阶数", node.degree, "degree"),
            booleanField("closed", "闭合", node.closed, "closed"),
            booleanField("periodic", "周期", node.periodic, "periodic")
          ];
        case "text":
          return [
            ...fields,
            textField("content", "文字", node.content, "content"),
            ...vec2Fields("position", "位置", node.position),
            numberField("height", "字高", node.height, "height"),
            numberField("rotation", "旋转", node.rotation, "rotation")
          ];
        case "dimension":
          return [
            ...fields,
            textField("displayText", "显示文字", node.displayText ?? "", "displayText"),
            ...vec2Fields("textPosition", "文字位置", node.textPosition),
            textField("prefix", "前缀", node.prefix ?? "", "prefix"),
            textField("suffix", "后缀", node.suffix ?? "", "suffix")
          ];
        case "leader":
          return [
            ...fields,
            textField("content", "文字", node.content, "content"),
            numberField("textHeight", "字高", node.textHeight, "textHeight")
          ];
        case "centerline":
          return [...fields, numberField("extension", "延伸", node.extension, "extension")];
        case "section-hatch":
          return [
            ...fields,
            textField("pattern", "图案", node.pattern, "pattern"),
            numberField("angle", "角度", node.angle, "angle"),
            numberField("spacing", "间距", node.spacing, "spacing")
          ];
        case "topology":
        case "constraint":
        case "association":
        case "semantic":
        case "feature":
          return fields;
      }
    }
    function vec2Fields(key, label, value) {
      return [0, 1].map((index) => ({
        key: `${key}.${index}`,
        label: `${label} ${index === 0 ? "X" : "Y"}`,
        value: value[index],
        kind: "number",
        change: (next) => ({ [key]: value.map((item, itemIndex) => itemIndex === index ? Number(next) : item) })
      }));
    }
    function numberField(key, label, value, property) {
      return { key, label, value, kind: "number", change: (next) => ({ [property]: Number(next) }) };
    }
    function textField(key, label, value, property) {
      return { key, label, value, kind: "text", change: (next) => ({ [property]: String(next) }) };
    }
    function booleanField(key, label, value, property) {
      return { key, label, value, kind: "boolean", change: (next) => ({ [property]: Boolean(next) }) };
    }
    function locateNode(document2, id) {
      if (id === void 0) return null;
      return document2.geometry.find((node) => node.id === id) ?? document2.annotations.find((node) => node.id === id) ?? document2.relations.find((node) => node.id === id) ?? document2.features.find((node) => node.id === id) ?? null;
    }
    const MIN_PANEL_WIDTH = 220;
    const MAX_PANEL_WIDTH = 420;
    const PANEL_RESIZE_STEP = 16;
    const defaultPanelDefinitions = [
      { id: "objects", label: "对象", icon: Layers, render: () => /* @__PURE__ */ jsxRuntime.jsx(ObjectList, {}) },
      { id: "properties", label: "属性", icon: SlidersHorizontal, render: () => /* @__PURE__ */ jsxRuntime.jsx(PropertyInspector, {}) }
    ];
    function WorkspaceActivityBar({
      activePanel,
      panelWidth,
      onActivePanelChange,
      onPanelWidthChange,
      panels,
      overlay = false
    }) {
      const resizeStart = react.useRef(null);
      const latestWidth = react.useRef(panelWidth);
      latestWidth.current = panelWidth;
      const definitions = panels ?? defaultPanelDefinitions;
      const activeDefinition = definitions.find(({ id }) => id === activePanel);
      function commitWidth(width) {
        const nextWidth = clampPanelWidth(width);
        latestWidth.current = nextWidth;
        onPanelWidthChange(nextWidth);
      }
      function handlePointerDown(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeStart.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          width: latestWidth.current
        };
      }
      function handlePointerMove(event) {
        const start = resizeStart.current;
        if (start === null || start.pointerId !== event.pointerId) return;
        commitWidth(start.width + event.clientX - start.clientX);
      }
      function finishPointerResize(event) {
        var _a2;
        if (((_a2 = resizeStart.current) == null ? void 0 : _a2.pointerId) === event.pointerId) resizeStart.current = null;
      }
      function handleResizeKeyDown(event) {
        const delta = event.key === "ArrowLeft" ? -PANEL_RESIZE_STEP : event.key === "ArrowRight" ? PANEL_RESIZE_STEP : 0;
        if (delta !== 0) {
          event.preventDefault();
          commitWidth(latestWidth.current + delta);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          commitWidth(event.key === "Home" ? MIN_PANEL_WIDTH : MAX_PANEL_WIDTH);
        }
      }
      return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx("nav", { className: `vai-activity-bar${overlay ? " vai-activity-bar--overlay" : ""}`, "aria-label": "信息面板工具栏", children: definitions.map(({ id, label, icon: Icon2 }) => {
          const active = activePanel === id;
          return /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              type: "button",
              className: "vai-activity-bar__button",
              "aria-label": `${label}面板`,
              "aria-pressed": active,
              title: label,
              onClick: () => onActivePanelChange(active ? null : id),
              children: /* @__PURE__ */ jsxRuntime.jsx(Icon2, { size: 19, strokeWidth: 1.75, "aria-hidden": "true" })
            },
            id
          );
        }) }),
        activeDefinition === void 0 ? null : /* @__PURE__ */ jsxRuntime.jsxs(
          "aside",
          {
            className: `vai-inspector-stack vai-inspector-stack--activity${overlay ? " vai-inspector-stack--overlay" : ""}`,
            "data-panel": activeDefinition.id,
            "aria-label": `${activeDefinition.label}信息面板`,
            style: { width: panelWidth, backgroundColor: "var(--vai-panel, #12161b)" },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  type: "button",
                  className: "vai-panel-close",
                  "aria-label": "关闭信息面板",
                  title: "关闭",
                  onClick: () => onActivePanelChange(null),
                  children: /* @__PURE__ */ jsxRuntime.jsx(X, { size: 16, "aria-hidden": "true" })
                }
              ),
              activeDefinition.render(),
              /* @__PURE__ */ jsxRuntime.jsx(
                "div",
                {
                  className: "vai-panel-resizer",
                  role: "separator",
                  "aria-label": "调整信息面板宽度",
                  "aria-orientation": "vertical",
                  "aria-valuemin": MIN_PANEL_WIDTH,
                  "aria-valuemax": MAX_PANEL_WIDTH,
                  "aria-valuenow": panelWidth,
                  tabIndex: 0,
                  onPointerDown: handlePointerDown,
                  onPointerMove: handlePointerMove,
                  onPointerUp: finishPointerResize,
                  onPointerCancel: finishPointerResize,
                  onKeyDown: handleResizeKeyDown
                }
              )
            ]
          }
        )
      ] });
    }
    function clampPanelWidth(width) {
      return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
    }
    function DrawingWorkspace({
      previewContributions = [],
      emptyMessage = "还没有图纸",
      onUploadFiles,
      onExport
    }) {
      const [activePanel, setActivePanel] = react.useState(null);
      const [panelWidth, setPanelWidth] = react.useState(260);
      const [motionPreviewHeld, setMotionPreviewHeld] = react.useState(false);
      const status = useDrawingWorkspace((state) => state.status);
      const snapshot = useDrawingWorkspace((state) => state.snapshot);
      const displaySnapshot = useDrawingWorkspace((state) => state.displaySnapshot);
      const preview = useDrawingWorkspace((state) => state.preview);
      const viewport = useDrawingWorkspace((state) => state.viewport);
      const busy = useDrawingWorkspace((state) => state.busy);
      const error = useDrawingWorkspace((state) => state.error);
      if (status === "idle" || status === "loading") {
        return /* @__PURE__ */ jsxRuntime.jsx("section", { className: "vai-workspace", "aria-label": "图纸工作区", "data-workspace-state": "loading", children: /* @__PURE__ */ jsxRuntime.jsx(WorkspaceState, { title: "正在读取本地图纸…" }) });
      }
      if (status === "error" && snapshot === null) {
        return /* @__PURE__ */ jsxRuntime.jsx("section", { className: "vai-workspace", "aria-label": "图纸工作区", "data-workspace-state": "error", children: /* @__PURE__ */ jsxRuntime.jsx(WorkspaceState, { title: "图纸读取失败", detail: error == null ? void 0 : error.message, alert: true }) });
      }
      if (snapshot === null) {
        return /* @__PURE__ */ jsxRuntime.jsx("section", { className: "vai-workspace", "aria-label": "图纸工作区", "data-workspace-state": "empty", children: /* @__PURE__ */ jsxRuntime.jsx(WorkspaceState, { title: emptyMessage, detail: "导入图片或工程图文件后即可开始。" }) });
      }
      return /* @__PURE__ */ jsxRuntime.jsxs(
        "section",
        {
          className: "vai-workspace",
          "aria-label": "图纸工作区",
          "data-workspace-state": "ready",
          "data-layout": "website-parity",
          "data-preview-state": preview === null ? void 0 : "current",
          children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "vai-workspace__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-workspace__identity", children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "vai-workspace__drawing-id", children: snapshot.ref.drawingId }),
                /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                  "R",
                  snapshot.ref.revision
                ] }),
                snapshot.provisional ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-workspace__badge", children: "候选几何" }) : null,
                preview === null ? null : /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-workspace__badge vai-workspace__badge--preview", children: "候选 Preview" })
              ] }),
              busy ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "vai-workspace__busy", children: "正在保存…" }) : null
            ] }),
            error === null ? null : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-workspace__error", role: "alert", children: error.message }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-workspace__body", "data-workspace-region": "viewer", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                WorkspaceActivityBar,
                {
                  activePanel,
                  panelWidth,
                  onActivePanelChange: setActivePanel,
                  onPanelWidthChange: setPanelWidth
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-workspace__canvas-region", children: [
                /* @__PURE__ */ jsxRuntime.jsx(Canvas, { motionPreviewHeld }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  WorkspaceToolbar,
                  {
                    onUploadFiles,
                    onExport: onExport ?? (() => exportDxf(snapshot)),
                    motionPreviewHeld,
                    onMotionPreviewHeldChange: setMotionPreviewHeld
                  }
                )
              ] }),
              previewContributions.map((contribution) => /* @__PURE__ */ jsxRuntime.jsx("div", { "data-preview-overlay": contribution.id, children: contribution.render({ snapshot: displaySnapshot ?? snapshot, viewport }) }, contribution.id))
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(WorkspaceStatus, {})
          ]
        }
      );
    }
    function exportDxf(snapshot) {
      const blob = new Blob([exportDrawingDxf(snapshot.document)], { type: "application/dxf;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${snapshot.ref.drawingId}-R${snapshot.ref.revision}.dxf`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    function WorkspaceState({
      title,
      detail,
      alert = false
    }) {
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "vai-workspace__state", role: alert ? "alert" : void 0, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-workspace__state-title", children: title }),
        detail === void 0 ? null : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "vai-workspace__state-detail", children: detail })
      ] });
    }
    const IMMUTABLE_NODE_FIELDS = /* @__PURE__ */ new Set(["id", "type", "plane"]);
    function buildNodeUpdateCommand(document2, id, changes) {
      const node = findDrawingNode$1(document2, id);
      if (node === null) return null;
      const fields = Object.keys(changes);
      if (fields.length === 0) return null;
      const immutableField = fields.find((field) => IMMUTABLE_NODE_FIELDS.has(field));
      if (immutableField !== void 0) {
        throw new Error(`IMMUTABLE_DRAWING_NODE_FIELD:${immutableField}`);
      }
      const record2 = node;
      return {
        type: "node.update",
        id,
        changes: clone$1(changes),
        expected: Object.fromEntries(fields.map((field) => [field, clone$1(record2[field])]))
      };
    }
    function buildNodeDeleteCommands(document2, ids) {
      const uniqueIds = [...new Set(ids)];
      return uniqueIds.flatMap((id) => findDrawingNode$1(document2, id) === null ? [] : [{ type: "node.delete", id }]);
    }
    function buildAnnotationTextMoveCommand(document2, id, position) {
      const annotation = document2.annotations.find((node) => node.id === id);
      if (annotation === void 0) return null;
      const expectedPosition = annotationTextPosition(annotation);
      if (expectedPosition === null) return null;
      return {
        type: "annotation.move-text",
        id,
        position: [...position],
        expectedPosition: [...expectedPosition]
      };
    }
    function findDrawingNode$1(document2, id) {
      return document2.geometry.find((node) => node.id === id) ?? document2.annotations.find((node) => node.id === id) ?? document2.relations.find((node) => node.id === id) ?? document2.features.find((node) => node.id === id) ?? null;
    }
    function annotationTextPosition(annotation) {
      switch (annotation.type) {
        case "text":
          return annotation.position;
        case "dimension":
          return annotation.textPosition;
        default:
          return null;
      }
    }
    function clone$1(value) {
      return value === void 0 ? value : structuredClone(value);
    }
    function applyDrawingTransaction(source, commands, now) {
      const document2 = structuredClone(source);
      for (const command of commands) applyCommand(document2, command);
      validateDocument(document2);
      document2.metadata.updatedAt = now;
      return document2;
    }
    function findDrawingNode(document2, id) {
      for (const plane of ["geometry", "annotation", "relation", "feature"]) {
        const collection = collectionFor(document2, plane);
        const node = collection.find((candidate) => candidate.id === id);
        if (node) return { plane, node };
      }
      return null;
    }
    function applyCommand(document2, command) {
      if (command.type === "node.create") {
        if (findDrawingNode(document2, command.node.id)) throw new Error("EDIT_NODE_ALREADY_EXISTS");
        const collection = collectionFor(document2, command.plane);
        collection.push(structuredClone(command.node));
        return;
      }
      const located = findDrawingNode(document2, command.id);
      if (!located) throw new Error("EDIT_NODE_NOT_FOUND");
      if (command.type === "node.delete") {
        const collection = collectionFor(document2, located.plane);
        const index = collection.findIndex(({ id }) => id === command.id);
        collection.splice(index, 1);
        removeReferences(document2, command.id);
        return;
      }
      if (command.type === "annotation.move-text") {
        if (located.plane !== "annotation") throw new Error("EDIT_NODE_TYPE_MISMATCH");
        const node2 = located.node;
        const key = node2.type === "text" ? "position" : "textPosition";
        assertExpected(node2[key], command.expectedPosition);
        node2[key] = structuredClone(command.position);
        return;
      }
      const node = located.node;
      for (const [key, expected] of Object.entries(command.expected)) assertExpected(node[key], expected);
      for (const [key, value] of Object.entries(command.changes)) node[key] = structuredClone(value);
    }
    function collectionFor(document2, plane) {
      if (plane === "geometry") return document2.geometry;
      if (plane === "annotation") return document2.annotations;
      if (plane === "relation") return document2.relations;
      return document2.features;
    }
    function removeReferences(document2, id) {
      document2.relations = document2.relations.filter((relation) => {
        if (relation.type === "topology") return !relation.nodeIds.includes(id);
        if (relation.type === "constraint") return !relation.geometryIds.includes(id);
        if (relation.type === "association") {
          return relation.annotationId !== id && !relation.geometryIds.includes(id);
        }
        return relation.featureId !== id && !relation.nodeIds.includes(id);
      });
      document2.features = document2.features.filter((feature) => feature.id !== id).map((feature) => ({
        ...feature,
        geometryIds: feature.geometryIds.filter((nodeId) => nodeId !== id),
        annotationIds: feature.annotationIds.filter((nodeId) => nodeId !== id),
        relationIds: feature.relationIds.filter((nodeId) => nodeId !== id)
      }));
    }
    function validateDocument(document2) {
      const ids = [
        ...document2.geometry.map(({ id }) => id),
        ...document2.annotations.map(({ id }) => id),
        ...document2.relations.map(({ id }) => id),
        ...document2.features.map(({ id }) => id)
      ].map(String);
      if (new Set(ids).size !== ids.length) throw new Error("EDIT_DUPLICATE_NODE_ID");
      const geometry = new Set(document2.geometry.map(({ id }) => id));
      const annotation = new Set(document2.annotations.map(({ id }) => id));
      const feature = new Set(document2.features.map(({ id }) => id));
      for (const relation of document2.relations) {
        const valid = relation.type === "topology" ? relation.nodeIds.every((id) => ids.includes(String(id))) : relation.type === "constraint" ? relation.geometryIds.every((id) => geometry.has(id)) : relation.type === "association" ? annotation.has(relation.annotationId) && relation.geometryIds.every((id) => geometry.has(id)) : feature.has(relation.featureId) && relation.nodeIds.every((id) => ids.includes(String(id)));
        if (!valid) throw new Error("EDIT_DANGLING_REFERENCE");
      }
    }
    function assertExpected(actual, expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("EDIT_PRECONDITION_FAILED");
    }
    function solveMotionRigConnectorAttachment(document2, rig, connectorId, target) {
      if (!finitePoint(target)) throw new Error("MOTION_RIG_CONTACT_TARGET_INVALID");
      const binding = rig.connectors.find(({ nodeId }) => nodeId === connectorId);
      if (!binding) throw new Error("MOTION_RIG_CONNECTOR_MISSING");
      const carrierId = rig.carrierNodeId ?? rig.controlBodyNodeIds.find((id) => {
        const located = findDrawingNode(document2, id);
        return (located == null ? void 0 : located.plane) === "geometry" && (located.node.type === "circle" || located.node.type === "ellipse");
      });
      const carrierLocated = carrierId ? findDrawingNode(document2, carrierId) : null;
      if (!carrierLocated || carrierLocated.plane !== "geometry" || carrierLocated.node.type !== "circle" && carrierLocated.node.type !== "ellipse") throw new Error("MOTION_RIG_CONTROL_NODE_MISSING");
      const connectorLocated = findDrawingNode(document2, connectorId);
      if (!connectorLocated || connectorLocated.plane !== "geometry") {
        throw new Error("MOTION_RIG_CONNECTOR_MISSING");
      }
      const connector = connectorLocated.node;
      const currentPoint = movingEndpoint(connector, binding.movingEndpoint);
      const projected = projectToCarrierBoundary(carrierLocated.node, target, currentPoint);
      const command = deformConnector(connector, binding, [
        projected[0] - currentPoint[0],
        projected[1] - currentPoint[1]
      ]);
      const candidate = applyDrawingTransaction(document2, [command], document2.metadata.updatedAt);
      const updated = candidate.geometry.find(({ id }) => String(id) === connectorId);
      if (!updated || distance(fixedEndpoint(updated, binding.movingEndpoint), binding.fixedPoint) > 1e-8) {
        throw new Error("MOTION_RIG_ANCHOR_CHANGED");
      }
      return { commands: [command], candidate };
    }
    function solveTranslationMotionRig(document2, rig, delta) {
      if (!finitePoint(delta)) throw new Error("MOTION_RIG_DELTA_INVALID");
      const commands = [];
      const connectorIds = new Set(rig.connectors.map(({ nodeId }) => nodeId));
      for (const id of rig.controlBodyNodeIds) {
        if (connectorIds.has(id)) throw new Error("MOTION_RIG_ROLE_CONFLICT");
        const located = findDrawingNode(document2, id);
        if (!located || located.plane !== "geometry") throw new Error("MOTION_RIG_CONTROL_NODE_MISSING");
        const translated = translatedFields(located.node, delta);
        commands.push({ type: "node.update", id, changes: translated.after, expected: translated.before });
      }
      for (const binding of rig.connectors) {
        const located = findDrawingNode(document2, binding.nodeId);
        if (!located || located.plane !== "geometry") throw new Error("MOTION_RIG_CONNECTOR_MISSING");
        commands.push(deformConnector(located.node, binding, delta));
      }
      if (commands.length === 0) throw new Error("MOTION_RIG_NO_EFFECT");
      const candidate = applyDrawingTransaction(document2, commands, document2.metadata.updatedAt);
      for (const binding of rig.connectors) {
        const node = candidate.geometry.find(({ id }) => String(id) === binding.nodeId);
        if (!node || distance(fixedEndpoint(node, binding.movingEndpoint), binding.fixedPoint) > 1e-8) {
          throw new Error("MOTION_RIG_ANCHOR_CHANGED");
        }
      }
      return { commands, candidate };
    }
    function deformConnector(node, binding, delta) {
      if (node.type === "line" && (binding.movingEndpoint === "start" || binding.movingEndpoint === "end")) {
        const before = node[binding.movingEndpoint];
        return {
          type: "node.update",
          id: String(node.id),
          changes: { [binding.movingEndpoint]: add(before, delta) },
          expected: { [binding.movingEndpoint]: structuredClone(before) }
        };
      }
      if (node.type === "polyline" && (binding.movingEndpoint === "first" || binding.movingEndpoint === "last")) {
        const before = structuredClone(node.vertices);
        const points = before.map(({ point: point3 }) => point3);
        const moved = deformPointChain(points, binding.movingEndpoint, delta);
        return {
          type: "node.update",
          id: String(node.id),
          changes: { vertices: before.map((vertex, index) => ({ ...vertex, point: moved[index] })) },
          expected: { vertices: structuredClone(node.vertices) }
        };
      }
      if (node.type === "spline" && (binding.movingEndpoint === "first" || binding.movingEndpoint === "last")) {
        return {
          type: "node.update",
          id: String(node.id),
          changes: { controlPoints: deformPointChain(node.controlPoints, binding.movingEndpoint, delta) },
          expected: { controlPoints: structuredClone(node.controlPoints) }
        };
      }
      throw new Error("MOTION_RIG_GEOMETRY_UNSUPPORTED");
    }
    function movingEndpoint(node, moving) {
      if (node.type === "line") {
        if (moving === "start" || moving === "end") return node[moving];
      }
      if (node.type === "polyline") {
        if (moving === "first") return node.vertices[0].point;
        if (moving === "last") return node.vertices[node.vertices.length - 1].point;
      }
      if (node.type === "spline") {
        if (moving === "first") return node.controlPoints[0];
        if (moving === "last") return node.controlPoints[node.controlPoints.length - 1];
      }
      throw new Error("MOTION_RIG_GEOMETRY_UNSUPPORTED");
    }
    function projectToCarrierBoundary(carrier, target, fallback) {
      const dx = target[0] - carrier.center[0];
      const dy = target[1] - carrier.center[1];
      if (carrier.type === "circle") {
        const length = Math.hypot(dx, dy);
        const fallbackDx = fallback[0] - carrier.center[0];
        const fallbackDy = fallback[1] - carrier.center[1];
        const directionLength = length > 1e-12 ? length : Math.hypot(fallbackDx, fallbackDy);
        if (!(directionLength > 1e-12)) throw new Error("MOTION_RIG_CONTACT_DIRECTION_INVALID");
        const direction = length > 1e-12 ? [dx, dy] : [fallbackDx, fallbackDy];
        return cleanPoint([
          carrier.center[0] + direction[0] * carrier.radius / directionLength,
          carrier.center[1] + direction[1] * carrier.radius / directionLength
        ]);
      }
      const major = Math.hypot(...carrier.majorAxis);
      const minor = major * carrier.ratio;
      if (!(major > 1e-12) || !(minor > 1e-12)) throw new Error("MOTION_RIG_CONTACT_CARRIER_INVALID");
      const ux = carrier.majorAxis[0] / major;
      const uy = carrier.majorAxis[1] / major;
      const local = (point3) => {
        const offsetX = point3[0] - carrier.center[0];
        const offsetY = point3[1] - carrier.center[1];
        return [offsetX * ux + offsetY * uy, -offsetX * uy + offsetY * ux];
      };
      let [localX, localY] = local(target);
      if (Math.hypot(localX, localY) <= 1e-12) [localX, localY] = local(fallback);
      const factor = 1 / Math.hypot(localX / major, localY / minor);
      if (!Number.isFinite(factor)) throw new Error("MOTION_RIG_CONTACT_DIRECTION_INVALID");
      return cleanPoint([
        carrier.center[0] + ux * localX * factor - uy * localY * factor,
        carrier.center[1] + uy * localX * factor + ux * localY * factor
      ]);
    }
    function deformPointChain(input, movingEndpoint2, delta) {
      const points = movingEndpoint2 === "last" ? [...input] : [...input].reverse();
      const cumulative = [0];
      for (let index = 1; index < points.length; index += 1) {
        cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
      }
      const total = cumulative[cumulative.length - 1];
      if (!(total > 1e-12)) throw new Error("MOTION_RIG_CONNECTOR_DEGENERATE");
      const deformed = points.map((point3, index) => add(point3, scale(delta, cumulative[index] / total)));
      return movingEndpoint2 === "last" ? deformed : deformed.reverse();
    }
    function translatedFields(node, delta) {
      if (node.type === "point") return {
        before: { x: node.x, y: node.y },
        after: { x: clean(node.x + delta[0]), y: clean(node.y + delta[1]) }
      };
      if (node.type === "line") return pair("start", node.start, "end", node.end, delta);
      if (node.type === "circle" || node.type === "arc" || node.type === "ellipse") return {
        before: { center: structuredClone(node.center) },
        after: { center: add(node.center, delta) }
      };
      if (node.type === "polyline") return {
        before: { vertices: structuredClone(node.vertices) },
        after: { vertices: node.vertices.map((vertex) => ({ ...structuredClone(vertex), point: add(vertex.point, delta) })) }
      };
      if (node.type === "spline") return {
        before: { controlPoints: structuredClone(node.controlPoints) },
        after: { controlPoints: node.controlPoints.map((point3) => add(point3, delta)) }
      };
      if (node.type === "ray" || node.type === "xline") return {
        before: { origin: structuredClone(node.origin) },
        after: { origin: add(node.origin, delta) }
      };
      throw new Error("MOTION_RIG_GEOMETRY_UNSUPPORTED");
    }
    function pair(firstKey, first, secondKey, second, delta) {
      return {
        before: { [firstKey]: structuredClone(first), [secondKey]: structuredClone(second) },
        after: { [firstKey]: add(first, delta), [secondKey]: add(second, delta) }
      };
    }
    function fixedEndpoint(node, moving) {
      if (node.type === "line") return moving === "start" ? node.end : node.start;
      if (node.type === "polyline") return moving === "first" ? node.vertices[node.vertices.length - 1].point : node.vertices[0].point;
      if (node.type === "spline") return moving === "first" ? node.controlPoints[node.controlPoints.length - 1] : node.controlPoints[0];
      throw new Error("MOTION_RIG_GEOMETRY_UNSUPPORTED");
    }
    function add(point3, delta) {
      return cleanPoint([point3[0] + delta[0], point3[1] + delta[1]]);
    }
    function scale(point3, factor) {
      return [point3[0] * factor, point3[1] * factor];
    }
    function distance(left, right) {
      return Math.hypot(left[0] - right[0], left[1] - right[1]);
    }
    function finitePoint(point3) {
      return Number.isFinite(point3[0]) && Number.isFinite(point3[1]);
    }
    function cleanPoint(point3) {
      return [clean(point3[0]), clean(point3[1])];
    }
    function clean(value) {
      const rounded = Number(value.toFixed(9));
      return Object.is(rounded, -0) ? 0 : rounded;
    }
    const createStoreImpl = (createState) => {
      let state;
      const listeners = /* @__PURE__ */ new Set();
      const setState = (partial2, replace) => {
        const nextState = typeof partial2 === "function" ? partial2(state) : partial2;
        if (!Object.is(nextState, state)) {
          const previousState = state;
          state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
          listeners.forEach((listener) => listener(state, previousState));
        }
      };
      const getState = () => state;
      const getInitialState = () => initialState;
      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };
      const api = { setState, getState, getInitialState, subscribe };
      const initialState = state = createState(setState, getState, api);
      return api;
    };
    const createStore = ((createState) => createState ? createStoreImpl(createState) : createStoreImpl);
    const DEFAULT_VIEWPORT = {
      x: 0,
      y: 0,
      scale: 1,
      width: 0,
      height: 0
    };
    const DEFAULT_DISPLAY = {
      grid: true,
      axes: true,
      relations: true,
      annotations: true,
      sourceUnderlay: false
    };
    function createDrawingWorkspaceStore(input) {
      const { port } = input;
      let disposed = false;
      let unsubscribe;
      let requestController;
      let sourceResource = null;
      let selectionSequence = 0;
      let groundingCursor = null;
      let motionRigBaseSnapshot = null;
      let motionRigBaseProjection = null;
      let motionRigDragStart = null;
      let motionRigDragTarget = null;
      let motionRigCommands = [];
      let motionRigSettledCommands = [];
      let closedMotionRig = null;
      const store = createStore((set, get) => {
        const clearMotionRigSession = () => {
          motionRigBaseSnapshot = null;
          motionRigBaseProjection = null;
          motionRigDragStart = null;
          motionRigDragTarget = null;
          motionRigCommands = [];
          motionRigSettledCommands = [];
        };
        const clearClosedMotionRig = () => {
          closedMotionRig = null;
          set({ canRestoreMotionRig: false });
        };
        const restoreClosedMotionRig = (recovery, snapshot) => {
          const projection = structuredClone(recovery.projection);
          projection.drawingRef = structuredClone(snapshot.ref);
          motionRigBaseSnapshot = null;
          motionRigBaseProjection = null;
          motionRigDragStart = null;
          motionRigDragTarget = null;
          motionRigCommands = structuredClone(recovery.commands);
          motionRigSettledCommands = structuredClone(recovery.commands);
          closedMotionRig = null;
          set({
            canRestoreMotionRig: false,
            motionRig: {
              projection,
              phase: recovery.commands.length > 0 ? "preview" : "ready"
            },
            displaySnapshot: {
              ...structuredClone(snapshot),
              document: structuredClone(recovery.candidate.document)
            }
          });
        };
        const replaceSnapshot = async (snapshot, preview = null, groundingOverlay = null, motionRigProjection = null) => {
          const previousOverlay = get().groundingOverlay;
          const sameDrawing = snapshot !== null && (groundingCursor == null ? void 0 : groundingCursor.drawingId) === snapshot.ref.drawingId;
          if (!sameDrawing) groundingCursor = null;
          const overlayIsOlder = groundingOverlay !== null && groundingCursor !== null && groundingOverlay.drawingRef.drawingId === groundingCursor.drawingId && groundingOverlay.stateEpoch < groundingCursor.stateEpoch;
          const terminalOverlay = groundingOverlay !== null && groundingOverlay.disposition !== "active" && !overlayIsOlder && snapshot !== null && groundingOverlay.drawingRef.drawingId === snapshot.ref.drawingId;
          let currentGroundingOverlay;
          if (overlayIsOlder) {
            currentGroundingOverlay = groundingOverlayMatchesSnapshot(previousOverlay, snapshot) && previousOverlay.disposition === "active" ? structuredClone(previousOverlay) : null;
          } else if (terminalOverlay) {
            groundingCursor = {
              drawingId: groundingOverlay.drawingRef.drawingId,
              stateEpoch: groundingOverlay.stateEpoch
            };
            currentGroundingOverlay = null;
          } else if (groundingOverlayMatchesSnapshot(groundingOverlay, snapshot) && groundingOverlay.disposition === "active") {
            groundingCursor = {
              drawingId: groundingOverlay.drawingRef.drawingId,
              stateEpoch: groundingOverlay.stateEpoch
            };
            currentGroundingOverlay = structuredClone(groundingOverlay);
          } else {
            currentGroundingOverlay = null;
          }
          const currentPreview = !terminalOverlay && previewMatchesSnapshot(preview, snapshot) ? preview : null;
          const currentMotionRig = motionRigMatchesSnapshot(motionRigProjection, snapshot) ? { projection: structuredClone(motionRigProjection), phase: "ready" } : null;
          if (currentMotionRig !== null) currentGroundingOverlay = null;
          const displaySnapshot = (currentPreview == null ? void 0 : currentPreview.candidate) ?? snapshot;
          const nextIds = displaySnapshot === null ? /* @__PURE__ */ new Set() : drawingNodeIds(displaySnapshot);
          const selectedIds = get().selectedIds.filter((id) => nextIds.has(id));
          const previousSource = sourceResource;
          let nextSource = null;
          if ((snapshot == null ? void 0 : snapshot.source) !== void 0 && "width" in snapshot.source && port.loadSource !== void 0) {
            try {
              nextSource = await port.loadSource(snapshot.source, requestController == null ? void 0 : requestController.signal);
            } catch (error) {
              if ((requestController == null ? void 0 : requestController.signal.aborted) || disposed) return;
              set({ error: { code: "source_failed", message: errorMessage(error) } });
            }
          }
          if (disposed) {
            nextSource == null ? void 0 : nextSource.dispose();
            return;
          }
          clearMotionRigSession();
          if (previousSource !== nextSource) previousSource == null ? void 0 : previousSource.dispose();
          sourceResource = nextSource;
          set({
            snapshot,
            preview: currentPreview,
            groundingOverlay: currentGroundingOverlay,
            motionRig: currentMotionRig,
            displaySnapshot,
            sourceResource: nextSource,
            selectedIds,
            selectionProjection: null,
            status: snapshot === null ? "empty" : "ready"
          });
        };
        const refresh = async (initial) => {
          var _a2, _b, _c;
          if (disposed) return;
          clearClosedMotionRig();
          requestController == null ? void 0 : requestController.abort();
          const controller = new AbortController();
          requestController = controller;
          if (initial) set({ status: "loading", error: null });
          try {
            const [snapshot, preview, groundingOverlay, motionRig] = await Promise.all([
              port.load(controller.signal),
              ((_a2 = port.loadPreview) == null ? void 0 : _a2.call(port, controller.signal)) ?? Promise.resolve(null),
              ((_b = port.loadGroundingOverlay) == null ? void 0 : _b.call(port, controller.signal)) ?? Promise.resolve(null),
              ((_c = port.loadMotionRig) == null ? void 0 : _c.call(port, controller.signal)) ?? Promise.resolve(null)
            ]);
            if (controller.signal.aborted || disposed) return;
            await replaceSnapshot(snapshot, preview, groundingOverlay, motionRig);
          } catch (error) {
            if (controller.signal.aborted || disposed) return;
            set({
              status: get().snapshot === null ? "error" : get().status,
              error: { code: "load_failed", message: errorMessage(error) }
            });
          }
        };
        return {
          status: "idle",
          snapshot: null,
          preview: null,
          groundingOverlay: null,
          motionRig: null,
          canRestoreMotionRig: false,
          displaySnapshot: null,
          sourceResource: null,
          busy: false,
          error: null,
          viewport: { ...DEFAULT_VIEWPORT },
          selectedIds: [],
          selectionProjection: null,
          mouseWorld: null,
          display: { ...DEFAULT_DISPLAY },
          async load() {
            disposed = false;
            if (unsubscribe === void 0 && port.subscribe !== void 0) {
              unsubscribe = port.subscribe(() => {
                void refresh(false);
              });
            }
            await refresh(true);
          },
          async refresh() {
            await refresh(false);
          },
          async commit(request) {
            const current = get().snapshot;
            if (current === null || disposed) return false;
            clearClosedMotionRig();
            set({ busy: true, error: null });
            const controller = new AbortController();
            requestController = controller;
            try {
              const result = await port.commit({
                expectedRevision: current.ref.revision,
                commands: request.commands
              }, controller.signal);
              if (controller.signal.aborted || disposed) return false;
              if (result.status === "committed") {
                await replaceSnapshot(result.snapshot, null);
                return true;
              }
              if (result.status === "conflict") {
                if (result.snapshot !== void 0) await replaceSnapshot(result.snapshot);
                else await refresh(false);
                set({ error: { code: "revision_conflict", message: result.message } });
                return false;
              }
              set({ error: { code: "commit_failed", message: result.message } });
              return false;
            } catch (error) {
              if (controller.signal.aborted || disposed) return false;
              set({ error: { code: "commit_failed", message: errorMessage(error) } });
              return false;
            } finally {
              if (!disposed) set({ busy: false });
            }
          },
          async updateNode(id, changes) {
            const snapshot = get().snapshot;
            if (snapshot === null || !snapshot.capabilities.edit) return false;
            const command = buildNodeUpdateCommand(snapshot.document, id, changes);
            return command === null ? false : get().commit({ commands: [command] });
          },
          async deleteNodes(ids) {
            const snapshot = get().snapshot;
            if (snapshot === null || !snapshot.capabilities.delete) return false;
            const commands = buildNodeDeleteCommands(snapshot.document, ids);
            return commands.length === 0 ? false : get().commit({ commands });
          },
          async moveAnnotationText(id, position) {
            const snapshot = get().snapshot;
            if (snapshot === null || !snapshot.capabilities.annotations) return false;
            const command = buildAnnotationTextMoveCommand(snapshot.document, id, position);
            return command === null ? false : get().commit({ commands: [command] });
          },
          async undoLast() {
            var _a2;
            const snapshot = get().snapshot;
            if (snapshot === null || disposed) return false;
            const recovery = closedMotionRig === null ? null : structuredClone(closedMotionRig);
            if ((recovery == null ? void 0 : recovery.action) === "canceled") {
              restoreClosedMotionRig(recovery, snapshot);
              return true;
            }
            if (!((_a2 = snapshot.lastCommit) == null ? void 0 : _a2.undoable) || !port.undoLast) return false;
            set({ busy: true, error: null });
            const controller = new AbortController();
            requestController = controller;
            try {
              const result = await port.undoLast(snapshot, controller.signal);
              if (controller.signal.aborted || disposed) return false;
              if (result.status === "committed") {
                await replaceSnapshot(result.snapshot, null);
                if ((recovery == null ? void 0 : recovery.action) === "confirmed") {
                  restoreClosedMotionRig(recovery, result.snapshot);
                } else {
                  clearClosedMotionRig();
                }
                return true;
              }
              set({ error: { code: "undo_failed", message: result.message } });
              return false;
            } catch (error) {
              if (controller.signal.aborted || disposed) return false;
              set({ error: { code: "undo_failed", message: errorMessage(error) } });
              return false;
            } finally {
              if (!disposed) set({ busy: false });
            }
          },
          async redoLast() {
            var _a2;
            const snapshot = get().snapshot;
            if (!((_a2 = snapshot == null ? void 0 : snapshot.lastCommit) == null ? void 0 : _a2.redoable) || !port.redoLast || disposed) return false;
            set({ busy: true, error: null });
            const controller = new AbortController();
            requestController = controller;
            try {
              const result = await port.redoLast(snapshot, controller.signal);
              if (controller.signal.aborted || disposed) return false;
              if (result.status === "committed") {
                await replaceSnapshot(result.snapshot, null);
                clearClosedMotionRig();
                return true;
              }
              set({ error: { code: "redo_failed", message: result.message } });
              return false;
            } catch (error) {
              if (controller.signal.aborted || disposed) return false;
              set({ error: { code: "redo_failed", message: errorMessage(error) } });
              return false;
            } finally {
              if (!disposed) set({ busy: false });
            }
          },
          setViewport(viewport) {
            set({ viewport: { ...viewport } });
          },
          setMouseWorld(point3) {
            set({ mouseWorld: point3 === null ? null : [...point3] });
          },
          setSelection(ids) {
            const displaySnapshot = get().displaySnapshot;
            const available = displaySnapshot === null ? /* @__PURE__ */ new Set() : drawingNodeIds(displaySnapshot);
            const selectedIds = [...new Set(ids)].filter((id) => available.has(id));
            const sequence = ++selectionSequence;
            set({ selectedIds, selectionProjection: null });
            const snapshot = get().snapshot;
            if (snapshot === null || port.projectSelection === void 0) return;
            void port.projectSelection(snapshot.ref, selectedIds).then((result) => {
              var _a2;
              if (disposed || sequence !== selectionSequence || result.status !== "projected") return;
              const current = get();
              if (((_a2 = current.snapshot) == null ? void 0 : _a2.ref.drawingId) !== result.projection.drawingRef.drawingId || current.snapshot.ref.revision !== result.projection.drawingRef.revision || JSON.stringify(current.selectedIds) !== JSON.stringify(result.projection.nodeIds)) return;
              set({ selectionProjection: result.projection });
            }).catch(() => {
            });
          },
          async rebuildMotionRigFromSelection() {
            var _a2;
            const current = get();
            if (current.snapshot === null || current.motionRig === null || port.rebuildMotionRig === void 0) return false;
            const result = await port.rebuildMotionRig(
              current.snapshot.ref,
              current.selectedIds,
              requestController == null ? void 0 : requestController.signal
            );
            if (disposed) return false;
            if (result.status === "ready") {
              motionRigBaseSnapshot = structuredClone(current.snapshot);
              motionRigBaseProjection = structuredClone(result.projection);
              motionRigCommands = [];
              motionRigSettledCommands = [];
              motionRigDragStart = null;
              motionRigDragTarget = null;
              set({
                motionRig: { projection: structuredClone(result.projection), phase: "ready" },
                displaySnapshot: ((_a2 = current.preview) == null ? void 0 : _a2.candidate) ?? current.snapshot
              });
              return true;
            }
            if (result.status === "stale") await refresh(false);
            else set({
              motionRig: current.motionRig === null ? null : { ...current.motionRig, message: result.message }
            });
            return false;
          },
          beginMotionRigDrag(point3) {
            const current = get();
            if (current.motionRig === null || current.snapshot === null) return;
            motionRigBaseSnapshot = structuredClone(current.displaySnapshot ?? current.snapshot);
            motionRigBaseProjection = structuredClone(current.motionRig.projection);
            motionRigDragStart = [...point3];
            motionRigDragTarget = { kind: "control" };
            set({ motionRig: { ...current.motionRig, phase: "dragging", message: void 0 } });
          },
          beginMotionRigConnectorDrag(nodeId, point3) {
            const current = get();
            if (current.motionRig === null || current.snapshot === null || !current.motionRig.projection.connectors.some((connector) => connector.nodeId === nodeId)) return;
            motionRigBaseSnapshot = structuredClone(current.displaySnapshot ?? current.snapshot);
            motionRigBaseProjection = structuredClone(current.motionRig.projection);
            motionRigDragStart = [...point3];
            motionRigDragTarget = { kind: "connector", nodeId };
            set({ motionRig: { ...current.motionRig, phase: "dragging", message: void 0 } });
          },
          updateMotionRigDrag(point3) {
            var _a2;
            const current = get();
            if (((_a2 = current.motionRig) == null ? void 0 : _a2.phase) !== "dragging" || motionRigDragStart === null || motionRigBaseSnapshot === null || motionRigBaseProjection === null || motionRigDragTarget === null) return;
            try {
              const delta = [point3[0] - motionRigDragStart[0], point3[1] - motionRigDragStart[1]];
              const solved = motionRigDragTarget.kind === "control" ? solveTranslationMotionRig(motionRigBaseSnapshot.document, motionRigBaseProjection, delta) : solveMotionRigConnectorAttachment(
                motionRigBaseSnapshot.document,
                motionRigBaseProjection,
                motionRigDragTarget.nodeId,
                point3
              );
              motionRigCommands = [
                ...structuredClone(motionRigSettledCommands),
                ...structuredClone(solved.commands)
              ];
              set({
                displaySnapshot: { ...structuredClone(motionRigBaseSnapshot), document: solved.candidate },
                motionRig: {
                  ...current.motionRig,
                  projection: {
                    ...current.motionRig.projection,
                    handle: motionRigDragTarget.kind === "control" ? [
                      motionRigBaseProjection.handle[0] + delta[0],
                      motionRigBaseProjection.handle[1] + delta[1]
                    ] : structuredClone(motionRigBaseProjection.handle)
                  },
                  phase: "dragging",
                  message: void 0
                }
              });
            } catch (error) {
              set({ motionRig: { ...current.motionRig, message: errorMessage(error) } });
            }
          },
          finishMotionRigDrag() {
            var _a2;
            const current = get();
            if (((_a2 = current.motionRig) == null ? void 0 : _a2.phase) !== "dragging") return;
            motionRigSettledCommands = structuredClone(motionRigCommands);
            set({ motionRig: { ...current.motionRig, phase: motionRigCommands.length > 0 ? "preview" : "ready" } });
            motionRigDragStart = null;
            motionRigDragTarget = null;
          },
          resetMotionRigDrag() {
            var _a2;
            const current = get();
            if (((_a2 = current.motionRig) == null ? void 0 : _a2.phase) !== "dragging" || motionRigBaseProjection === null || motionRigBaseSnapshot === null) return;
            motionRigCommands = structuredClone(motionRigSettledCommands);
            motionRigDragStart = null;
            motionRigDragTarget = null;
            const projection = structuredClone(motionRigBaseProjection);
            const displaySnapshot = structuredClone(motionRigBaseSnapshot);
            motionRigBaseSnapshot = null;
            motionRigBaseProjection = null;
            set({
              motionRig: { projection, phase: motionRigSettledCommands.length > 0 ? "preview" : "ready" },
              displaySnapshot
            });
          },
          async confirmMotionRig() {
            var _a2, _b;
            const current = get();
            if (((_a2 = current.motionRig) == null ? void 0 : _a2.phase) !== "preview" || motionRigCommands.length === 0) return false;
            if (!motionRigCommandsBelongToProjection(motionRigCommands, current.motionRig.projection)) {
              set({
                motionRig: {
                  ...current.motionRig,
                  message: "当前编辑包含不属于当前铰链的图元，请重新生成铰链后再确认。"
                }
              });
              return false;
            }
            const recovery = {
              action: "confirmed",
              projection: structuredClone(current.motionRig.projection),
              candidate: structuredClone(current.displaySnapshot ?? current.snapshot),
              commands: structuredClone(motionRigCommands)
            };
            const commands = structuredClone(motionRigCommands);
            const committed = await get().commit({ commands });
            if (!committed) return false;
            const committedRef = (_b = get().snapshot) == null ? void 0 : _b.ref;
            if (committedRef && port.discardMotionRig) await port.discardMotionRig(committedRef);
            motionRigBaseSnapshot = null;
            motionRigBaseProjection = null;
            motionRigDragStart = null;
            motionRigDragTarget = null;
            motionRigCommands = [];
            motionRigSettledCommands = [];
            closedMotionRig = recovery;
            set({ motionRig: null, canRestoreMotionRig: true });
            return true;
          },
          async cancelMotionRig() {
            var _a2;
            const current = get();
            const recovery = current.motionRig === null || current.snapshot === null ? null : {
              action: "canceled",
              projection: structuredClone(current.motionRig.projection),
              candidate: structuredClone(current.displaySnapshot ?? current.snapshot),
              commands: structuredClone(motionRigCommands)
            };
            if (current.snapshot && port.discardMotionRig) {
              await port.discardMotionRig(current.snapshot.ref, requestController == null ? void 0 : requestController.signal);
            }
            motionRigBaseSnapshot = null;
            motionRigBaseProjection = null;
            motionRigDragStart = null;
            motionRigDragTarget = null;
            motionRigCommands = [];
            motionRigSettledCommands = [];
            closedMotionRig = recovery;
            set({
              motionRig: null,
              canRestoreMotionRig: recovery !== null,
              displaySnapshot: ((_a2 = current.preview) == null ? void 0 : _a2.candidate) ?? current.snapshot
            });
          },
          setDisplay(display) {
            set({ display: { ...get().display, ...display } });
          },
          clearError() {
            set({ error: null });
          },
          destroy() {
            if (disposed) return;
            disposed = true;
            requestController == null ? void 0 : requestController.abort();
            unsubscribe == null ? void 0 : unsubscribe();
            unsubscribe = void 0;
            sourceResource == null ? void 0 : sourceResource.dispose();
            sourceResource = null;
            motionRigBaseSnapshot = null;
            motionRigBaseProjection = null;
            motionRigDragStart = null;
            motionRigDragTarget = null;
            motionRigCommands = [];
            motionRigSettledCommands = [];
            closedMotionRig = null;
          }
        };
      });
      return store;
    }
    function motionRigMatchesSnapshot(rig, snapshot) {
      return rig !== null && snapshot !== null && rig.drawingRef.drawingId === snapshot.ref.drawingId && rig.drawingRef.revision === snapshot.ref.revision;
    }
    function motionRigCommandsBelongToProjection(commands, projection) {
      const allowedNodeIds = /* @__PURE__ */ new Set([
        ...projection.controlBodyNodeIds,
        ...projection.connectors.map(({ nodeId }) => nodeId)
      ]);
      return commands.every((command) => "id" in command && allowedNodeIds.has(command.id));
    }
    function drawingNodeIds(snapshot) {
      const { document: document2 } = snapshot;
      return /* @__PURE__ */ new Set([
        ...document2.geometry.map((node) => node.id),
        ...document2.annotations.map((node) => node.id),
        ...document2.relations.map((node) => node.id),
        ...document2.features.map((node) => node.id)
      ]);
    }
    function groundingOverlayMatchesSnapshot(overlay, snapshot) {
      return overlay !== null && snapshot !== null && overlay.drawingRef.drawingId === snapshot.ref.drawingId && overlay.drawingRef.revision === snapshot.ref.revision;
    }
    function previewMatchesSnapshot(preview, snapshot) {
      return preview !== null && snapshot !== null && preview.baseRef.drawingId === snapshot.ref.drawingId && preview.baseRef.revision === snapshot.ref.revision;
    }
    function errorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    }
    const DEFAULT_LIMIT = 100;
    const MAX_LIMIT = 200;
    const PLANE_ORDER = ["geometry", "annotation", "relation", "feature"];
    function queryDrawing(document2, query) {
      if (query.kind === "node") {
        return { kind: "node", node: cloneResult(findNode(document2, query.id)) };
      }
      if (query.kind === "neighbors") return queryNeighbors(document2, query);
      return queryWorldSlice(document2, query);
    }
    function queryWorldSlice(document2, query) {
      validateBounds(query.bounds);
      const limit = validateLimit(query.limit);
      const selectedPlanes = new Set(query.planes ?? PLANE_ORDER);
      const direct = /* @__PURE__ */ new Map();
      direct.set("geometry", selectedPlanes.has("geometry") ? document2.geometry.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: "geometry", node })) : []);
      direct.set("annotation", selectedPlanes.has("annotation") ? document2.annotations.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: "annotation", node })) : []);
      const directNodeIds = /* @__PURE__ */ new Set([
        ...(direct.get("geometry") ?? []).map(({ node }) => node.id),
        ...(direct.get("annotation") ?? []).map(({ node }) => node.id)
      ]);
      const relations = selectedPlanes.has("relation") ? document2.relations.filter((node) => referencedIds(node).some((id) => directNodeIds.has(id) || referencedNodeIntersects(document2, id, query.bounds))).map((node) => ({ plane: "relation", node })) : [];
      direct.set("relation", relations);
      const matchedIds = /* @__PURE__ */ new Set([...directNodeIds, ...relations.map(({ node }) => node.id)]);
      direct.set("feature", selectedPlanes.has("feature") ? document2.features.filter((node) => referencedIds(node).some((id) => matchedIds.has(id) || referencedNodeIntersects(document2, id, query.bounds))).map((node) => ({ plane: "feature", node })) : []);
      const totalByPlane = Object.fromEntries(PLANE_ORDER.map((plane) => {
        var _a2;
        return [
          plane,
          ((_a2 = direct.get(plane)) == null ? void 0 : _a2.length) ?? 0
        ];
      }));
      const all = PLANE_ORDER.flatMap((plane) => direct.get(plane) ?? []);
      return {
        kind: "world-slice",
        bounds: structuredClone(query.bounds),
        nodes: structuredClone(all.slice(0, limit)),
        totalByPlane,
        truncated: all.length > limit
      };
    }
    function queryNeighbors(document2, query) {
      const limit = validateLimit(query.limit);
      if (findNode(document2, query.nodeId) === null) {
        return { kind: "neighbors", nodeId: query.nodeId, nodes: [], truncated: false };
      }
      const related = document2.relations.filter((node) => referencedIds(node).includes(query.nodeId));
      const features = document2.features.filter((node) => referencedIds(node).includes(query.nodeId) || related.some((relation) => node.relationIds.includes(relation.id)));
      const ids = /* @__PURE__ */ new Set();
      for (const node of [...related, ...features]) {
        for (const id of referencedIds(node)) ids.add(id);
      }
      ids.delete(query.nodeId);
      const nodes = orderedNodes(document2).filter(({ node }) => ids.has(node.id) || related.some((relation) => relation.id === node.id) || features.some((feature) => feature.id === node.id));
      return {
        kind: "neighbors",
        nodeId: query.nodeId,
        nodes: structuredClone(nodes.slice(0, limit)),
        truncated: nodes.length > limit
      };
    }
    function findNode(document2, id) {
      return orderedNodes(document2).find(({ node }) => node.id === id) ?? null;
    }
    function orderedNodes(document2) {
      return [
        ...document2.geometry.map((node) => ({ plane: "geometry", node })),
        ...document2.annotations.map((node) => ({ plane: "annotation", node })),
        ...document2.relations.map((node) => ({ plane: "relation", node })),
        ...document2.features.map((node) => ({ plane: "feature", node }))
      ];
    }
    function cloneResult(result) {
      return result === null ? null : structuredClone(result);
    }
    function validateBounds(bounds) {
      const values = [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
      if (!values.every(Number.isFinite) || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
        throw new Error("INVALID_QUERY_BOUNDS");
      }
    }
    function validateLimit(limit) {
      const value = limit ?? DEFAULT_LIMIT;
      if (!Number.isInteger(value) || value < 1) throw new Error("INVALID_QUERY_LIMIT");
      if (value > MAX_LIMIT) throw new Error("QUERY_LIMIT_EXCEEDED");
      return value;
    }
    function referencedNodeIntersects(document2, id, bounds) {
      const result = findNode(document2, id);
      return result !== null && (result.plane === "geometry" || result.plane === "annotation") && intersectsNode(result.node, bounds);
    }
    function referencedIds(node) {
      if (node.type === "topology") return node.nodeIds;
      if (node.type === "constraint") return node.geometryIds;
      if (node.type === "association") return [node.annotationId, ...node.geometryIds];
      if (node.type === "semantic") return [node.featureId, ...node.nodeIds];
      return [...node.geometryIds, ...node.annotationIds, ...node.relationIds];
    }
    function intersectsNode(node, query) {
      if (node.type === "ray") return infiniteLineIntersects(node.origin, node.direction, query, true);
      if (node.type === "xline") return infiniteLineIntersects(node.origin, node.direction, query, false);
      return intersects(boundsOfNode(node), query);
    }
    function boundsOfNode(node) {
      switch (node.type) {
        case "point":
          return fromPoints([[node.x, node.y]]);
        case "line":
          return fromPoints([node.start, node.end]);
        case "circle":
          return radiusBounds(node.center, node.radius);
        case "arc":
          return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
        case "ellipse": {
          const [ax, ay] = node.majorAxis;
          const bx = -ay * node.ratio;
          const by = ax * node.ratio;
          return {
            minX: node.center[0] - Math.hypot(ax, bx),
            minY: node.center[1] - Math.hypot(ay, by),
            maxX: node.center[0] + Math.hypot(ax, bx),
            maxY: node.center[1] + Math.hypot(ay, by)
          };
        }
        case "polyline":
          return fromPoints(node.vertices.map(({ point: point3 }) => point3));
        case "spline":
          return splineBounds(node);
        case "text": {
          const width = node.maxWidth ?? Math.max(node.height, node.content.length * node.height * 0.6);
          return expandPoint(node.position, width, node.height);
        }
        case "dimension":
          return fromPoints([...node.definitionPoints, node.textPosition]);
        case "leader":
          return fromPoints(node.points);
        case "centerline":
          return fromPoints([node.start, node.end]);
        case "section-hatch": {
          if (node.hatch !== void 0) {
            const normalized = normalizeHatchRegion(node.hatch, 1e-3);
            return normalized.status === "ok" ? normalized.region.bounds : null;
          }
          return fromPoints((node.segments ?? []).flatMap(({ start, end }) => [start, end]));
        }
      }
    }
    function fromPoints(points) {
      if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      return {
        minX: Math.min(...points.map(([x]) => x)),
        minY: Math.min(...points.map(([, y]) => y)),
        maxX: Math.max(...points.map(([x]) => x)),
        maxY: Math.max(...points.map(([, y]) => y))
      };
    }
    function radiusBounds([x, y], radius) {
      return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
    }
    function arcBounds(center, radius, startAngle, endAngle, counterClockwise) {
      const angles = [startAngle, endAngle];
      for (const angle of [0, 90, 180, 270]) {
        if (angleOnArc(angle, startAngle, endAngle, counterClockwise)) angles.push(angle);
      }
      return fromPoints(angles.map((angle) => {
        const radians = angle * Math.PI / 180;
        return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
      }));
    }
    function angleOnArc(angle, start, end, counterClockwise) {
      const normalize = (value) => (value % 360 + 360) % 360;
      const a = normalize(angle);
      const s = normalize(start);
      const e = normalize(end);
      if (counterClockwise) return normalize(a - s) <= normalize(e - s);
      return normalize(s - a) <= normalize(s - e);
    }
    function expandPoint([x, y], width, height) {
      return { minX: x - width, minY: y - height, maxX: x + width, maxY: y + height };
    }
    function intersects(a, b) {
      return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
    }
    function infiniteLineIntersects(origin, direction, bounds, ray) {
      const [dx, dy] = direction;
      if (dx === 0 && dy === 0) return intersects(fromPoints([origin]), bounds);
      let low = ray ? 0 : Number.NEGATIVE_INFINITY;
      let high = Number.POSITIVE_INFINITY;
      for (const [coordinate, delta, min, max] of [
        [origin[0], dx, bounds.minX, bounds.maxX],
        [origin[1], dy, bounds.minY, bounds.maxY]
      ]) {
        if (delta === 0) {
          if (coordinate < min || coordinate > max) return false;
          continue;
        }
        const first = (min - coordinate) / delta;
        const second = (max - coordinate) / delta;
        low = Math.max(low, Math.min(first, second));
        high = Math.min(high, Math.max(first, second));
      }
      return low <= high;
    }
    function createStoreObservable(store, selector, equals = Object.is) {
      let source = selector(store.getState());
      let snapshot = cloneProjection(source);
      const refresh = () => {
        const next = selector(store.getState());
        if (equals(source, next)) return false;
        source = next;
        snapshot = cloneProjection(next);
        return true;
      };
      return {
        getSnapshot() {
          refresh();
          return snapshot;
        },
        subscribe(listener) {
          return store.subscribe(() => {
            if (refresh()) listener();
          });
        }
      };
    }
    function createDrawingSurfaceRuntime(store) {
      return {
        snapshot: createStoreObservable(store, (state) => state.snapshot),
        viewport: createStoreObservable(store, (state) => state.viewport, viewportEqual),
        selection: createStoreObservable(store, (state) => state.selectedIds, stringArrayEqual),
        presentation: createStoreObservable(store, presentationOf, presentationEqual),
        actions: {
          setViewport(viewport) {
            store.getState().setViewport({ ...viewport });
          },
          setSelection(ids) {
            store.getState().setSelection([...ids]);
          },
          async refresh() {
            await store.getState().refresh();
          },
          async query(request, signal) {
            signal == null ? void 0 : signal.throwIfAborted();
            const snapshot = store.getState().snapshot;
            if (snapshot === null) throw new Error("DRAWING_SURFACE_EMPTY");
            return queryDrawing(snapshot.document, request);
          },
          async stage(request, signal) {
            var _a2;
            signal == null ? void 0 : signal.throwIfAborted();
            if (((_a2 = store.getState().snapshot) == null ? void 0 : _a2.ref.revision) !== request.expectedRevision) return false;
            return store.getState().commit({ commands: structuredClone(request.commands) });
          },
          async undo(signal) {
            signal == null ? void 0 : signal.throwIfAborted();
            return store.getState().undoLast();
          },
          async redo(signal) {
            signal == null ? void 0 : signal.throwIfAborted();
            return store.getState().redoLast();
          }
        }
      };
    }
    function cloneProjection(value) {
      return structuredClone(value);
    }
    function viewportEqual(left, right) {
      return left.x === right.x && left.y === right.y && left.scale === right.scale && left.width === right.width && left.height === right.height;
    }
    function stringArrayEqual(left, right) {
      return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    function presentationEqual(left, right) {
      return left.displaySnapshot === right.displaySnapshot && left.preview === right.preview && left.groundingOverlay === right.groundingOverlay && left.motionRig === right.motionRig && left.sourceUrl === right.sourceUrl && left.display === right.display && left.busy === right.busy && left.error === right.error;
    }
    function presentationOf(state) {
      var _a2;
      return {
        displaySnapshot: state.displaySnapshot,
        preview: state.preview,
        groundingOverlay: state.groundingOverlay,
        motionRig: state.motionRig,
        sourceUrl: ((_a2 = state.sourceResource) == null ? void 0 : _a2.url) ?? null,
        display: state.display,
        busy: state.busy,
        error: state.error
      };
    }
    const DRAWING_SURFACE_API_VERSION = 1;
    const DRAWING_SURFACE_REFRESH_EVENT = "vectorai:drawing-surface-refresh";
    function createDshDrawingWorkspacePort(input) {
      const { sessionId, remote, commands, resolveImage } = input;
      return {
        async load(signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          const result = await remote.getSnapshot(sessionId);
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async projectSelection(ref, nodeIds, signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          const result = await remote.projectSelection(sessionId, {
            expectedRef: ref,
            nodeIds
          });
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async loadGroundingOverlay(signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (remote.getGroundingOverlay === void 0) return null;
          const result = await remote.getGroundingOverlay(sessionId);
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async loadMotionRig(signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (remote.getMotionRig === void 0) return null;
          const result = await remote.getMotionRig(sessionId);
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async rebuildMotionRig(ref, nodeIds, signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (remote.rebuildMotionRig === void 0) {
            return { status: "rejected", code: "MOTION_RIG_UNAVAILABLE", message: "Motion rig correction is unavailable." };
          }
          const result = await remote.rebuildMotionRig(sessionId, { ref, nodeIds });
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async discardMotionRig(ref, signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (remote.discardMotionRig === void 0) {
            return { status: "rejected", code: "MOTION_RIG_UNAVAILABLE", message: "Motion rig discard is unavailable." };
          }
          const result = await remote.discardMotionRig(sessionId, { ref });
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async commit(request, signal) {
          var _a2;
          signal == null ? void 0 : signal.throwIfAborted();
          const staged = unwrap(await remote.stageInteractiveEdit(sessionId, request));
          if (staged.status !== "staged") return staged;
          let execution;
          try {
            execution = await commands.execute(sessionId, staged.commandLine, [], signal);
          } catch {
            execution = void 0;
          }
          if ((execution == null ? void 0 : execution.ok) === true && ((_a2 = execution.value) == null ? void 0 : _a2.result.kind) === "success") {
            return committedSnapshot(remote, sessionId);
          }
          return reconcileInteractive(remote, sessionId, staged);
        },
        async undoLast(snapshot, signal) {
          var _a2;
          const last = snapshot.lastCommit;
          if (!(last == null ? void 0 : last.undoable)) return { status: "rejected", code: "UNDO_UNAVAILABLE", message: "No undoable Drawing commit is current." };
          signal == null ? void 0 : signal.throwIfAborted();
          const staged = unwrap(await remote.stageUndo(sessionId, {
            targetCommitId: last.commitId,
            expectedCurrentRef: snapshot.ref
          }));
          if (staged.status !== "staged") return staged;
          let execution;
          try {
            execution = await commands.execute(sessionId, staged.commandLine, [], signal);
          } catch {
            execution = void 0;
          }
          if ((execution == null ? void 0 : execution.ok) === true && ((_a2 = execution.value) == null ? void 0 : _a2.result.kind) === "success") {
            return committedSnapshot(remote, sessionId);
          }
          const lookup = unwrap(await remote.getOperation(
            sessionId,
            staged.operationId,
            staged.operationBindingDigest
          ));
          if (lookup.status === "committed") return committedSnapshot(remote, sessionId);
          return { status: "rejected", code: "COMMIT_OUTCOME_UNKNOWN", message: "Undo outcome is uncertain; refresh the Drawing before retrying." };
        },
        async redoLast(snapshot, signal) {
          var _a2;
          const last = snapshot.lastCommit;
          if (!(last == null ? void 0 : last.redoable) || remote.stageRedo === void 0) {
            return { status: "rejected", code: "REDO_UNAVAILABLE", message: "No redoable Drawing Undo is current." };
          }
          signal == null ? void 0 : signal.throwIfAborted();
          const staged = unwrap(await remote.stageRedo(sessionId, {
            targetCommitId: last.commitId,
            expectedCurrentRef: snapshot.ref
          }));
          if (staged.status !== "staged") return staged;
          let execution;
          try {
            execution = await commands.execute(sessionId, staged.commandLine, [], signal);
          } catch {
            execution = void 0;
          }
          if ((execution == null ? void 0 : execution.ok) === true && ((_a2 = execution.value) == null ? void 0 : _a2.result.kind) === "success") {
            return committedSnapshot(remote, sessionId);
          }
          const lookup = unwrap(await remote.getOperation(
            sessionId,
            staged.operationId,
            staged.operationBindingDigest
          ));
          if (lookup.status === "committed") return committedSnapshot(remote, sessionId);
          return { status: "rejected", code: "COMMIT_OUTCOME_UNKNOWN", message: "Redo outcome is uncertain; refresh the Drawing before retrying." };
        },
        async loadPreview(signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (remote.getPreview === void 0) return null;
          const result = await remote.getPreview(sessionId);
          signal == null ? void 0 : signal.throwIfAborted();
          return unwrap(result);
        },
        async loadSource(source, signal) {
          signal == null ? void 0 : signal.throwIfAborted();
          if (!("width" in source)) throw new Error("DRAWING_IMAGE_SOURCE_REQUIRED");
          const attachment = {
            attachmentId: source.id,
            mediaType: source.mediaType,
            bytes: source.bytes ?? 0,
            width: source.width,
            height: source.height,
            ...source.name === void 0 ? {} : { name: source.name }
          };
          const url = await resolveImage(sessionId, attachment);
          signal == null ? void 0 : signal.throwIfAborted();
          return { url, dispose() {
          } };
        }
      };
    }
    async function reconcileInteractive(remote, sessionId, staged) {
      const lookup = unwrap(await remote.getOperation(sessionId, staged.operationId, staged.operationBindingDigest));
      if (lookup.status === "committed" || lookup.status === "no-effect") return committedSnapshot(remote, sessionId);
      if (lookup.status === "pending" || lookup.status === "outcome-unknown" || lookup.status === "recovering") return {
        status: "rejected",
        code: "COMMIT_OUTCOME_UNKNOWN",
        message: "The local Drawing write outcome is still being reconciled. Refresh before retrying."
      };
      return {
        status: "rejected",
        code: lookup.status === "digest-mismatch" ? "IDEMPOTENCY_KEY_REUSED" : "INTERACTIVE_COMMAND_FAILED",
        message: "The staged Drawing gesture was not committed."
      };
    }
    async function committedSnapshot(remote, sessionId) {
      const snapshot = unwrap(await remote.getSnapshot(sessionId));
      return snapshot === null ? { status: "rejected", code: "DRAWING_REQUIRED", message: "The committed Drawing is unavailable." } : { status: "committed", snapshot };
    }
    function unwrap(result) {
      if (result.ok === true) return result.value;
      throw new Error(result.error.message);
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
    const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
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
      def.pattern ?? (def.pattern = base64);
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
    const ZodIssueCode = {
      custom: "custom"
    };
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
    const taskRefSchema = object({
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
    const operationBase = {
      operationId: protocolIdSchema,
      sessionId: protocolIdSchema,
      drawingId: protocolIdSchema
    };
    discriminatedUnion("mode", [
      object({
        ...operationBase,
        mode: literal("semantic"),
        candidateDigest: contentDigestSchema,
        previewHandle: protocolIdSchema
      }).strict(),
      object({
        ...operationBase,
        mode: literal("interactive"),
        intentId: protocolIdSchema,
        intentDigest: contentDigestSchema,
        effectDigest: contentDigestSchema
      }).strict(),
      object({
        ...operationBase,
        mode: literal("genesis"),
        sourceDigest: contentDigestSchema
      }).strict(),
      object({
        ...operationBase,
        mode: literal("undo"),
        targetCommitId: protocolIdSchema,
        expectedCurrentRef: drawingRefSchema
      }).strict(),
      object({
        ...operationBase,
        mode: literal("redo"),
        targetCommitId: protocolIdSchema,
        expectedCurrentRef: drawingRefSchema
      }).strict()
    ]);
    const committedReceiptBase = {
      operationId: protocolIdSchema,
      operationBindingDigest: contentDigestSchema,
      sessionId: protocolIdSchema,
      drawingId: protocolIdSchema,
      parentRef: drawingRefSchema,
      resultingRef: drawingRefSchema,
      commitId: protocolIdSchema,
      semanticDigest: contentDigestSchema,
      snapshotIntegrityDigest: contentDigestSchema
    };
    const committedOperationReceiptSchema = discriminatedUnion("mode", [
      object({ ...committedReceiptBase, status: literal("committed"), mode: literal("semantic") }).strict(),
      object({ ...committedReceiptBase, status: literal("committed"), mode: literal("interactive") }).strict(),
      object({ ...committedReceiptBase, status: literal("committed"), mode: literal("undo"), targetCommitId: protocolIdSchema }).strict(),
      object({ ...committedReceiptBase, status: literal("committed"), mode: literal("redo"), targetCommitId: protocolIdSchema }).strict()
    ]);
    const durableOperationReceiptSchema = union([
      committedOperationReceiptSchema,
      object({
        status: literal("initialized"),
        mode: literal("genesis"),
        operationId: protocolIdSchema,
        operationBindingDigest: contentDigestSchema,
        sessionId: protocolIdSchema,
        drawingId: protocolIdSchema,
        resultingRef: drawingRefSchema,
        semanticDigest: contentDigestSchema,
        snapshotIntegrityDigest: contentDigestSchema,
        initialTask: taskRefSchema,
        taskStatus: _enum(["active", "expired"])
      }).strict(),
      object({
        status: literal("no-effect"),
        mode: _enum(["semantic", "interactive"]),
        operationId: protocolIdSchema,
        operationBindingDigest: contentDigestSchema,
        sessionId: protocolIdSchema,
        drawingId: protocolIdSchema,
        ref: drawingRefSchema,
        semanticDigest: contentDigestSchema
      }).strict()
    ]);
    const operationLookupResultSchema = discriminatedUnion("status", [
      object({ status: literal("committed"), receipt: durableOperationReceiptSchema }).strict(),
      object({ status: literal("no-effect"), receipt: durableOperationReceiptSchema }).strict(),
      object({
        status: literal("pending"),
        operationId: protocolIdSchema,
        operationBindingDigest: contentDigestSchema
      }).strict(),
      object({
        status: literal("outcome-unknown"),
        operationId: protocolIdSchema,
        operationBindingDigest: contentDigestSchema
      }).strict(),
      object({
        status: literal("recovering"),
        operationId: protocolIdSchema,
        operationBindingDigest: contentDigestSchema,
        retryAfterMs: number().int().positive().max(6e4)
      }).strict(),
      object({ status: literal("absent") }).strict(),
      object({
        status: literal("digest-mismatch"),
        operationId: protocolIdSchema
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
    const toleranceProjectionSchema = object({
      mode: _enum(["none", "bilateral", "unilateral", "limits", "fit"]),
      upperDeviation: number().finite().optional(),
      lowerDeviation: number().finite().optional(),
      upperLimit: number().finite().optional(),
      lowerLimit: number().finite().optional(),
      fitDesignation: string().min(1).max(32).optional(),
      unit: _enum(["mm", "cm", "m", "deg"]),
      status: _enum(["candidate", "resolved", "confirmed", "conflict"]),
      source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
      ruleRef: object({
        id: idSchema,
        version: idSchema,
        inputDigest: idSchema
      }).strict().optional(),
      evidenceRefs: array(idSchema)
    }).strict().superRefine((value, context) => {
      if (value.mode === "limits" && (value.lowerLimit === void 0 || value.upperLimit === void 0 || value.lowerLimit > value.upperLimit)) {
        context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_LIMIT_ORDER" });
      }
      if (value.mode === "bilateral" && (value.upperDeviation === void 0 || value.lowerDeviation === void 0)) {
        context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATIONS_REQUIRED" });
      }
      if (value.mode === "unilateral" && value.upperDeviation === void 0 && value.lowerDeviation === void 0) {
        context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATION_REQUIRED" });
      }
      if (value.mode === "fit" && value.fitDesignation === void 0) {
        context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_FIT_REQUIRED" });
      }
      if (value.status === "confirmed" && value.evidenceRefs.length === 0) {
        context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_EVIDENCE_REQUIRED" });
      }
    });
    const datumReferenceSchema = object({
      datumId: idSchema,
      role: _enum(["primary", "secondary", "tertiary", "origin"]),
      geometryId: idSchema,
      anchor: entityAnchorSchema
    }).strict();
    const hatchBoundaryEdgeSchema = discriminatedUnion("type", [
      object({ type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
      object({
        type: literal("arc"),
        center: vec2Schema,
        radius: number().positive(),
        startAngle: number(),
        endAngle: number(),
        counterClockwise: boolean()
      }).strict(),
      object({
        type: literal("ellipse"),
        center: vec2Schema,
        majorAxis: vec2Schema,
        axisRatio: number().positive(),
        startParameter: number(),
        endParameter: number(),
        counterClockwise: boolean()
      }).strict(),
      object({
        type: literal("spline"),
        degree: number().int().positive(),
        rational: boolean(),
        periodic: boolean(),
        knots: array(number()),
        controlPoints: array(vec2Schema),
        weights: array(number()).optional(),
        fitPoints: array(vec2Schema).optional()
      }).strict()
    ]);
    const parametricHatchSchema = object({
      version: literal(1),
      style: _enum(["normal", "outer", "ignore"]),
      elevation: number(),
      extrusion: tuple([number(), number(), number()]),
      boundaryPaths: array(object({
        flags: number().int().nonnegative(),
        closed: boolean(),
        edges: array(hatchBoundaryEdgeSchema).min(1)
      }).strict()).min(1),
      patternLines: array(object({
        angle: number(),
        base: vec2Schema,
        offset: vec2Schema,
        dashLengths: array(number())
      }).strict()),
      patternAngle: number(),
      patternScale: number().positive(),
      double: boolean()
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
        toleranceProjection: toleranceProjectionSchema.optional(),
        datumReferences: array(datumReferenceSchema).optional(),
        engineeringIntentId: idSchema.optional(),
        engineeringChainIds: array(idSchema).optional(),
        generationOrder: number().int().nonnegative().optional(),
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
        hatch: parametricHatchSchema.optional(),
        segments: array(object({ start: vec2Schema, end: vec2Schema }).strict()).optional()
      }).strict().refine((value) => value.hatch !== void 0 || value.segments !== void 0, {
        message: "SECTION_HATCH_REPRESENTATION_REQUIRED"
      })
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
    const drawingQueryRequestSchema = discriminatedUnion("kind", [
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
    const drawingQueryResultSchema = discriminatedUnion("kind", [
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
    const drawingWorkspaceCommitRequestSchema = object({
      expectedRevision: number().int().nonnegative(),
      commands: array(workspaceCommandSchema).min(1)
    }).strict();
    discriminatedUnion("status", [
      object({ status: literal("committed"), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
      object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
      object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
    ]);
    const drawingInteractiveStageResultSchema = discriminatedUnion("status", [
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
    const drawingUndoStageRequestSchema = object({
      targetCommitId: idSchema,
      expectedCurrentRef: drawingRefSchema
    }).strict();
    const drawingUndoStageResultSchema = discriminatedUnion("status", [
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
    const drawingRedoStageRequestSchema = drawingUndoStageRequestSchema;
    const drawingRedoStageResultSchema = discriminatedUnion("status", [
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
    const drawingSelectionProjectionRequestSchema = object({
      expectedRef: drawingRefSchema,
      nodeIds: array(idSchema).max(256)
    }).strict();
    const drawingSelectionProjectionResultSchema = discriminatedUnion("status", [
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
    const drawingMotionRigRebuildRequestSchema = object({
      ref: drawingRefSchema,
      nodeIds: array(idSchema).min(1).max(256)
    }).strict();
    const drawingMotionRigResultSchema = discriminatedUnion("status", [
      object({ status: literal("ready"), projection: drawingMotionRigProjectionSchema }).strict(),
      object({
        status: literal("needs-correction"),
        projection: drawingMotionRigProjectionSchema.optional(),
        message: string().min(1)
      }).strict(),
      object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
      object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
    ]);
    const drawingMotionRigDiscardRequestSchema = object({ ref: drawingRefSchema }).strict();
    const drawingMotionRigDiscardResultSchema = discriminatedUnion("status", [
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
    const drawingGroundingOverlaySchema = object({
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
    const extensionPreviewCreateRequestSchema = object({
      ...extensionOwnershipShape,
      targetNodeIds: array(idSchema).min(1).max(256),
      interfaces: array(extensionInterfaceSchema).max(256).optional(),
      program: spatialEditProgramSchema
    }).strict();
    const extensionPreviewControlRequestSchema = object({
      ...extensionOwnershipShape,
      previewToken: idSchema,
      candidateDigest: idSchema
    }).strict();
    const extensionPreviewReplaceRequestSchema = object({
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
    const extensionPreviewCreateResultSchema = discriminatedUnion("status", [
      extensionPreviewReadyResultSchema,
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    const extensionPreviewAssessmentResultSchema = discriminatedUnion("status", [
      object({
        status: literal("assessed"),
        previewToken: idSchema,
        candidateDigest: idSchema,
        assessment: assessmentSchema
      }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    const extensionPreviewFinalizeResultSchema = discriminatedUnion("status", [
      object({ status: literal("finalized"), result: finalizePreviewResultSchema }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    const extensionPreviewDiscardResultSchema = discriminatedUnion("status", [
      object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
      extensionNeedsRebaseResultSchema,
      extensionRejectedResultSchema
    ]);
    object({
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
      range: object({ zStart: number(), zEnd: number() }).strict().optional(),
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
    discriminatedUnion("type", [
      object({ type: literal("boundary.move"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive(), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
      object({ type: literal("semantic-range.move"), expectedDrawingRef: drawingRefSchema, groupId: idSchema, edge: _enum(["start", "end"]), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
      object({ type: literal("segment.split"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, z: number(), snapTolerance: number().nonnegative() }).strict(),
      object({ type: literal("boundary.merge"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive() }).strict(),
      object({ type: literal("segment.metadata"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, name: string().max(120).optional(), semanticType: string().max(80).optional() }).strict()
    ]);
    object({
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
    const sha256DigestSchema = string().regex(/^sha256:[a-f0-9]{64}$/u);
    const engineeringDocumentInputSchema = object({
      name: string().trim().min(1).max(255),
      digest: sha256DigestSchema,
      mediaType: string().trim().min(1).max(127).optional(),
      base64: string().min(1).max(27962028)
    }).strict();
    object({
      dxf: object({ name: string().min(1).max(255), digest: idSchema, base64: string().min(1).max(27962028) }).strict(),
      engineeringDocuments: array(engineeringDocumentInputSchema).max(16).optional(),
      engineeringDocument: object({ name: string().min(1).max(255), text: string() }).strict().optional()
    }).strict().superRefine((request, context) => {
      if (request.engineeringDocuments !== void 0 && request.engineeringDocument !== void 0) {
        context.addIssue({ code: "custom", path: ["engineeringDocuments"], message: "ENGINEERING_DOCUMENT_INPUT_AMBIGUOUS" });
      }
    });
    object({
      expectedDrawingRef: drawingRefSchema,
      engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
    }).strict();
    object({
      engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
    }).strict();
    const engineeringDiagnosticSchema = object({
      id: idSchema,
      severity: _enum(["info", "warning", "error"]),
      code: idSchema,
      message: string(),
      entityIds: array(idSchema).optional(),
      evidenceIds: array(idSchema).optional()
    }).strict();
    const engineeringStateSchema = _enum(["candidate", "resolved", "confirmed", "conflict", "stale"]);
    const engineeringDatumSchema = object({
      id: idSchema,
      drawingRef: drawingRefSchema,
      name: string().min(1).max(120),
      geometryId: idSchema,
      anchor: entityAnchorSchema,
      role: _enum(["primary", "secondary", "tertiary", "origin"]),
      source: _enum(["document", "geometry", "manual", "ai-candidate"]),
      status: _enum(["candidate", "confirmed", "conflict", "stale"]),
      evidenceIds: array(idSchema)
    }).strict();
    const dimensionIntentSchema = object({
      id: idSchema,
      drawingRef: drawingRefSchema,
      kind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
      targets: array(dimensionTargetSchema),
      datumIds: array(idSchema),
      nominalValue: number().finite(),
      unit: _enum(["mm", "cm", "m", "deg"]),
      functionalRole: _enum(["datum", "overall", "functional", "assembly", "process", "inspection", "auxiliary", "closure"]),
      source: _enum(["document", "geometry", "manual", "ai-candidate"]),
      status: engineeringStateSchema,
      evidenceIds: array(idSchema)
    }).strict();
    const resolvedToleranceSchema = object({
      upperDeviation: number().finite().optional(),
      lowerDeviation: number().finite().optional(),
      upperLimit: number().finite().optional(),
      lowerLimit: number().finite().optional(),
      fitDesignation: string().min(1).max(32).optional(),
      inputDigest: idSchema,
      evaluatedAt: number().finite()
    }).strict();
    const toleranceSpecSchema = object({
      id: idSchema,
      dimensionIntentId: idSchema,
      mode: _enum(["bilateral", "unilateral", "limits", "fit", "formula"]),
      source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
      ruleRef: object({ id: idSchema, version: idSchema }).strict().optional(),
      inputs: record(string(), union([number().finite(), string(), boolean()])),
      resolved: resolvedToleranceSchema.optional(),
      status: engineeringStateSchema,
      evidenceIds: array(idSchema),
      diagnostics: array(engineeringDiagnosticSchema)
    }).strict();
    const dimensionChainSchema = object({
      id: idSchema,
      drawingRef: drawingRefSchema,
      name: string().max(120).optional(),
      datumIds: array(idSchema),
      members: array(object({
        dimensionIntentId: idSchema,
        coefficient: union([literal(1), literal(-1)]),
        role: _enum(["functional", "component", "closure"]),
        sequenceHint: number().int().optional()
      }).strict()),
      equation: object({
        closureIntentId: idSchema,
        targetValue: number().finite().optional()
      }).strict(),
      analysisMode: _enum(["worst-case", "statistical", "reference-only"]),
      status: engineeringStateSchema,
      evidenceIds: array(idSchema),
      diagnostics: array(engineeringDiagnosticSchema)
    }).strict();
    const annotationDependencySchema = object({
      beforeIntentId: idSchema,
      afterIntentId: idSchema,
      reason: _enum(["datum-before-dependent", "overall-before-functional", "functional-before-component", "component-before-closure", "explicit-document-order"]),
      evidenceIds: array(idSchema)
    }).strict();
    const engineeringAnnotationDraftSchema = object({
      version: literal(1),
      drawingRef: drawingRefSchema,
      datums: array(engineeringDatumSchema),
      intents: array(dimensionIntentSchema),
      tolerances: array(toleranceSpecSchema),
      chains: array(dimensionChainSchema),
      dependencies: array(annotationDependencySchema),
      diagnostics: array(engineeringDiagnosticSchema),
      baseRevisionId: idSchema.optional()
    }).strict();
    const engineeringAnnotationRevisionSchema = engineeringAnnotationDraftSchema.omit({
      baseRevisionId: true
    }).extend({
      id: idSchema,
      parentRevisionId: idSchema.optional(),
      generationOrder: array(idSchema),
      confirmedAt: number().finite()
    }).strict();
    object({
      version: literal(1),
      phase: _enum(["idle", "editing", "confirmed", "needs-rebase", "failed"]),
      drawingRef: drawingRefSchema.optional(),
      draft: engineeringAnnotationDraftSchema.optional(),
      confirmed: engineeringAnnotationRevisionSchema.optional(),
      canUndo: boolean(),
      canRedo: boolean(),
      message: string().optional(),
      updatedAt: number().finite()
    }).strict();
    const agentCodec = {
      mode: "strict",
      typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
      schema: drawingSessionIdSchema
    };
    const nonEmptyStringSchema = string().min(1);
    const agentParameter = {
      name: "agent",
      wire: "agentId",
      source: "lookup",
      lookup: "agent",
      codec: agentCodec
    };
    const DRAWING_SPACE_REMOTE = {
      package: "@vectorai/plugin-dsh-space-host",
      descriptors: [{
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/getSnapshot",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "getSnapshot",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingWorkspaceSnapshot|null", schema: drawingWorkspaceSnapshotSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/query",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "query",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingQueryRequest", drawingQueryRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingQueryResult", schema: drawingQueryResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/projectSelection",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "projectSelection",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingSelectionProjectionRequest", drawingSelectionProjectionRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingSelectionProjectionResult", schema: drawingSelectionProjectionResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/getGroundingOverlay",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "getGroundingOverlay",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter],
        result: {
          mode: "strict",
          typeSymbol: "@vectorai/plugin-space-contracts#DrawingGroundingOverlay|null",
          schema: drawingGroundingOverlaySchema.nullable()
        }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/getMotionRig",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "getMotionRig",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter],
        result: {
          mode: "strict",
          typeSymbol: "@vectorai/plugin-space-contracts#DrawingMotionRigProjection|null",
          schema: drawingMotionRigProjectionSchema.nullable()
        }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/rebuildMotionRig",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "rebuildMotionRig",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingMotionRigRebuildRequest", drawingMotionRigRebuildRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingMotionRigResult", schema: drawingMotionRigResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/discardMotionRig",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "discardMotionRig",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingMotionRigDiscardRequest", drawingMotionRigDiscardRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingMotionRigDiscardResult", schema: drawingMotionRigDiscardResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/createExtensionPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "createExtensionPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#ExtensionPreviewCreateRequest", extensionPreviewCreateRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#ExtensionPreviewCreateResult", schema: extensionPreviewCreateResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/replaceExtensionPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "replaceExtensionPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#ExtensionPreviewReplaceRequest", extensionPreviewReplaceRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#ExtensionPreviewCreateResult", schema: extensionPreviewCreateResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/assessExtensionPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "assessExtensionPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#ExtensionPreviewControlRequest", extensionPreviewControlRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#ExtensionPreviewAssessmentResult", schema: extensionPreviewAssessmentResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/finalizeExtensionPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "finalizeExtensionPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#ExtensionPreviewControlRequest", extensionPreviewControlRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#ExtensionPreviewFinalizeResult", schema: extensionPreviewFinalizeResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/discardExtensionPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "discardExtensionPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#ExtensionPreviewControlRequest", extensionPreviewControlRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#ExtensionPreviewDiscardResult", schema: extensionPreviewDiscardResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/getPreview",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "getPreview",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingWorkspacePreview|null", schema: drawingPreviewSchema.nullable() }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/stageInteractiveEdit",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "stageInteractiveEdit",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingWorkspaceCommitRequest", drawingWorkspaceCommitRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingInteractiveStageResult", schema: drawingInteractiveStageResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/stageUndo",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "stageUndo",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingUndoStageRequest", drawingUndoStageRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingUndoStageResult", schema: drawingUndoStageResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/stageRedo",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "stageRedo",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, jsonRequest("@vectorai/plugin-space-contracts#DrawingRedoStageRequest", drawingRedoStageRequestSchema)],
        result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#DrawingRedoStageResult", schema: drawingRedoStageResultSchema }
      }, {
        id: "@vectorai/plugin-dsh-space-host#drawingSpace/getOperation",
        service: "drawingSpace",
        namespace: "drawingSpace",
        method: "getOperation",
        invocation: { kind: "direct" },
        scope: { context: "agent", wire: "agentId" },
        parameters: [agentParameter, stringParameter("operationId"), stringParameter("operationBindingDigest")],
        result: { mode: "strict", typeSymbol: "@vectorai/drawing-edit-protocol#OperationLookupResult", schema: operationLookupResultSchema }
      }]
    };
    function jsonRequest(typeSymbol, schema) {
      return { name: "request", wire: "request", source: "json", codec: { mode: "strict", typeSymbol, schema } };
    }
    function stringParameter(name) {
      return {
        name,
        wire: name,
        source: "json",
        codec: { mode: "strict", typeSymbol: "string", schema: nonEmptyStringSchema }
      };
    }
    function DrawingSurfaceHost({
      sessionId,
      registry: registry2,
      runtime,
      fallback
    }) {
      const subscribeRegistry = react.useCallback(
        (listener) => registry2.subscribe(sessionId, listener),
        [registry2, sessionId]
      );
      const readElectedId = react.useCallback(
        () => registry2.getWorkspaceSnapshot(sessionId).electedId,
        [registry2, sessionId]
      );
      const electedId = react.useSyncExternalStore(subscribeRegistry, readElectedId, readElectedId);
      const snapshot = useSurfaceObservable(runtime.snapshot);
      const contribution = electedId === null ? null : registry2.getWorkspaceContribution(electedId);
      if (contribution !== null) {
        const SpecializedWorkspace = contribution.Component;
        return /* @__PURE__ */ jsxRuntime.jsx(ContributionErrorBoundary, { contribution, children: /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            "data-drawing-surface-contribution": contribution.id,
            "data-drawing-surface-namespace": contribution.id,
            "data-conversation-workspace-active": "",
            style: { display: "flex", flex: "1 1 auto", minWidth: 0, minHeight: 0 },
            children: /* @__PURE__ */ jsxRuntime.jsx(
              SpecializedWorkspace,
              {
                sessionId,
                namespace: contribution.id,
                runtime
              }
            )
          }
        ) }, contribution.id);
      }
      return snapshot === null ? null : fallback;
    }
    function useSurfaceObservable(observable) {
      return react.useSyncExternalStore(observable.subscribe, observable.getSnapshot, observable.getSnapshot);
    }
    class ContributionErrorBoundary extends react.Component {
      constructor() {
        super(...arguments);
        __publicField(this, "state", { error: null });
      }
      static getDerivedStateFromError(error) {
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      componentDidCatch() {
      }
      render() {
        if (this.state.error === null) return this.props.children;
        return /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            role: "alert",
            "data-drawing-contribution-error": this.props.contribution.id,
            "data-drawing-surface-namespace": this.props.contribution.id,
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "扩展工作区暂时无法渲染。" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => this.setState({ error: null }), children: "重试" })
            ]
          }
        );
      }
    }
    function createDrawingSurfaceRegistry() {
      const contributions = /* @__PURE__ */ new Map();
      const subscribers = /* @__PURE__ */ new Map();
      const releaseClaims = (subscriber) => {
        for (const dispose of subscriber.claimDisposers.splice(0)) dispose();
      };
      const bindClaims = (sessionId, subscriber) => {
        releaseClaims(subscriber);
        for (const contribution of contributions.values()) {
          if (contribution.apiVersion !== DRAWING_SURFACE_API_VERSION) continue;
          const observable = contribution.claimSource.observe(sessionId);
          subscriber.claimDisposers.push(observable.subscribe(subscriber.listener));
        }
      };
      const notifyRegistrationsChanged = () => {
        for (const [sessionId, sessionSubscribers] of subscribers) {
          for (const subscriber of sessionSubscribers) {
            bindClaims(sessionId, subscriber);
            subscriber.listener();
          }
        }
      };
      return {
        registerWorkspace(contribution) {
          if (contributions.has(contribution.id)) {
            throw new Error(`DUPLICATE_DRAWING_WORKSPACE_CONTRIBUTION:${contribution.id}`);
          }
          contributions.set(contribution.id, contribution);
          notifyRegistrationsChanged();
          let disposed = false;
          return {
            dispose() {
              if (disposed) return;
              disposed = true;
              if (contributions.get(contribution.id) !== contribution) return;
              contributions.delete(contribution.id);
              notifyRegistrationsChanged();
            }
          };
        },
        getWorkspaceSnapshot(sessionId) {
          var _a2;
          const contributionIds = [...contributions.keys()].sort((left, right) => left.localeCompare(right));
          const eligible = [...contributions.values()].flatMap((contribution) => {
            if (contribution.apiVersion !== DRAWING_SURFACE_API_VERSION) return [];
            const claim = contribution.claimSource.observe(sessionId).getSnapshot();
            return claim.active ? [{ contribution, claim }] : [];
          });
          eligible.sort((left, right) => right.claim.activationEpoch - left.claim.activationEpoch || right.contribution.priority - left.contribution.priority || left.contribution.id.localeCompare(right.contribution.id));
          return {
            electedId: ((_a2 = eligible[0]) == null ? void 0 : _a2.contribution.id) ?? null,
            contributionIds
          };
        },
        getWorkspaceContribution(id) {
          return contributions.get(id) ?? null;
        },
        subscribe(sessionId, listener) {
          const subscriber = { listener, claimDisposers: [] };
          const sessionSubscribers = subscribers.get(sessionId) ?? /* @__PURE__ */ new Set();
          sessionSubscribers.add(subscriber);
          subscribers.set(sessionId, sessionSubscribers);
          bindClaims(sessionId, subscriber);
          return () => {
            releaseClaims(subscriber);
            sessionSubscribers.delete(subscriber);
            if (sessionSubscribers.size === 0) subscribers.delete(sessionId);
          };
        },
        disposeSession(sessionId) {
          const sessionSubscribers = subscribers.get(sessionId);
          if (sessionSubscribers === void 0) return;
          for (const subscriber of sessionSubscribers) releaseClaims(subscriber);
          subscribers.delete(sessionId);
        }
      };
    }
    const inject = ["slots", "remote", "conversation"];
    function DrawingConversationView({
      sessionId,
      surfaceRegistry,
      useSession,
      workspacePort,
      inputActions,
      createDraftImages,
      releaseSources
    }) {
      const runningCallCount = useSession((snapshot) => snapshot.runningCalls.length);
      const store = react.useMemo(
        () => createDrawingWorkspaceStore({ port: workspacePort }),
        [workspacePort]
      );
      const surfaceRuntime = react.useMemo(() => createDrawingSurfaceRuntime(store), [store]);
      const didObserveInitialCallCount = react.useRef(false);
      react.useEffect(() => {
        if (didObserveInitialCallCount.current) void store.getState().refresh();
        else didObserveInitialCallCount.current = true;
      }, [runningCallCount, store]);
      react.useEffect(() => {
        if (typeof window === "undefined") return;
        const refresh = (event) => {
          const detail = event.detail;
          if ((detail == null ? void 0 : detail.sessionId) === sessionId) void store.getState().refresh();
        };
        window.addEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
        return () => window.removeEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
      }, [sessionId, store]);
      react.useEffect(() => releaseSources, [releaseSources]);
      const uploadDrawing = (files) => {
        const attachments = createDraftImages(files);
        if (attachments.length === 0 || !inputActions.addImages(attachments.map(({ id }) => id))) return;
        inputActions.setDraft("请将上传的图片导入并矢量化为可编辑图纸");
        inputActions.submit();
      };
      return /* @__PURE__ */ jsxRuntime.jsx(DrawingWorkspaceProvider, { store, children: /* @__PURE__ */ jsxRuntime.jsx(
        DrawingSurfaceHost,
        {
          sessionId,
          registry: surfaceRegistry,
          runtime: surfaceRuntime,
          fallback: /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: "vai-dsh-workspace-host",
              "data-conversation-workspace-active": "",
              children: /* @__PURE__ */ jsxRuntime.jsx(DrawingWorkspace, { onUploadFiles: uploadDrawing })
            }
          )
        }
      ) });
    }
    async function apply(ctx) {
      const surfaceRegistry = createDrawingSurfaceRegistry();
      const disposeRegistry = ctx.provide("drawingSurfaceRegistry", surfaceRegistry);
      const remote = ctx.get("remote");
      const slots = ctx.get("slots");
      const disposeRemote = await remote.$mount(DRAWING_SPACE_REMOTE);
      const viewFiber = ctx.inject(["remote.drawingSpace", "remote.commands", "conversation"], (scope) => {
        const drawingSpace = scope.get("remote").drawingSpace;
        const commands = scope.get("remote").commands;
        const conversation = scope.get("conversation");
        return slots.inject("conversation.workspace", () => slots.register({
          name: "conversation.workspace",
          inject: (sessionId) => {
            const id = String(sessionId);
            return {
              surfaceRegistry,
              workspacePort: createDshDrawingWorkspacePort({
                sessionId: id,
                remote: drawingSpace,
                commands,
                resolveImage: (ownerId, attachment) => conversation.resolveImage(ownerId, attachment)
              }),
              createDraftImages: (files) => conversation.createDraftImages(files),
              releaseSources: () => conversation.releaseSessionImages(id)
            };
          }
        }, DrawingConversationView));
      });
      return async () => {
        await viewFiber.dispose();
        await disposeRegistry();
        await disposeRemote();
      };
    }
    exports.DrawingConversationView = DrawingConversationView;
    exports.apply = apply;
    exports.inject = inject;
    var originalApply = module.exports.apply;
    module.exports.apply = async (ctx) => {
      var style = document.createElement("style");
      style.dataset["vectoraiDshSpace"] = "true";
      style.textContent = ".vai-workspace {\n  --vai-bg: #090b0e;\n  --vai-panel: #12161b;\n  --vai-panel-deep: #0d1014;\n  --vai-panel-hover: rgba(255, 255, 255, 0.035);\n  --vai-border: rgba(255, 255, 255, 0.07);\n  --vai-text: #cbd5e1;\n  --vai-muted: #64748b;\n  --vai-subtle: #334155;\n  --vai-accent: #6da9d2;\n  --vai-danger: #ef6a6a;\n  --vai-success: #4ade80;\n  box-sizing: border-box;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--vai-text);\n  background: var(--vai-bg);\n  font: 13px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\n.vai-workspace *,\n.vai-workspace *::before,\n.vai-workspace *::after {\n  box-sizing: border-box;\n}\n\n.vai-workspace__header {\n  display: flex;\n  height: 44px;\n  min-height: 44px;\n  align-items: center;\n  gap: 8px;\n  padding: 0 10px;\n  border-bottom: 1px solid var(--vai-border);\n  background: var(--vai-bg);\n  color: var(--vai-muted);\n}\n\n.vai-workspace__identity {\n  display: flex;\n  min-width: 0;\n  max-width: 220px;\n  align-items: center;\n  gap: 7px;\n  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-workspace__drawing-id {\n  overflow: hidden;\n  color: var(--vai-text);\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.vai-workspace__badge {\n  border-radius: 999px;\n  padding: 2px 7px;\n  color: #d7a45e;\n  background: rgba(230, 161, 93, 0.1);\n}\n\n.vai-workspace__badge--preview {\n  border-color: rgba(56, 189, 248, 0.55);\n  background: rgba(14, 165, 233, 0.14);\n  color: #7dd3fc;\n}\n\n.vai-entity--preview-created,\n.vai-entity--preview-updated {\n  color: #38bdf8;\n  filter: drop-shadow(0 0 2px rgba(56, 189, 248, 0.65));\n}\n\n.vai-entity--preview-before {\n  opacity: 0.28;\n  color: #f59e0b;\n  pointer-events: none;\n}\n\n.vai-entity--preview-deleted {\n  opacity: 0.24;\n  color: #fb7185;\n  stroke-dasharray: 5 4;\n  pointer-events: none;\n}\n\n.vai-workspace__busy {\n  margin-left: auto;\n}\n\n.vai-workspace__error {\n  padding: 7px 14px;\n  border-bottom: 1px solid #f1c4c1;\n  color: var(--vai-danger);\n  background: #fff1f0;\n}\n\n.vai-workspace__body {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  flex: 1;\n}\n\n.vai-workspace__canvas-region {\n  position: relative;\n  display: flex;\n  min-width: 0;\n  min-height: 0;\n  flex: 1;\n  overflow: hidden;\n}\n\n.vai-workspace button {\n  border: 1px solid transparent;\n  border-radius: 6px;\n  padding: 5px 7px;\n  color: var(--vai-muted);\n  background: transparent;\n  font: inherit;\n  cursor: pointer;\n}\n\n.vai-workspace button:hover:not(:disabled),\n.vai-workspace button[aria-pressed=\"true\"] {\n  border-color: rgba(109, 169, 210, 0.22);\n  color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.08);\n}\n\n.vai-workspace button:disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.vai-toolbar {\n  position: absolute;\n  z-index: 8;\n  bottom: 16px;\n  left: 50%;\n  display: flex;\n  max-width: calc(100% - 32px);\n  align-items: center;\n  gap: 5px;\n  padding: 6px;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 12px;\n  background: rgba(18, 22, 27, 0.92);\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);\n  backdrop-filter: blur(14px);\n  transform: translateX(-50%);\n}\n\n.vai-toolbar--motion-rig {\n  bottom: 70px;\n  gap: 0;\n  padding: 4px;\n  border-color: rgba(255, 255, 255, 0.08);\n  border-radius: 10px;\n  background: rgba(15, 19, 24, 0.9);\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--cancel {\n  border-color: transparent;\n  color: var(--vai-danger);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--cancel:hover:not(:disabled) {\n  border-color: transparent;\n  color: #fca5a5;\n  background: rgba(239, 106, 106, 0.1);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm {\n  border-color: transparent;\n  color: var(--vai-success);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--preview {\n  border-color: transparent;\n  color: var(--vai-accent);\n  background: transparent;\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--preview:hover:not(:disabled),\n.vai-toolbar--motion-rig .vai-toolbar__action--preview[aria-pressed=\"true\"] {\n  border-color: transparent;\n  color: #bae6fd;\n  background: rgba(109, 169, 210, 0.12);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm:hover:not(:disabled) {\n  border-color: transparent;\n  color: #86efac;\n  background: rgba(74, 222, 128, 0.1);\n}\n\n.vai-toolbar--motion-rig .vai-toolbar__action--confirm:disabled {\n  color: #476455;\n  background: transparent;\n  opacity: 0.55;\n}\n\n.vai-toolbar__separator--motion-rig {\n  height: 18px;\n  margin: 0 2px;\n  background: rgba(255, 255, 255, 0.09);\n}\n\n.vai-toolbar button,\n.vai-toolbar__upload {\n  display: inline-flex;\n  width: 32px;\n  height: 32px;\n  flex: 0 0 auto;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n  white-space: nowrap;\n}\n\n.vai-toolbar__separator {\n  width: 1px;\n  height: 20px;\n  background: var(--vai-border);\n}\n\n.vai-toolbar__upload {\n  border: 1px solid transparent;\n  border-radius: 6px;\n  color: var(--vai-muted);\n  cursor: pointer;\n}\n\n.vai-toolbar__upload:hover {\n  border-color: rgba(109, 169, 210, 0.22);\n  color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.08);\n}\n\n.vai-toolbar__upload--disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.vai-toolbar__upload input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  clip-path: inset(50%);\n}\n\n.vai-inspector-stack {\n  display: flex;\n  width: 240px;\n  min-width: 210px;\n  min-height: 0;\n  flex: 0 0 240px;\n  flex-direction: column;\n  overflow: hidden;\n  border-right: 1px solid var(--vai-border, rgba(255, 255, 255, 0.07));\n  background: var(--vai-panel, #12161b);\n}\n\n.vai-activity-bar {\n  z-index: 6;\n  display: flex;\n  width: 42px;\n  min-width: 42px;\n  flex: 0 0 42px;\n  flex-direction: column;\n  align-items: center;\n  gap: 4px;\n  padding: 6px 4px;\n  border-right: 1px solid var(--vai-border, rgba(255, 255, 255, 0.07));\n  background: var(--vai-panel-deep, #0d1014);\n}\n\n.vai-activity-bar--overlay {\n  position: absolute;\n  inset: 0 auto 0 0;\n  box-sizing: border-box;\n}\n\n.vai-activity-bar__button {\n  position: relative;\n  display: inline-flex;\n  width: 34px;\n  height: 34px;\n  flex: 0 0 34px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 !important;\n  border-radius: 7px !important;\n  border: 1px solid transparent;\n  color: var(--vai-muted);\n  background: transparent;\n  cursor: pointer;\n}\n\n.vai-activity-bar__button:hover,\n.vai-activity-bar__button[aria-pressed=\"true\"] {\n  border-color: rgba(109, 169, 210, 0.22);\n  color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.08);\n}\n\n.vai-activity-bar__button[aria-pressed=\"true\"]::before {\n  position: absolute;\n  top: 7px;\n  bottom: 7px;\n  left: -5px;\n  width: 2px;\n  border-radius: 0 2px 2px 0;\n  background: var(--vai-accent);\n  content: \"\";\n}\n\n.vai-inspector-stack--activity {\n  position: relative;\n  width: 260px;\n  min-width: 220px;\n  max-width: 420px;\n  flex: 0 0 auto;\n}\n\n.vai-inspector-stack--overlay {\n  position: absolute;\n  z-index: 5;\n  inset: 0 auto 0 42px;\n  box-sizing: border-box;\n  box-shadow: 14px 0 30px rgba(0, 0, 0, 0.28);\n}\n\n.vai-inspector-stack--activity > .vai-panel {\n  min-height: 0;\n  flex: 1 1 auto;\n}\n\n.vai-inspector-stack--activity > .vai-inspector {\n  height: auto;\n  border-top: 0;\n}\n\n.vai-inspector-stack--activity .vai-panel__title {\n  padding-right: 42px;\n}\n\n.vai-panel-close {\n  position: absolute;\n  z-index: 2;\n  top: 7px;\n  right: 7px;\n  display: inline-flex;\n  width: 28px;\n  height: 28px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 !important;\n}\n\n.vai-panel-resizer {\n  position: absolute;\n  z-index: 3;\n  top: 0;\n  right: -3px;\n  bottom: 0;\n  width: 6px;\n  cursor: col-resize;\n  touch-action: none;\n}\n\n.vai-panel-resizer::after {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 2px;\n  width: 1px;\n  background: var(--vai-accent);\n  content: \"\";\n  opacity: 0;\n  transition: opacity 120ms ease;\n}\n\n.vai-panel-resizer:hover::after,\n.vai-panel-resizer:focus-visible::after {\n  opacity: 0.9;\n}\n\n.vai-panel-resizer:focus-visible {\n  outline: none;\n}\n\n.vai-panel {\n  display: flex;\n  width: 100%;\n  min-width: 0;\n  min-height: 0;\n  flex-direction: column;\n  border: 0;\n  background: var(--vai-panel);\n}\n\n.vai-object-list {\n  flex: 1 1 auto;\n}\n\n.vai-inspector {\n  height: 256px;\n  flex: 0 0 256px;\n  border-top: 1px solid var(--vai-border);\n}\n\n.vai-panel__title {\n  display: flex;\n  min-height: 44px;\n  align-items: center;\n  padding: 0 12px;\n  border-bottom: 1px solid var(--vai-border);\n  color: #cbd5e1;\n  font-size: 11px;\n  font-weight: 500;\n}\n\n.vai-panel__empty,\n.vai-object-group__empty {\n  padding: 12px;\n  color: var(--vai-muted);\n}\n\n.vai-object-list__scroll,\n.vai-inspector__scroll {\n  min-height: 0;\n  flex: 1;\n  overflow: auto;\n}\n\n.vai-object-group h3 {\n  display: flex;\n  margin: 0;\n  padding: 8px 10px 5px;\n  justify-content: space-between;\n  color: #475569;\n  font-size: 9px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n}\n\n.vai-object-row {\n  display: flex;\n  align-items: center;\n  gap: 3px;\n  border-left: 2px solid transparent;\n  padding: 3px 7px;\n}\n\n.vai-object-row--selected {\n  border-left-color: var(--vai-accent);\n  background: rgba(109, 169, 210, 0.07);\n}\n\n.vai-object-row--ai-grounded {\n  border-left-color: #2dd4bf;\n  background: rgba(45, 212, 191, 0.12);\n  animation: vai-ai-grounded-pulse 0.85s ease-in-out infinite;\n}\n\n.vai-object-row__main {\n  display: flex;\n  min-width: 0;\n  flex: 1;\n  align-items: center;\n  gap: 7px;\n  border: 0 !important;\n  text-align: left;\n}\n\n.vai-object-row__glyph {\n  width: 18px;\n  color: var(--vai-accent);\n  text-align: center;\n}\n\n.vai-object-row__identity {\n  display: flex;\n  min-width: 0;\n  flex-direction: column;\n}\n\n.vai-object-row__identity strong,\n.vai-object-row__identity small {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.vai-object-row__identity strong {\n  color: #94a3b8;\n  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-weight: 400;\n}\n\n.vai-object-row__identity small {\n  color: var(--vai-muted);\n  font-size: 10px;\n}\n\n.vai-icon-button {\n  width: 26px;\n  padding: 3px !important;\n}\n\n.vai-icon-button--danger:hover:not(:disabled) {\n  color: var(--vai-danger) !important;\n}\n\n.vai-inspector__identity {\n  display: grid;\n  grid-template-columns: 70px minmax(0, 1fr);\n  margin: 0;\n  padding: 10px;\n  gap: 6px;\n  border-bottom: 1px solid var(--vai-border);\n}\n\n.vai-inspector__identity dt {\n  color: var(--vai-muted);\n}\n\n.vai-inspector__identity dd {\n  min-width: 0;\n  margin: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.vai-inspector__fields {\n  display: grid;\n  padding: 10px;\n  gap: 8px;\n}\n\n.vai-field {\n  display: grid;\n  grid-template-columns: 80px minmax(0, 1fr);\n  align-items: center;\n  gap: 7px;\n}\n\n.vai-field span {\n  color: var(--vai-muted);\n}\n\n.vai-field input:not([type=\"checkbox\"]) {\n  min-width: 0;\n  width: 100%;\n  border: 1px solid var(--vai-border);\n  border-radius: 4px;\n  padding: 5px 6px;\n  color: inherit;\n  background: var(--vai-panel-deep);\n  font: inherit;\n}\n\n.vai-inspector__raw {\n  margin: 0 10px 12px;\n  color: var(--vai-muted);\n}\n\n.vai-inspector__raw pre {\n  overflow: auto;\n  padding: 8px;\n  border-radius: 5px;\n  background: var(--vai-bg);\n  font-size: 10px;\n}\n\n.vai-status {\n  display: flex;\n  min-height: 28px;\n  align-items: center;\n  gap: 14px;\n  padding: 0 10px;\n  border-top: 1px solid var(--vai-border);\n  color: var(--vai-muted);\n  background: var(--vai-panel);\n  font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-status__coords {\n  margin-left: auto;\n}\n\n@media (max-width: 760px) {\n  .vai-inspector-stack {\n    position: absolute;\n    z-index: 5;\n    top: 0;\n    bottom: 0;\n    box-shadow: 4px 0 18px rgba(0, 0, 0, 0.18);\n  }\n\n  .vai-workspace__identity {\n    display: none;\n  }\n\n  .vai-status > span:nth-child(-n+3) {\n    display: none;\n  }\n}\n\n.vai-canvas {\n  position: relative;\n  min-width: 0;\n  min-height: 0;\n  flex: 1;\n  overflow: hidden;\n  outline: none;\n  background: #101419;\n}\n\n.vai-canvas:focus-visible {\n  box-shadow: inset 0 0 0 2px var(--vai-accent);\n}\n\n.vai-canvas__svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  user-select: none;\n  touch-action: none;\n}\n\n.vai-grid__minor {\n  stroke: rgba(148, 163, 184, 0.025);\n  stroke-width: 1;\n}\n\n.vai-grid__major {\n  stroke: rgba(148, 163, 184, 0.075);\n  stroke-width: 1;\n}\n\n.vai-grid__axes line {\n  stroke: rgba(148, 163, 184, 0.3);\n  stroke-width: 1;\n}\n\n.vai-grid__axes text {\n  fill: rgba(148, 163, 184, 0.45);\n  font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-entity {\n  cursor: pointer;\n  fill: #d7e0ea;\n  stroke: #d7e0ea;\n  stroke-width: 1.35;\n}\n\n.vai-entity--candidate {\n  stroke: #e6a15d;\n  stroke-dasharray: 6 4;\n}\n\n.vai-entity--selected {\n  fill: #72b9e8;\n  stroke: #72b9e8;\n  stroke-width: 2;\n}\n\n.vai-entity--motion-rig {\n  fill: #38bdf8;\n  stroke: #38bdf8;\n  stroke-width: 2.25;\n  filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.5));\n}\n\n.vai-motion-rig__guide {\n  stroke: rgba(125, 211, 252, 0.65);\n  stroke-width: 1.5;\n  stroke-dasharray: 5 5;\n}\n\n.vai-motion-rig__anchor {\n  fill: #101419;\n  stroke: #e2e8f0;\n  stroke-width: 2;\n}\n\n.vai-motion-rig__handle {\n  cursor: grab;\n  fill: #0ea5e9;\n  stroke: #e0f2fe;\n  stroke-width: 2;\n}\n\n.vai-motion-rig--dragging .vai-motion-rig__handle {\n  cursor: grabbing;\n}\n\n.vai-motion-rig--preview .vai-motion-rig__handle {\n  cursor: grab;\n  fill: #22c55e;\n}\n\n.vai-motion-rig__connector-handle {\n  cursor: grab;\n  fill: #101419;\n  stroke: #38bdf8;\n  stroke-width: 2;\n}\n\n.vai-motion-rig--dragging .vai-motion-rig__connector-handle {\n  cursor: grabbing;\n}\n\n.vai-motion-rig__status {\n  fill: #e0f2fe;\n  stroke: none;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-entity--ai-grounded {\n  fill: #2dd4bf;\n  stroke: #2dd4bf;\n  stroke-width: 2;\n  filter: drop-shadow(0 0 3px rgba(45, 212, 191, 0.75));\n  animation: vai-ai-grounded-pulse 0.85s ease-in-out infinite;\n}\n\n.vai-entity--motion-rig.vai-entity--ai-grounded {\n  fill: #38bdf8;\n  stroke: #38bdf8;\n  animation: none;\n}\n\n.vai-motion-preview__before .vai-entity {\n  cursor: default;\n  opacity: 0.32;\n  fill: #a69b87;\n  stroke: #a69b87;\n  stroke-width: 1.2;\n  stroke-dasharray: 5 4;\n  filter: none;\n  pointer-events: none;\n}\n\n@keyframes vai-ai-grounded-pulse {\n  0%, 100% { opacity: 0.42; }\n  50% { opacity: 1; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .vai-entity--ai-grounded,\n  .vai-object-row--ai-grounded {\n    animation: none;\n  }\n}\n\n.vai-entity text {\n  fill: currentColor;\n  stroke: none;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.vai-relations {\n  color: #88a5bb;\n  fill: #88a5bb;\n  stroke: #88a5bb;\n  stroke-width: 1;\n  stroke-dasharray: 4 4;\n}\n\n.vai-canvas__selection-box {\n  fill: rgba(22, 119, 255, 0.16);\n  stroke: #4ea0ff;\n  stroke-width: 1;\n  stroke-dasharray: 4 3;\n}\n\n.vai-preview-motion {\n  fill: none;\n  stroke: #54b9ff;\n  stroke-width: 2;\n  stroke-dasharray: 7 5;\n  animation: vai-preview-motion-flow 0.8s linear infinite;\n}\n\n#vai-preview-motion-arrow path {\n  fill: #54b9ff;\n}\n\n@keyframes vai-preview-motion-flow {\n  to { stroke-dashoffset: -24; }\n}\n\n.vai-workspace__state {\n  max-width: 440px;\n  margin: auto;\n  padding: 32px;\n  text-align: center;\n}\n\n.vai-workspace__state-title {\n  font-size: 16px;\n  font-weight: 650;\n}\n\n.vai-workspace__state-detail {\n  margin-top: 7px;\n  color: var(--vai-muted);\n}\n/* SPDX-License-Identifier: Apache-2.0 */\n\n.vai-dsh-workspace-host {\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n}\n";
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
