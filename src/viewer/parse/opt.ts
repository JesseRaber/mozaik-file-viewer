import { xmlPayload } from "../encoding";
import type { LoadWarning, OptRun } from "../types";

function num(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse one Mozaik optimizer file.
 *
 * Mozaik writes ONE <OptimizeMaterial> per .opt file — a job with three
 * materials produces three files (e.g. "1-2 Plywood.opt", "1-4 Plywood.opt",
 * "3-4 Prefinished UV Plywood.opt"). mergeRuns() is what brings them back
 * together into a single run.
 *
 * Observed attributes on <OptimizeMaterial>: Name, Thickness, Width, Length,
 * HasGrain, WidthTrim, LengthTrim, FeedRate, Comment, CustomerName, Timestamp.
 * Note there is no RunId, so every file merges into run 0.
 */
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
  const materials = [...doc.querySelectorAll("OptimizeMaterial")].map(el => ({
    name: el.getAttribute("Name") || el.getAttribute("DisplayName") || fname,
    thickness: num(el, "Thickness"),
    parts: [...el.querySelectorAll("OptimizePart")].map(op => ({
      id: num(op, "PartID"), name: op.getAttribute("Name") || "",
      L: num(op, "Length"), W: num(op, "Width"), assy: op.getAttribute("AssyNo") || "",
    })),
  }));
  const runIds = new Set([...doc.querySelectorAll("OptimizeMaterial")].map(el => num(el, "RunId")));
  if (runIds.size !== 1 || materials.some(m => !(m.thickness > 0) || m.parts.some(p => !(p.L > 0 && p.W > 0))))
    return {run: null, warning: {file: fname, message: "Invalid optimizer dimensions or mixed run identities; file rejected"}};
  const run: OptRun = {runId: num(om, "RunId"), materials};
  return { run };
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
