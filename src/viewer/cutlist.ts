import { openArchive, readArchiveEntry } from "./archive";
import { decodeBytes, xmlPayload } from "./encoding";
import { normName } from "./geom";
import type { CutlistExport, CutlistRow, Job, Product } from "./types";

/**
 * Mozaik cutlist export check (MFV-16).
 *
 * A `.mzkcut` file is a ZIP holding `AppData.xml`, whose `CutlistItem` rows are
 * the parts Mozaik itself would cut. Rows are matched to the loaded job's parts
 * by cabinet UniqueID, ReportName and size, so the owner can see per cabinet
 * whether the saved design and Mozaik's export agree. Nothing is written back.
 */

/** Export sizes are rounded; 0.1 mm absorbs that (observed 0.0001–0.05 mm). */
export const SIZE_TOL = 0.1;
/** Known Mozaik export difference: frameless Adjustable Shelf is 1/16 in narrower. */
const SHELF_DEDUCT = 1.5875;

export function parseCutlist(text: string, file: string): CutlistExport {
  const payload = xmlPayload(text);
  if (!payload) throw new Error("No XML payload in cutlist export");
  const doc = new DOMParser().parseFromString(payload, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Cutlist export XML parse error");
  const head = doc.querySelector("AssemblyCutlistData");
  if (!head) throw new Error("Not a Mozaik cutlist export (no AssemblyCutlistData)");
  const rows: CutlistRow[] = [];
  let invalid = 0;
  doc.querySelectorAll("CutlistItem").forEach((it) => {
    const W = Number(it.getAttribute("W"));
    const L = Number(it.getAttribute("L"));
    const rawQty = it.getAttribute("Quan");
    const qty = rawQty == null ? 1 : Number(rawQty);
    const cabUID = it.getAttribute("CabUniqueID") || "";
    if (!cabUID || !(W > 0 && L > 0) || !Number.isInteger(qty) || qty < 0 || rawQty === "") { invalid++; return; }
    if (qty === 0) return;
    rows.push({
      cabUID,
      cabNo: it.getAttribute("CabNumber") || "",
      roomName: it.getAttribute("RoomName") || "",
      reportName: (it.getAttribute("ReportName") || it.getAttribute("Name") || "").trim(),
      W, L, qty,
      type: it.getAttribute("CutlistType") || "",
    });
  });
  if (invalid) throw new Error(`Cutlist export has ${invalid} invalid rows; export not used`);
  if (!rows.length) throw new Error("Cutlist export has no cutlist rows");
  return {
    file,
    jobName: head.getAttribute("JobName") || "",
    runName: head.getAttribute("RunName") || "",
    rows,
  };
}

/** Read a `.mzkcut` archive. Throws with a user-facing message on anything unexpected. */
export async function readCutlistArchive(raw: ArrayBuffer, file: string): Promise<CutlistExport> {
  const zip = await openArchive(raw);
  const entry = Object.keys(zip.files).find((n) => /(^|\/)AppData\.xml$/i.test(n));
  if (!entry) throw new Error("No AppData.xml in this file; choose a Mozaik cutlist export (.mzkcut)");
  return parseCutlist(decodeBytes(await readArchiveEntry(zip.files[entry])), file);
}

export type Size = { W: number; L: number; qty: number };
export type CheckStatus = "match" | "expected" | "differs" | "job-only" | "export-only";
export type CheckRow = {
  status: CheckStatus;
  name: string;
  job?: Size;
  exp?: Size;
  /** Why an "expected" row is expected. */
  note?: string;
};
export type CabinetCheck = {
  uid: string;
  roomName: string;
  cabNo: string;
  name: string;
  rows: CheckRow[];
  /** Part units by status. */
  units: Record<CheckStatus, number>;
};
export type CutlistCheck = {
  file: string;
  jobName: string;
  runName: string;
  cabinets: CabinetCheck[];
  /** Cabinets with parts in the job but none in the export. */
  jobOnlyCabinets: Array<{ uid: string; roomName: string; cabNo: string; name: string }>;
  /** Cabinets in the export with no matching cabinet in the job. */
  exportOnlyCabinets: Array<{ uid: string; roomName: string; cabNo: string; units: number }>;
  warnings: string[];
  units: Record<CheckStatus, number>;
};

type Bucket = { name: string; W: number; L: number; qty: number };

const EXPORT_ONLY_NAMES: Record<string, string> = {
  "toe skin": "Mozaik adds the toe skin at export",
  "counter top": "Mozaik adds the counter top at export",
};
/** Door and drawer-front members the source lists separately; the export lists the assembled door. */
const DOOR_MEMBER = /^(door|drw|drawer)\b.*\b(stile|rail|br|tr|mr|mullion|panel)\b/i;

const zero = (): Record<CheckStatus, number> => ({ match: 0, expected: 0, differs: 0, "job-only": 0, "export-only": 0 });
const near = (a: number, b: number, tol = SIZE_TOL) => Math.abs(a - b) <= tol;

function bucketize<T>(items: T[], name: (t: T) => string, W: (t: T) => number, L: (t: T) => number, qty: (t: T) => number): Bucket[] {
  const out: Bucket[] = [];
  for (const it of items) {
    const b = { name: name(it), W: W(it), L: L(it), qty: qty(it) };
    if (b.qty <= 0) continue;
    const same = out.find((o) => normName(o.name) === normName(b.name) && near(o.W, b.W, 1e-6) && near(o.L, b.L, 1e-6));
    if (same) same.qty += b.qty;
    else out.push(b);
  }
  return out;
}

/** Name the job side uses for a part, matching what the export calls it. */
export function cutlistName(part: { reportName?: string; name: string }): string {
  return (part.reportName ?? part.name).trim();
}

export function compareCabinet(prod: Product, rows: CutlistRow[], roomName: string): CabinetCheck {
  const job = bucketize(prod.parts, cutlistName, (p) => p.W, (p) => p.L, (p) => p.qty * prod.quantity);
  const exp = bucketize(rows, (r) => r.reportName, (r) => r.W, (r) => r.L, (r) => r.qty);
  const out: CheckRow[] = [];
  const units = zero();
  const add = (row: CheckRow, n: number) => { out.push(row); units[row.status] += n; };
  const sameName = (a: Bucket, b: Bucket) => normName(a.name) === normName(b.name);

  // 1. Exact matches within tolerance.
  for (const j of job) for (const e of exp) {
    if (!j.qty || !e.qty || !sameName(j, e) || !near(j.W, e.W) || !near(j.L, e.L)) continue;
    const n = Math.min(j.qty, e.qty);
    add({ status: "match", name: j.name, job: { W: j.W, L: j.L, qty: n }, exp: { W: e.W, L: e.L, qty: n } }, n);
    j.qty -= n; e.qty -= n;
  }

  // 2. Known export differences.
  for (const e of exp) {
    const why = EXPORT_ONLY_NAMES[normName(e.name)];
    if (e.qty && why) { add({ status: "expected", name: e.name, exp: { ...e }, note: why }, e.qty); e.qty = 0; }
  }
  for (const j of job) {
    if (j.qty && DOOR_MEMBER.test(j.name)) {
      add({ status: "expected", name: j.name, job: { ...j }, note: "Door/drawer member; the export lists the assembled door" }, j.qty);
      j.qty = 0;
    }
  }
  for (const j of job) for (const e of exp) {
    if (!j.qty || !e.qty || !sameName(j, e) || normName(j.name) !== "adjustable shelf") continue;
    const narrower = (near(j.L, e.L) && near(j.W - e.W, SHELF_DEDUCT)) || (near(j.W, e.W) && near(j.L - e.L, SHELF_DEDUCT));
    if (!narrower) continue;
    const n = Math.min(j.qty, e.qty);
    add({ status: "expected", name: j.name, job: { W: j.W, L: j.L, qty: n }, exp: { W: e.W, L: e.L, qty: n }, note: "Mozaik exports the adjustable shelf 1.5875 mm (1/16 in) narrower" }, n);
    j.qty -= n; e.qty -= n;
  }
  endPanelRename(job, exp, add);

  // 3. Same part name, different size: a real difference.
  for (const j of job) {
    while (j.qty) {
      const cands = exp.filter((e) => e.qty && sameName(j, e));
      if (!cands.length) break;
      const e = cands.reduce((a, b) => (Math.abs(a.W - j.W) + Math.abs(a.L - j.L) <= Math.abs(b.W - j.W) + Math.abs(b.L - j.L) ? a : b));
      const n = Math.min(j.qty, e.qty);
      add({ status: "differs", name: j.name, job: { W: j.W, L: j.L, qty: n }, exp: { W: e.W, L: e.L, qty: n } }, n);
      j.qty -= n; e.qty -= n;
    }
  }

  // 4. Whatever is left exists on one side only.
  for (const j of job) if (j.qty) add({ status: "job-only", name: j.name, job: { ...j } }, j.qty);
  for (const e of exp) if (e.qty) add({ status: "export-only", name: e.name, exp: { ...e } }, e.qty);

  return { uid: prod.sourceUID || "", roomName, cabNo: prod.cabNo, name: prod.name, rows: out, units };
}

/**
 * Known export regeneration of a temporary end panel: the source's `UEnd (L)`
 * comes out as `End (L)` plus a `Panelized End` of the same size.
 */
function endPanelRename(job: Bucket[], exp: Bucket[], add: (row: CheckRow, n: number) => void) {
  for (const j of job) {
    const m = /^uend \((l|r)\)$/.exec(normName(j.name));
    if (!j.qty || !m) continue;
    const end = exp.find((e) => e.qty && normName(e.name) === `end (${m[1]})` && near(e.W, j.W) && near(e.L, j.L));
    if (!end) continue;
    const n = Math.min(j.qty, end.qty);
    add({ status: "expected", name: j.name, job: { W: j.W, L: j.L, qty: n }, exp: { W: end.W, L: end.L, qty: n }, note: `Export renames ${j.name} to ${end.name}` }, n);
    j.qty -= n; end.qty -= n;
    const panel = exp.find((e) => e.qty && normName(e.name) === "panelized end");
    if (panel) {
      const k = Math.min(n, panel.qty);
      add({ status: "expected", name: panel.name, exp: { W: panel.W, L: panel.L, qty: k }, note: `Export adds a panelized end with the renamed ${j.name}` }, k);
      panel.qty -= k;
    }
  }
}

export function checkCutlist(job: Job, cut: CutlistExport): CutlistCheck {
  const byCab = new Map<string, CutlistRow[]>();
  for (const r of cut.rows) {
    const list = byCab.get(r.cabUID);
    if (list) list.push(r);
    else byCab.set(r.cabUID, [r]);
  }
  const seen = new Set<string>();
  const cabinets: CabinetCheck[] = [];
  const jobOnlyCabinets: CutlistCheck["jobOnlyCabinets"] = [];
  const warnings: string[] = [];
  const duplicate: string[] = [];
  for (const room of job.rooms) for (const prod of room.products) {
    const uid = prod.sourceUID || "";
    if (uid && seen.has(uid)) { duplicate.push(prod.cabNo); continue; }
    if (uid) seen.add(uid);
    const rows = uid ? byCab.get(uid) : undefined;
    if (rows) cabinets.push(compareCabinet(prod, rows, room.name));
    else if (prod.quantity > 0 && prod.parts.length)
      jobOnlyCabinets.push({ uid, roomName: room.name, cabNo: prod.cabNo, name: prod.name });
  }
  const exportOnlyCabinets = [...byCab.entries()].filter(([uid]) => !seen.has(uid)).map(([uid, rows]) => ({
    uid, roomName: rows[0].roomName, cabNo: rows[0].cabNo, units: rows.reduce((n, r) => n + r.qty, 0),
  }));
  if (!cabinets.length) throw new Error("No cabinet in this cutlist export matches the loaded job. Check that the export is from this job.");
  if (duplicate.length) warnings.push(`Duplicate cabinet identity for #${duplicate.join(", #")}; those cabinets are not compared.`);
  if (jobOnlyCabinets.length || exportOnlyCabinets.length)
    warnings.push(`The export looks like a different revision of this job: ${cabinets.length} cabinets are in both, ${jobOnlyCabinets.length} only in the job and ${exportOnlyCabinets.length} only in the export. Only the shared cabinets are compared.`);
  if (cut.jobName && normName(cut.jobName) !== normName(job.jobName))
    warnings.push(`Export job name "${cut.jobName}" differs from the loaded folder "${job.jobName}"; cabinets were matched by Mozaik cabinet ID.`);
  const units = zero();
  for (const c of cabinets) for (const k of Object.keys(units) as CheckStatus[]) units[k] += c.units[k];
  return { file: cut.file, jobName: cut.jobName, runName: cut.runName, cabinets, jobOnlyCabinets, exportOnlyCabinets, warnings, units };
}
