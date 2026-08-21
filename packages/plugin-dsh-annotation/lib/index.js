import { defineTool } from "@deepseek-ai/dsh-tools";
function planEngineeringAnnotations(input) {
  const annotations = [];
  const associations = [];
  const pending = [];
  const suppressed = [];
  const geometry = input.document.geometry.filter(({ visible }) => visible);
  const drawingBounds = boundsOf(geometry);
  const diagonal = drawingBounds ? Math.hypot(drawingBounds.maxX - drawingBounds.minX, drawingBounds.maxY - drawingBounds.minY) : 1;
  const offset = Math.max(diagonal * 0.04, 2);
  for (const node of geometry) {
    if (node.quality.status !== "confirmed") {
      pending.push({ nodeId: node.id, reason: "SOURCE_NOT_CONFIRMED" });
      continue;
    }
    const annotation = annotationFor(node, input.document.unitSystem.length, offset);
    if (!annotation) {
      suppressed.push({ nodeId: node.id, reason: "No deterministic engineering dimension rule applies." });
      continue;
    }
    annotations.push(annotation);
    associations.push({
      id: `relation_${stableKey(`${input.document.id}:${annotation.id}`)}`,
      type: "association",
      plane: "association",
      kind: "annotation-target",
      annotationId: annotation.id,
      geometryIds: [node.id],
      visible: true,
      quality: { status: "confirmed", confidence: 1, evidenceRefs: [...annotation.quality.evidenceRefs] }
    });
  }
  const targetNodeIds = [...new Set(associations.flatMap(({ geometryIds }) => geometryIds))].sort();
  const evidenceRefs = [...new Set(targetNodeIds.flatMap((id) => {
    const node = geometry.find((candidate) => candidate.id === id);
    return (node == null ? void 0 : node.quality.evidenceRefs) ?? [];
  }))];
  if (targetNodeIds.length > 0 && evidenceRefs.length === 0) {
    evidenceRefs.push(`evidence:engineering:${stableKey(targetNodeIds.join(":"))}`);
  }
  const program = annotations.length === 0 ? null : {
    baseRef: structuredClone(input.ref),
    targetHandle: "__GROUNDING_TARGET__",
    summary: `Create ${annotations.length} deterministic engineering annotations`,
    objective: input.objective,
    operations: [{
      kind: "create_annotation_batch",
      annotations: structuredClone(annotations),
      associations: structuredClone(associations)
    }],
    preserveScopes: geometry.map(({ id }) => ({ kind: "node-field", nodeId: id, fields: ["id", "type"] })),
    postconditions: [],
    evidenceRefs
  };
  return { annotations, associations, targetNodeIds, pending, suppressed, program };
}
function annotationFor(node, unit, offset) {
  const evidenceRefs = node.quality.evidenceRefs.length > 0 ? [...node.quality.evidenceRefs] : [`evidence:engineering:${node.id}`];
  const base = {
    id: `annotation_auto_${stableKey(String(node.id))}`,
    type: "dimension",
    visible: true,
    quality: { status: "confirmed", confidence: 1, evidenceRefs },
    associationStatus: "resolved",
    targets: [{ geometryId: node.id, anchor: { kind: "center" } }],
    unit
  };
  if (node.type === "circle") {
    const first = [node.center[0] - node.radius, node.center[1]];
    const second = [node.center[0] + node.radius, node.center[1]];
    return {
      ...base,
      dimensionKind: "diameter",
      computedValue: clean(node.radius * 2),
      displayText: `Ø${format(node.radius * 2)}`,
      textPosition: [node.center[0], node.center[1] + node.radius + offset],
      definitionPoints: [first, second]
    };
  }
  if (node.type === "arc") {
    const middle = (node.startAngle + node.endAngle) / 2 * Math.PI / 180;
    const edge = [node.center[0] + Math.cos(middle) * node.radius, node.center[1] + Math.sin(middle) * node.radius];
    return {
      ...base,
      dimensionKind: "radius",
      computedValue: clean(node.radius),
      displayText: `R${format(node.radius)}`,
      textPosition: [edge[0] + Math.cos(middle) * offset, edge[1] + Math.sin(middle) * offset],
      definitionPoints: [node.center, edge]
    };
  }
  if (node.type === "ellipse") {
    const radius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (radius <= 0) return null;
    const axis = [node.majorAxis[0] / radius, node.majorAxis[1] / radius];
    return {
      ...base,
      dimensionKind: "aligned",
      computedValue: clean(radius * 2),
      displayText: format(radius * 2),
      textPosition: [node.center[0] - axis[1] * offset, node.center[1] + axis[0] * offset],
      definitionPoints: [
        [node.center[0] - axis[0] * radius, node.center[1] - axis[1] * radius],
        [node.center[0] + axis[0] * radius, node.center[1] + axis[1] * radius]
      ]
    };
  }
  return null;
}
function boundsOf(nodes) {
  const points = nodes.flatMap(pointsOf);
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function pointsOf(node) {
  if (node.type === "point") return [[node.x, node.y]];
  if (node.type === "line") return [node.start, node.end];
  if (node.type === "ray" || node.type === "xline") return [node.origin];
  if (node.type === "circle" || node.type === "arc") return [
    [node.center[0] - node.radius, node.center[1] - node.radius],
    [node.center[0] + node.radius, node.center[1] + node.radius]
  ];
  if (node.type === "ellipse") {
    const radius = Math.hypot(...node.majorAxis);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  if (node.type === "polyline") return node.vertices.map(({ point }) => point);
  return node.controlPoints;
}
function stableKey(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function clean(value) {
  return Number(value.toFixed(6));
}
function format(value) {
  return clean(value).toString();
}
function createEngineeringAnnotationTool(host) {
  return defineTool({
    name: "drawing_auto_annotate",
    description: "Plan deterministic engineering dimensions from confirmed local geometry and run the plan through the first-layer Preview, evaluation, auto-safe commit, and Undo-capable history.",
    parameters: {},
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error("DRAWING_SESSION_REQUIRED");
      const snapshot = host.getSnapshot(agent);
      if (!snapshot) throw new Error("DRAWING_REQUIRED");
      const plan = planEngineeringAnnotations({
        document: snapshot.document,
        ref: snapshot.ref,
        objective: "工程图纸自动标注"
      });
      if (!plan.program) return {
        status: "no-effect",
        pending: plan.pending,
        suppressed: plan.suppressed
      };
      const workflow = await host.runExtensionProgram(agent, {
        targetNodeIds: plan.targetNodeIds,
        program: plan.program
      }, exec.signal);
      return {
        status: workflow.result.status,
        annotations: plan.annotations.map(({ id }) => id),
        pending: plan.pending,
        suppressed: plan.suppressed,
        result: workflow.result
      };
    }
  });
}
const inject = ["tools", "drawingSpace"];
function apply(ctx) {
  return ctx.tools.register(createEngineeringAnnotationTool(ctx.drawingSpace));
}
const plugin = Object.assign(apply, { inject });
export {
  apply,
  createEngineeringAnnotationTool,
  plugin as default,
  inject
};
