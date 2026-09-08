import type { LoadWarning, ParmLib } from "../types";

export function parseJobParms(
  name: string,
  text: string,
): { lib: ParmLib | null; warning?: LoadWarning } {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length < 10) {
    return { lib: null, warning: { file: name, message: "JobParms file too short" } };
  }
  try {
    const tmplName = lines[3] || name;
    const ncat = parseInt(lines[5], 10);
    if (!(ncat > 0 && ncat < 40)) {
      return { lib: null, warning: { file: name, message: "JobParms category count invalid" } };
    }
    const cats: string[] = [];
    let j = 6;
    for (let k = 0; k < ncat; k++) {
      cats.push(lines[j + 1] || `Category ${k + 1}`);
      j += 2;
    }
    const nparams = parseInt(lines[j], 10);
    j++;
    const REC = 17;
    const params: ParmLib["params"] = [];
    for (let r = 0; r < nparams; r++) {
      const b = j + r * REC;
      if (b + REC > lines.length) break;
      const code = lines[b];
      if (!code) continue;
      params.push({
        code,
        desc: lines[b + 1] || "",
        val: lines[b + 2] || "",
        type: parseInt(lines[b + 3], 10) || 0,
        cat: parseInt(lines[b + 4], 10) || 0,
        opts: lines[b + 13] ? lines[b + 13].split(",") : null,
      });
    }
    if (!params.length) {
      return { lib: null, warning: { file: name, message: "JobParms has no parameters" } };
    }
    return {
      lib: {
        lib: name.replace(/-JobParms\.dat$/i, ""),
        tmpl: tmplName,
        cats,
        params,
      },
    };
  } catch {
    return { lib: null, warning: { file: name, message: "JobParms parse failed" } };
  }
}

export function parmValueText(p: ParmLib["params"][number], unit: "in" | "mm"): string {
  if (p.type === 1) return Number(p.val) ? "Yes" : "No";
  if (p.type === 2 && p.opts) {
    const i = parseInt(p.val, 10);
    return p.opts[i - 1] !== undefined ? p.opts[i - 1] : p.val;
  }
  const v = parseFloat(p.val);
  if (Number.isNaN(v)) return p.val;
  if (unit === "in") {
    const inches = v / 25.4;
    return `${inches.toFixed(3)} in`;
  }
  return `${v} mm`;
}
