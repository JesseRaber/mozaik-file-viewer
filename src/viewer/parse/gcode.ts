export type GEpisode = {
  tool: number | null;
  pts: Array<[number, number, number]>;
  zmin: number;
};

export type GFile = {
  name: string;
  flip: boolean;
  unit: "in" | "mm";
  sheetW: number | null;
  sheetL: number | null;
  thickness: number | null;
  tools: Record<number, string>;
  episodes: GEpisode[];
};

function toolDiaFromComment(c: string): number | null {
  let m = c.match(/([\d.]+)\s*mm/i);
  if (m) return parseFloat(m[1]);
  m = c.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return (parseInt(m[1], 10) / parseInt(m[2], 10)) * 25.4;
  m = c.match(/([\d.]+)\s*(?:in|")/i);
  if (m) return parseFloat(m[1]) * 25.4;
  return null;
}

/** Parse Mozaik (and generic) G-code. Honors G20/G21; returns millimetres. */
export function parseGcode(text: string, name: string): GFile {
  const lines = text.split(/\r?\n/);
  const f: GFile = {
    name,
    flip: /flip/i.test(name),
    unit: /G21\b/.test(text.slice(0, 2000)) ? "mm" : "in",
    sheetW: null,
    sheetL: null,
    thickness: null,
    tools: {},
    episodes: [],
  };
  let tool: number | null = null;
  let pending: string | null = null;
  let x = 0, y = 0, z = 50, mode = 0;
  let cur: GEpisode | null = null;
  let maxFeedZ = 0;
  const scale = () => (f.unit === "in" ? 25.4 : 1);
  const safe = () => (f.unit === "in" ? 1.4 : 35);

  const close = () => {
    if (cur) {
      f.episodes.push(cur);
      cur = null;
    }
  };
  const extend = (pts: Array<[number, number]>, nz: number) => {
    const s = scale();
    if (!cur) cur = { tool, pts: [[x * s, y * s, z * s]], zmin: Math.min(z, nz) * s };
    for (const p of pts) cur.pts.push([p[0] * s, p[1] * s, nz * s]);
    cur.zmin = Math.min(cur.zmin, nz * s);
  };

  for (const raw of lines) {
    const cm = raw.match(/\(([^)]*)\)/);
    if (cm) {
      const c = cm[1].trim();
      const sm = c.match(/X\s*=\s*([\d.]+)\s*,\s*Y\s*=\s*([\d.]+)/);
      if (sm) {
        const s = scale();
        f.sheetW = parseFloat(sm[1]) * s;
        f.sheetL = parseFloat(sm[2]) * s;
      }
      if (toolDiaFromComment(c) !== null || /drill|shear|comp|bit|router|mill/i.test(c)) {
        pending = c;
      }
    }
    const l = raw.split("(")[0].trim().toUpperCase();
    if (!l) continue;
    if (/\bG20\b/.test(l)) f.unit = "in";
    if (/\bG21\b/.test(l)) f.unit = "mm";
    const tm = l.match(/T(\d+)\s*M0?6/);
    if (tm) {
      close();
      tool = parseInt(tm[1], 10);
      if (!(tool in f.tools)) f.tools[tool] = pending || "";
      pending = null;
      continue;
    }
    const words: Record<string, number> = {};
    for (const w of l.matchAll(/([A-Z])([-+]?\d*\.?\d+)/g)) {
      if (w[1] === "G") {
        const g = parseFloat(w[2]);
        if (g <= 3) mode = g;
      } else words[w[1]] = parseFloat(w[2]);
    }
    if (!("X" in words) && !("Y" in words) && !("Z" in words)) continue;
    const nx = "X" in words ? words.X : x;
    const ny = "Y" in words ? words.Y : y;
    const nz = "Z" in words ? words.Z : z;
    if (mode === 0) {
      if (nz * scale() >= safe()) close();
      x = nx;
      y = ny;
      z = nz;
      continue;
    }
    if ("Z" in words && nz > 0 && nz * scale() < safe()) {
      maxFeedZ = Math.max(maxFeedZ, nz * scale());
    }
    let pts: Array<[number, number]>;
    if (mode === 2 || mode === 3) {
      const i = words.I || 0;
      const j = words.J || 0;
      const cx = x + i;
      const cy = y + j;
      const r = Math.hypot(i, j);
      const a0 = Math.atan2(y - cy, x - cx);
      const a1 = Math.atan2(ny - cy, nx - cx);
      let da = a1 - a0;
      if (mode === 3 && da <= 0) da += Math.PI * 2;
      if (mode === 2 && da >= 0) da -= Math.PI * 2;
      const n = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 24)));
      pts = [];
      for (let k = 1; k <= n; k++) {
        pts.push([
          cx + r * Math.cos(a0 + (da * k) / n),
          cy + r * Math.sin(a0 + (da * k) / n),
        ]);
      }
    } else pts = [[nx, ny]];
    if (nz * scale() < safe() || z * scale() < safe()) extend(pts, nz);
    x = nx;
    y = ny;
    z = nz;
  }
  close();
  f.thickness = maxFeedZ > 1 ? maxFeedZ : null;
  return f;
}

export function toolDiaMm(comment: string | undefined, fallback = 9.525): number {
  if (!comment) return fallback;
  return toolDiaFromComment(comment) ?? fallback;
}
