import type { Axis, DoorStyle, Part, Product, Rot, ShapePt } from "./types";

const TYPE_THICK: Record<string, number> = {
  Door: 19.05,
  Drawer: 19.05,
  Frame: 19.05,
  Stretcher: 19.05,
  FEnd: 19.05,
  UEnd: 19.05,
  Bottom: 19.05,
  Partition: 19.05,
  Sleeper: 19.05,
  Toe: 19.05,
  Nailer: 19.05,
  Top: 19.05,
  UBack: 12.7,
  DrawerSide: 12.7,
  DrawerBack: 12.7,
  DrawerFront: 12.7,
  DrawerBottom: 6.35,
  AdjustableShelf: 19.05,
  Metal: 19,
};

const THICK_ATTRS = [
  "Thickness",
  "Thick",
  "T",
  "MatThick",
  "MaterialThickness",
  "FinishedThick",
  "PartThick",
  "SUPartD",
];

export function defaultThickness(type: string): number {
  return TYPE_THICK[type] ?? 19.05;
}

export function readThicknessAttr(el: Element): number | null {
  for (const name of THICK_ATTRS) {
    const raw = el.getAttribute(name);
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0.2 && n < 200) return n;
  }
  return null;
}

export function groupOf(t: string): string {
  if (t === "Frame") return "Face frame";
  if (t === "Door" || t === "Drawer") return "Doors & fronts";
  if (t.startsWith("Drawer")) return "Drawer boxes";
  if (t === "Metal") return "Hardware";
  if (t === "AdjustableShelf") return "Shelves";
  return "Case";
}

/** DXF-style bulge: tan(included/4). PtType != 0 uses Data as bulge, or radius if |data| > 4. */
export function shapeToPath(pts: ShapePt[]): Array<{ x: number; y: number }> {
  if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push({ x: a.x, y: a.y });
    if (i === pts.length - 1 && a.type === 0) break;
    if (!a.type && !a.data) continue;
    const bulge = Math.abs(a.data) > 4 ? radiusToBulge(a, b, a.data) : a.data;
    if (!bulge) continue;
    const samples = sampleBulge(a.x, a.y, b.x, b.y, bulge);
    out.push(...samples);
  }
  return out;
}

function radiusToBulge(
  a: ShapePt,
  b: ShapePt,
  radius: number,
): number {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const r = Math.abs(radius);
  if (r < chord / 2 + 1e-6) return 0;
  const included = 2 * Math.asin(Math.min(1, chord / (2 * r)));
  const s = radius < 0 ? -1 : 1;
  return s * Math.tan(included / 4);
}

function sampleBulge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bulge: number,
): Array<{ x: number; y: number }> {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-6) return [];
  const s = Math.abs(bulge);
  const included = 4 * Math.atan(s);
  if (included < 1e-4) return [];
  const r = chord / (2 * Math.sin(included / 2));
  const nx = -dy / chord;
  const ny = dx / chord;
  const sign = bulge < 0 ? -1 : 1;
  const d = Math.sqrt(Math.max(0, r * r - (chord / 2) * (chord / 2)));
  const cx = (x1 + x2) / 2 + sign * d * nx;
  const cy = (y1 + y2) / 2 + sign * d * ny;
  const a0 = Math.atan2(y1 - cy, x1 - cx);
  let a1 = Math.atan2(y2 - cy, x2 - cx);
  let da = a1 - a0;
  if (sign > 0 && da <= 0) da += Math.PI * 2;
  if (sign < 0 && da >= 0) da -= Math.PI * 2;
  const n = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 16)));
  const pts: Array<{ x: number; y: number }> = [];
  for (let k = 1; k < n; k++) {
    const a = a0 + (da * k) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function rotMat(axis: Axis, deg: number): number[][] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === "X") return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === "Y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

function mul(A: number[][], B: number[][]): number[][] {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

export function partAABB(p: Part): { mn: number[]; mx: number[] } {
  let M = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const r of p.rot) {
    if (r.deg) M = mul(rotMat(r.axis, r.deg), M);
  }
  const mn = [1e9, 1e9, 1e9];
  const mx = [-1e9, -1e9, -1e9];
  const outline = p.shape.length ? p.shape : [
    { x: 0, y: 0, type: 0, data: 0 },
    { x: p.L, y: 0, type: 0, data: 0 },
    { x: p.L, y: p.W, type: 0, data: 0 },
    { x: 0, y: p.W, type: 0, data: 0 },
  ];
  for (const pt of outline) {
    for (const z of [0, p.thickness]) {
      const v = [pt.x, pt.y, z];
      const w = [0, 1, 2].map(
        (i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] + p.pos[i],
      );
      for (let i = 0; i < 3; i++) {
        mn[i] = Math.min(mn[i], w[i]);
        mx[i] = Math.max(mx[i], w[i]);
      }
    }
  }
  return { mn, mx };
}

export type FrameMember = {
  name: string;
  part: Part;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  w: number;
  len: number;
  ori: "H" | "V";
  thick: number;
  pockets: Array<{ x: number; z: number; ang: number }>;
};

export type FrameLayout = {
  members: FrameMember[];
  openings: Array<{ x0: number; x1: number; z0: number; z1: number }>;
  bb: { x0: number; x1: number; z0: number; z1: number };
};

export function computeFrame(prod: Product): FrameLayout | null {
  const members: FrameMember[] = [];
  for (const p of prod.parts) {
    if (p.type !== "Frame") continue;
    const { mn, mx } = partAABB(p);
    const m: FrameMember = {
      name: p.name,
      part: p,
      x0: mn[0],
      x1: mx[0],
      z0: mn[2],
      z1: mx[2],
      w: 0,
      len: 0,
      ori: "H",
      thick: Math.min(mx[1] - mn[1], p.thickness),
      pockets: [],
    };
    const dx = m.x1 - m.x0;
    const dz = m.z1 - m.z0;
    if (dz > dx) {
      m.ori = "V";
      m.len = dz;
      m.w = dx;
    } else {
      m.ori = "H";
      m.len = dx;
      m.w = dz;
    }
    members.push(m);
  }
  if (!members.length) return null;
  const bb = {
    x0: Math.min(...members.map((m) => m.x0)),
    x1: Math.max(...members.map((m) => m.x1)),
    z0: Math.min(...members.map((m) => m.z0)),
    z1: Math.max(...members.map((m) => m.z1)),
  };
  const xs = [...new Set(members.flatMap((m) => [m.x0, m.x1]))].sort((a, b) => a - b);
  const zs = [...new Set(members.flatMap((m) => [m.z0, m.z1]))].sort((a, b) => a - b);
  const cov = (x: number, z: number) =>
    members.some((m) => x > m.x0 + 0.1 && x < m.x1 - 0.1 && z > m.z0 + 0.1 && z < m.z1 - 0.1);
  const nx = xs.length - 1;
  const nz = zs.length - 1;
  const cell: boolean[][] = [];
  const seen: boolean[][] = [];
  for (let i = 0; i < nx; i++) {
    cell.push([]);
    seen.push([]);
    for (let j = 0; j < nz; j++) {
      cell[i].push(!cov((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2));
      seen[i].push(false);
    }
  }
  const openings: FrameLayout["openings"] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      if (!cell[i][j] || seen[i][j]) continue;
      const st: Array<[number, number]> = [[i, j]];
      seen[i][j] = true;
      let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
      while (st.length) {
        const [a, b] = st.pop()!;
        X0 = Math.min(X0, xs[a]);
        X1 = Math.max(X1, xs[a + 1]);
        Z0 = Math.min(Z0, zs[b]);
        Z1 = Math.max(Z1, zs[b + 1]);
        for (const [c, d] of [
          [a - 1, b],
          [a + 1, b],
          [a, b - 1],
          [a, b + 1],
        ] as Array<[number, number]>) {
          if (c >= 0 && c < nx && d >= 0 && d < nz && cell[c][d] && !seen[c][d]) {
            seen[c][d] = true;
            st.push([c, d]);
          }
        }
      }
      if (X1 - X0 > 15 && Z1 - Z0 > 15) openings.push({ x0: X0, x1: X1, z0: Z0, z1: Z1 });
    }

  const T = 3;
  for (const m of members) {
    const ends =
      m.ori === "H"
        ? [
            { at: m.x0, side: -1 },
            { at: m.x1, side: 1 },
          ]
        : [
            { at: m.z0, side: -1 },
            { at: m.z1, side: 1 },
          ];
    for (const e of ends) {
      const butt = members.some((o) => {
        if (o === m) return false;
        if (m.ori === "H") {
          return (
            ((Math.abs(o.x1 - m.x0) < T && e.side < 0) ||
              (Math.abs(o.x0 - m.x1) < T && e.side > 0)) &&
            Math.min(o.z1, m.z1) - Math.max(o.z0, m.z0) > m.w * 0.5
          );
        }
        return (
          ((Math.abs(o.z1 - m.z0) < T && e.side < 0) ||
            (Math.abs(o.z0 - m.z1) < T && e.side > 0)) &&
          Math.min(o.x1, m.x1) - Math.max(o.x0, m.x0) > m.w * 0.5
        );
      });
      if (!butt) continue;
      const setback = 22;
      const n = m.w >= 35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? m.w / 2 : k === 0 ? m.w * 0.27 : m.w * 0.73;
        if (m.ori === "H") m.pockets.push({ x: e.at - e.side * setback, z: m.z0 + off, ang: 0 });
        else m.pockets.push({ x: m.x0 + off, z: e.at - e.side * setback, ang: 90 });
      }
    }
  }
  return { members, openings, bb };
}

/** Only Shaker if the room actually stored door-style rails AND they leave a real opening. */
export function shakerOpening(
  p: Part,
  style: DoorStyle | null,
): { x: number; y: number; w: number; h: number; recess: number } | null {
  if (!style) return null;
  if (p.type !== "Door" && p.type !== "Drawer") return null;
  if (style.top < 8 || style.bot < 8 || style.stile < 8) return null;
  const innerL = p.L - style.bot - style.top;
  const innerW = p.W - 2 * style.stile;
  if (innerL < 40 || innerW < 40) return null;
  if (style.recess < 0.4) return null;
  return { x: style.bot, y: style.stile, w: innerL, h: innerW, recess: style.recess };
}

export function normName(n: string): string {
  return (n || "")
    .replace(/UnFin(?:ished)? End/gi, "UEnd")
    .replace(/Fin(?:ished)? End/gi, "FEnd")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function dimClose(aL: number, aW: number, bL: number, bW: number, tol = 1): boolean {
  const pairs = [
    [Math.abs(aL - bL) <= tol && Math.abs(aW - bW) <= tol, 0],
    [Math.abs(aL - bW) <= tol && Math.abs(aW - bL) <= tol, 1],
  ];
  return pairs.some((p) => p[0]);
}

export function assyCodes(roomFile: string, cabNo: string): string[] {
  const codes: string[] = [];
  const m = (roomFile || "").match(/Room\s*(\d+)/i);
  const c = cabNo || "1";
  if (m) {
    codes.push(`R${m[1]}C${c}`, `R${m[1]}N${c}`);
  }
  codes.push(`C${c}`, `CAB${c}`, `CAB-${c}`);
  return codes;
}

export function assyMatches(assy: string, codes: string[], cabNo: string): boolean {
  if (!assy) return true;
  const u = assy.toUpperCase();
  if (codes.some((c) => u === c.toUpperCase() || u.includes(c.toUpperCase()))) return true;
  if (cabNo && (u.endsWith(`C${cabNo}`) || u.includes(`CAB${cabNo}`) || u.includes(`#${cabNo}`)))
    return true;
  return false;
}

export function applyRots(rots: Rot[]): number[][] {
  let M = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const r of rots) if (r.deg) M = mul(rotMat(r.axis, r.deg), M);
  return M;
}
