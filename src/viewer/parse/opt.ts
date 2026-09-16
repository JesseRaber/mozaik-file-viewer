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
  const extra = doc.querySelectorAll("OptimizeMaterial").length - 1;
  const runId = num(om, "RunId");
  const mat = {
    // Mozaik's attribute is Name. DisplayName is kept only as a defensive
    // fallback; the file name is a last resort and is not a material name.
    name: om.getAttribute("Name") || om.getAttribute("DisplayName") || fname,
    thickness: num(om, "Thickness"),
    parts: [...doc.querySelectorAll("OptimizePart")].map((op) => ({
      id: num(op, "PartID"),
      name: op.getAttribute("Name") || "",
      L: num(op, "Length"),
      W: num(op, "Width"),
      assy: op.getAttribute("AssyNo") || "",
    })),
  };
  const run: OptRun = { runId, materials: [mat] };
  if (extra > 0) {
    // Never seen in the wild, but if it happens every part in the file would be
    // attributed to the first material. Say so rather than showing wrong data.
    return {
      run,
      warning: {
        file: fname,
        message: `${extra + 1} materials in one optimizer file; only "${mat.name}" was read`,
      },
    };
  }
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
