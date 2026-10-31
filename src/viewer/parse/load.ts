import { IMPORT_LIMITS, openArchive, readArchiveEntry, safeImportPath } from "../archive";
import { decodeBytes, xmlPayload } from "../encoding";
import { assyMatches, parseAssy, dimClose, normName } from "../geom";
import type { CncFile, FileItem, Job, LoadWarning, OptRun, PaperlessData } from "../types";
import { parseDes } from "./des";
import { mergeRuns, parseOpt } from "./opt";
import { parseJobParms } from "./parms";
import { applyPaperless, parseLabelData } from "./paperless";

const CNC_EXT = [".nc", ".tap", ".gcode", ".gc", ".cnc", ".mmg", ".bpp", ".anc", ".xxl", ".ngc"];

/** Mozaik "export to apps" archives. All three are ZIPs. */
const PAPERLESS_EXT = [".mzklbl", ".mzkcut", ".mzkasy"];

function looksLikeGcode(head: string): boolean {
  return /Mozaik Output|G20|G21|G90/.test(head) && /G0\d? |G1 |X[\d.-]/.test(head);
}

function applyOptimizerThickness(job: Job) {
  for (const room of job.rooms) {
    // Mozaik reuses cabinet numbers within a room (island panels, mirror frames): one note per number, not per part.
    const dupes = [...new Set(room.products.map(p => p.cabNo))].filter(no => room.products.filter(p => p.cabNo === no).length > 1)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (dupes.length)
      job.warnings.push({file: room.file, message: `Cabinet number${dupes.length > 1 ? "s" : ""} #${dupes.join(", #")} used more than once; optimizer thickness not matched for those cabinets`});
  }
  for (const room of job.rooms) for (const prod of room.products) for (const part of prod.parts) {
    if (room.products.filter(p => p.cabNo === prod.cabNo).length > 1) continue;
    const matches = Object.values(job.runs).flatMap(run => run.materials.flatMap(mat =>
      mat.parts.filter(op => mat.thickness > 0.2 && normName(part.name) !== "" &&
        normName(part.name) === normName(op.name) && assyMatches(op.assy, room.file, prod.cabNo) &&
        (parseAssy(op.assy)?.room != null || job.rooms.flatMap(r => r.products).filter(p => Number(p.cabNo) === Number(prod.cabNo)).length === 1) &&
        dimClose(part.L, part.W, op.L, op.W, 0.05)).map(op => ({ mat, op }))));
    const identities = new Set(matches.map(({mat}) => JSON.stringify([mat.name, mat.thickness])));
    if (identities.size > 1) {
      job.warnings.push({file: room.file, message: `Ambiguous optimizer material/thickness for ${part.name}; source selection required`});
      continue;
    }
    if (!matches.length) continue;
    const mat = matches[0].mat;
    if (part.thicknessSource === "xml") {
      if (Math.abs(part.thickness - mat.thickness) > 0.05)
        job.warnings.push({file: room.file, message: `Optimizer thickness conflicts with XML for ${part.name}; XML retained`});
      continue;
    }
    part.thickness = mat.thickness; part.thicknessSource = "optimizer";
    part.material = mat.name;
  }
}

export async function loadItems(items: FileItem[]): Promise<Job> {
  if (items.length > IMPORT_LIMITS.files) throw new Error("Import exceeds file-count limit");
  let totalBytes = 0;
  items = items.map(item => {
    safeImportPath(item.path);
    let cached: Promise<ArrayBuffer> | undefined;
    const raw = () => cached ||= item.raw().then(buf => {
      totalBytes += buf.byteLength;
      if (buf.byteLength > IMPORT_LIMITS.fileBytes || totalBytes > IMPORT_LIMITS.totalBytes) throw new Error("Import exceeds size limit");
      return buf;
    });
    return {...item, raw, text: async () => decodeBytes(await raw())};
  });
  const warnings: LoadWarning[] = [];
  const roomFiles = items.filter(it => /\.(des|sbk)$/i.test(it.path));
  const parents = new Set(roomFiles.map(it => it.path.replace(/\\/g, "/").split("/").slice(0, -1).join("/")));
  if (parents.size > 1) throw new Error("Multiple job folders detected. Open one job folder at a time.");
  const root = [...parents][0] || "";
  if (root && items.some(it => !it.path.replace(/\\/g, "/").startsWith(root + "/")))
    throw new Error("Files outside the selected job folder detected. Open one job at a time.");
  const names = roomFiles.filter(it => /\.des$/i.test(it.path)).map(it => it.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Duplicate room identity; open one job at a time.");
  let jobName = root.split("/").filter(Boolean).at(-1) || "";
  let customer = "";
  const desItems: FileItem[] = [];
  const sbkItems: FileItem[] = [];
  const optItems: FileItem[] = [];
  const parmItems: FileItem[] = [];
  const cncItems: FileItem[] = [];
  const txtCandidates: FileItem[] = [];
  const paperlessItems: FileItem[] = [];

  for (const it of items) {
    const nl = it.path.toLowerCase();
    if (!jobName && it.path.includes("/")) jobName = it.path.split("/")[0];
    if (nl.endsWith("jobdat.dat")) {
      try {
        const t = await it.text();
        const payload = xmlPayload(t);
        if (payload) {
          const doc = new DOMParser().parseFromString(payload, "text/xml");
          if (doc.querySelector("parsererror")) throw new Error("Invalid JobDat XML");
          customer = doc.querySelector("CustomerName")?.textContent || "";
        }
      } catch (err) {
        warnings.push({ file: it.name, message: `Could not read JobDat: ${String(err)}` });
      }
    } else if (nl.endsWith(".des")) desItems.push(it);
    else if (nl.endsWith(".sbk")) sbkItems.push(it);
    else if (nl.endsWith(".opt")) optItems.push(it);
    else if (nl.endsWith("-jobparms.dat")) parmItems.push(it);
    else if (PAPERLESS_EXT.some((e) => nl.endsWith(e))) paperlessItems.push(it);
    else if (nl.endsWith("status.xml") || nl.endsWith("labeldata.xml")) paperlessItems.push(it);
    else if (CNC_EXT.some((e) => nl.endsWith(e))) cncItems.push(it);
    else if (nl.endsWith(".txt")) txtCandidates.push(it);
  }

  const runs: Record<string, OptRun> = {};
  for (const it of optItems) {
    try {
      const txt = decodeBytes(await it.raw());
      const { run, warning } = parseOpt(txt, it.name);
      if (warning) warnings.push(warning);
      if (run) mergeRuns(runs, run);
    } catch (err) {
      warnings.push({ file: it.name, message: `Optimizer failed: ${String(err)}` });
    }
  }

  const desBases = new Set(desItems.map((it) => it.name.replace(/\.des$/i, "").toLowerCase()));
  const orphanSbk = sbkItems.filter((it) => !desBases.has(it.name.replace(/\.sbk$/i, "").toLowerCase()));
  // A .sbk with no .des beside it is a backup Mozaik left behind (e.g. a deleted room). Use backups only when no .des exists.
  const useItems = desItems.length ? desItems : orphanSbk;
  if (desItems.length && orphanSbk.length)
    warnings.push({ file: "Backups", message: `Backup room file${orphanSbk.length > 1 ? "s" : ""} without a current room skipped: ${orphanSbk.map((it) => it.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ")}` });
  const rooms = [];
  const emptyRooms: string[] = [];
  for (const it of useItems) {
    try {
      const txt = decodeBytes(await it.raw());
      const { room, warning } = parseDes(txt, it.name);
      if (warning?.message === "Room has no products") emptyRooms.push(it.name);
      else if (warning) warnings.push(warning);
      if (room) rooms.push(room);
    } catch (err) {
      warnings.push({ file: it.name, message: `Room failed: ${String(err)}` });
    }
  }
  rooms.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
  if (emptyRooms.length)
    warnings.push({ file: emptyRooms.length > 1 ? "Rooms" : emptyRooms[0], message: emptyRooms.length > 1 ? `${emptyRooms.length} rooms have no cabinets: ${emptyRooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ")}` : "Room has no products" });

  for (const it of txtCandidates) {
    try {
      const head = (await it.text()).slice(0, 400);
      if (looksLikeGcode(head)) cncItems.push(it);
    } catch (err) {
      warnings.push({ file: it.name, message: `Could not sniff text file: ${String(err)}` });
    }
  }

  const parms = [];
  for (const it of parmItems) {
    try {
      const { lib, warning } = parseJobParms(it.name, await it.text());
      if (warning) warnings.push(warning);
      if (lib) parms.push(lib);
    } catch (err) {
      warnings.push({ file: it.name, message: `JobParms failed: ${String(err)}` });
    }
  }
  parms.sort((a, b) => a.lib.localeCompare(b.lib));

  if (!rooms.length && !cncItems.length) {
    const detail = warnings.length
      ? warnings.map((w) => `${w.file}: ${w.message}`).join("\n")
      : "No .des / .sbk rooms with cabinets were found.";
    throw new Error(detail);
  }

  const cncFiles: CncFile[] = cncItems.map((it) => ({
    path: it.path,
    name: it.name,
    text: () => it.text(),
  }));

  const job: Job = {
    jobName: jobName || "Loaded job",
    customer,
    rooms,
    runs,
    cncFiles,
    parms,
    warnings,
    source: "files",
  };
  applyOptimizerThickness(job);

  const paperless = await loadPaperless(paperlessItems, warnings, job.jobName);
  if (paperless) {
    job.paperless = paperless;
    job.paperlessMatched = applyPaperless(job, paperless);
  }
  job.warnings.push({file: "Source snapshot", message: "Read-only design reference; not a verified cutlist. Files are not monitored for changes. Reload the intended revision; cut sizes, report names and exported-only parts can differ."});
  const guessed = rooms.flatMap(r => r.products.flatMap(p => p.parts)).filter(p => p.thicknessSource === "default").length;
  if (guessed) job.warnings.push({file: "Thickness", message: `${guessed} part records use estimated thickness; verify source values before use.`});
  return job;
}

/**
 * Find the richest Paperless Shop export among the loaded files.
 *
 * A job folder can hold several — one per target tablet, plus status files
 * that are empty until work is recorded. Take whichever describes the most
 * parts; they are exports of the same run.
 */
async function loadPaperless(
  items: FileItem[],
  warnings: LoadWarning[],
  jobName: string,
): Promise<PaperlessData | null> {
  const candidates: PaperlessData[] = [];
  for (const it of items) {
    try {
      const nl = it.name.toLowerCase();
      let text: string | null = null;
      if (PAPERLESS_EXT.some((e) => nl.endsWith(e))) {
        const zip = await openArchive(await it.raw());
        const entry = Object.keys(zip.files).find((n) => /labeldata\.xml$/i.test(n));
        if (!entry) continue;
        text = decodeBytes(await readArchiveEntry(zip.files[entry]));
      } else {
        text = decodeBytes(await it.raw());
      }
      const { data, warning } = parseLabelData(text, it.name);
      if (warning) warnings.push(warning);
      if (data) {
        if (normName(data.jobName) !== normName(jobName) || !data.jobName.trim())
          warnings.push({file: it.name, message: "Paperless job identity does not match; export ignored"});
        else candidates.push(data);
      }
    } catch (err) {
      warnings.push({ file: it.name, message: `Paperless Shop export failed: ${String(err)}` });
    }
  }
  if (candidates.length > 1) {
    warnings.push({file: "Paperless exports", message: "Multiple exports found; load only the intended job revision/run export. No overlay applied."});
    return null;
  }
  return candidates[0] || null;
}

export async function filesToItems(fileList: File[]): Promise<FileItem[]> {
  const items: FileItem[] = [];
  if (fileList.length > IMPORT_LIMITS.files) throw new Error("Import exceeds file-count limit");
  for (const f of fileList) {
    safeImportPath(f.webkitRelativePath || f.name);
    if (f.size > (/\.zip$/i.test(f.name) ? IMPORT_LIMITS.archiveBytes : IMPORT_LIMITS.fileBytes)) throw new Error("Selected file exceeds size limit");
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await openArchive(await f.arrayBuffer());
      for (const name of Object.keys(zip.files)) {
        const zf = zip.files[name];
        if (zf.dir) continue;
        items.push({
          path: name,
          name: name.split("/").pop() || name,
          text: async () => decodeBytes(await readArchiveEntry(zf)),
          raw: () => readArchiveEntry(zf),
        });
      }
    } else {
      items.push({
        path: f.webkitRelativePath || f.name,
        name: f.name,
        text: async () => decodeBytes(await f.arrayBuffer()),
        raw: () => f.arrayBuffer(),
      });
    }
  }
  return items;
}

export async function walkHandle(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: FileItem[],
) {
  if (prefix.split("/").length > 32) throw new Error("Folder nesting exceeds limit");
  for await (const [name, h] of dir.entries()) {
    if (out.length >= IMPORT_LIMITS.files) throw new Error("Folder exceeds file-count limit");
    if (h.kind === "file") {
      const file = h as FileSystemFileHandle;
      out.push({
        path: prefix + name,
        name,
        text: async () => decodeBytes(await (await file.getFile()).arrayBuffer()),
        raw: async () => (await file.getFile()).arrayBuffer(),
      });
    } else if (h.kind === "directory") {
      await walkHandle(h as FileSystemDirectoryHandle, `${prefix}${name}/`, out);
    }
  }
}

/** Read entries before the browser closes its drag data store. */
export async function droppedItems(transfer: DataTransfer): Promise<FileItem[]> {
  const entries = [...transfer.items].filter(i => i.kind === "file").map(i => i.webkitGetAsEntry?.());
  const files = [...transfer.files];
  if (!entries.some(Boolean)) return filesToItems(files);
  const items: FileItem[] = [];
  async function visit(entry: FileSystemEntry, prefix: string): Promise<void> {
    if (items.length >= IMPORT_LIMITS.files || prefix.split("/").length > 32) throw new Error("Dropped folder exceeds import limits");
    const path = prefix + entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve,reject) => (entry as FileSystemFileEntry).file(resolve,reject));
      const expanded = await filesToItems([file]);
      for (const item of expanded) items.push({...item, path: /\.zip$/i.test(file.name) ? prefix + item.path : path});
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        const batch = await new Promise<FileSystemEntry[]>((resolve,reject) => reader.readEntries(resolve,reject));
        if (!batch.length) break;
        for (const child of batch) await visit(child,path + "/");
      }
    }
  }
  for (const entry of entries) if (entry) await visit(entry,"");
  return items;
}
