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
  warnings: string[];
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
  const f: GFile = {name, flip: /flip/i.test(name), unit: "mm", sheetW: null,
    sheetL: null, thickness: null, tools: {}, episodes: [], warnings: []};
  let x = 0, y = 0, z = 50, mode = 0, absolute = true, unitsKnown = false;
  let tool: number | null = null, pending = "", cur: GEpisode | null = null, maxFeedZ = 0;
  const close = () => { if (cur) f.episodes.push(cur); cur = null; };
  const fail = (line: number, reason: string) => { f.warnings.push(`Line ${line + 1}: ${reason}. Preview withheld.`); };
  const sweep = (a: number, b: number, ccw: boolean) => {
    let d = b - a;
    if (ccw && d <= 0) d += Math.PI * 2;
    if (!ccw && d >= 0) d -= Math.PI * 2;
    return d;
  };
  const lines = text.split(/\r?\n/);
  if (lines.length > 200000) { f.warnings.push("Program exceeds preview limit"); return f; }
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const comment = raw.match(/\(([^)]*)\)/)?.[1];
    if (comment && (toolDiaFromComment(comment) !== null || /drill|bit|router|mill/i.test(comment))) pending = comment;
    const code = raw.replace(/\([^)]*\)/g, "").split(";")[0].trim().toUpperCase();
    if (!code || code === "%") continue;
    if (/[#\[\]\/]/.test(code)) { fail(line, "Unsupported macro or conditional block"); break; }
    const tokens = [...code.matchAll(/([A-Z])\s*([-+]?\d*\.?\d+)/g)];
    if (code.replace(/([A-Z])\s*([-+]?\d*\.?\d+)/g, "").trim()) { fail(line,"Unsupported syntax"); break; }
    const w: Record<string, number> = {}; let dwell = false, end = false;
    for (const t of tokens) {
      const key = t[1], n = Number(t[2]);
      if (!Number.isFinite(n)) { fail(line,"Non-finite number"); break; }
      if (key === "G") {
        if ([0,1,2,3].includes(n)) mode = n;
        else if (n === 20 || n === 21) { f.unit = n === 20 ? "in" : "mm"; unitsKnown = true; }
        else if (n === 90 || n === 91) absolute = n === 90;
        else if (n === 4) dwell = true;
        else if (![17,40,49,54,80,94].includes(n)) fail(line,`Unsupported G${n}`);
      } else if (key === "M") {
        if ([2,30].includes(n)) end = true;
        else if (![0,1,3,4,5,6,7,8,9].includes(n)) fail(line,`Unsupported M${n}`);
      } else if (key === "T") { close(); tool = n; f.tools[n] = pending; pending = ""; }
      else if ("XYZIJRFSNP".includes(key)) w[key] = n;
      else fail(line,`Unsupported ${key} word`);
    }
    if (f.warnings.length) break;
    if (end) break;
    if (dwell) { close(); continue; }
    if (!["X","Y","Z","I","J","R"].some(k => k in w)) continue;
    if (!unitsKnown) { fail(line,"Units must be stated with G20 or G21"); break; }
    const scale = f.unit === "in" ? 25.4 : 1;
    const next = (key: string, old: number) => key in w ? w[key] * scale + (absolute ? 0 : old) : old;
    const nx = next("X",x), ny = next("Y",y), nz = next("Z",z);
    if ([nx,ny,nz].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) { fail(line,"Coordinate out of range"); break; }
    if (mode === 0) { close(); x=nx; y=ny; z=nz; continue; }
    const pts: Array<[number, number, number]> = [];
    if (mode === 2 || mode === 3) {
      let cx: number, cy: number;
      if ("R" in w) {
        if ("I" in w || "J" in w) { fail(line,"Arc mixes radius and center offsets"); break; }
        const radius = Math.abs(w.R * scale), dx=nx-x, dy=ny-y, chord=Math.hypot(dx,dy);
        if (!chord || chord > radius*2 + 1e-6) { fail(line,"Invalid radius arc"); break; }
        const h=Math.sqrt(Math.max(0,radius*radius-chord*chord/4));
        const centers = [1,-1].map(sign => [(x+nx)/2-sign*dy/chord*h,(y+ny)/2+sign*dx/chord*h]);
        const chosen=centers.find(([a,b]) => {
          const d=Math.abs(sweep(Math.atan2(y-b,x-a),Math.atan2(ny-b,nx-a),mode===3));
          return w.R >= 0 ? d <= Math.PI+1e-7 : d >= Math.PI-1e-7;
        });
        if (!chosen) {fail(line,"Invalid radius arc");break;}
        [cx,cy]=chosen;
      } else {
        if (!("I" in w || "J" in w)) {fail(line,"Arc requires I/J or R");break;}
        cx=x+(w.I||0)*scale; cy=y+(w.J||0)*scale;
      }
      const radius=Math.hypot(x-cx,y-cy), endRadius=Math.hypot(nx-cx,ny-cy);
      if (radius <= 0 || Math.abs(radius-endRadius)>Math.max(0.05,radius*1e-4)) {fail(line,"Inconsistent arc endpoints");break;}
      const a=Math.atan2(y-cy,x-cx), delta=sweep(a,Math.atan2(ny-cy,nx-cx),mode===3);
      const steps=Math.min(4096,Math.max(2,Math.ceil(Math.abs(delta)/(Math.PI/48))));
      for(let k=1;k<=steps;k++) pts.push([cx+radius*Math.cos(a+delta*k/steps),cy+radius*Math.sin(a+delta*k/steps),z+(nz-z)*k/steps]);
      pts[pts.length-1]=[nx,ny,nz];
    } else pts.push([nx,ny,nz]);
    { // Preview every feed move; clearance height is a machine/post convention.
      if (!cur) cur={tool,pts:[[x,y,z]],zmin:Math.min(z,nz)};
      cur.pts.push(...pts);cur.zmin=Math.min(cur.zmin,nz);
      if (nz>0 && nz<35.56) maxFeedZ=Math.max(maxFeedZ,nz);
    }
    x=nx;y=ny;z=nz;
  }
  close();
  if (f.warnings.length) f.episodes=[];
  f.thickness=maxFeedZ>1 ? maxFeedZ : null;
  return f;
}

export function toolDiaMm(comment: string | undefined, fallback = 9.525): number {
  if (!comment) return fallback;
  return toolDiaFromComment(comment) ?? fallback;
}
