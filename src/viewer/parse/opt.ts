import { xmlPayload } from "../encoding";
import type { LoadWarning, OptRun } from "../types";

function num(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOpt(
  text: string,
  fname: string,
): { run: OptRun | null; warning?: LoadWarning } {
  const payload = xmlPayload(text);
  if (!payload) {
    return { run: null, warning: { file: fname, message: "Optimizer file has no XML" } };
  }
  const doc = new DOMParser().parseFromString(
    payload.startsWith("<?xml") ? payload : `<?xml version="1.0"?>${payload}`,
    "text/xml",
  );
  if (doc.querySelector("parsererror")) {
    return { run: null, warning: { file: fname, message: "Optimizer XML parse error" } };
  }
  const om = doc.querySelector("OptimizeMaterial");
  if (!om) {
    return { run: null, warning: { file: fname, message: "No <OptimizeMaterial>" } };
  }
  const runId = num(om, "RunId");
  const mat = {
    name: om.getAttribute("DisplayName") || fname,
    thickness: num(om, "Thickness"),
    parts: [...doc.querySelectorAll("OptimizePart")].map((op) => ({
      id: num(op, "PartID"),
      name: op.getAttribute("Name") || "",
      L: num(op, "Length"),
      W: num(op, "Width"),
      assy: op.getAttribute("AssyNo") || "",
    })),
  };
  return { run: { runId, materials: [mat] } };
}

export function mergeRuns(into: Record<string, OptRun>, run: OptRun) {
  const key = String(run.runId);
  const existing = into[key];
  if (!existing) {
    into[key] = run;
    return;
  }
  existing.materials.push(...run.materials);
}
