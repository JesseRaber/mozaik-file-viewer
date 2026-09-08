import JSZip from "jszip";
import { decodeBytes } from "../encoding";
import { defaultThickness, dimClose, normName } from "../geom";
import type { CncFile, FileItem, Job, LoadWarning, OptRun } from "../types";
import { parseDes } from "./des";
import { mergeRuns, parseOpt } from "./opt";
import { parseJobParms } from "./parms";

const CNC_EXT = [".nc", ".tap", ".gcode", ".gc", ".cnc", ".mmg", ".bpp", ".anc", ".xxl", ".ngc"];

function looksLikeGcode(head: string): boolean {
  return /Mozaik Output|G20|G21|G90/.test(head) && /G0\d? |G1 |X[\d.-]/.test(head);
}

function applyOptimizerThickness(job: Job) {
  const mats: Array<{ name: string; thickness: number; parts: { name: string; L: number; W: number }[] }> =
    [];
  for (const run of Object.values(job.runs)) {
    for (const mat of run.materials) {
      if (mat.thickness > 0.2) mats.push(mat);
    }
  }
  if (!mats.length) return;
  for (const room of job.rooms) {
    for (const prod of room.products) {
      for (const part of prod.parts) {
        if (part.thicknessSource === "xml") continue;
        for (const mat of mats) {
          const hit = mat.parts.some(
            (op) =>
              dimClose(part.L, part.W, op.L, op.W, 1.2) &&
              (normName(part.name) === normName(op.name) ||
                normName(part.name).includes(normName(op.name)) ||
                normName(op.name).includes(normName(part.name))),
          );
          if (hit) {
            part.thickness = mat.thickness;
            part.thicknessSource = "optimizer";
            part.material = part.material || mat.name;
            break;
          }
        }
        if (part.thicknessSource === "default") {
          part.thickness = defaultThickness(part.type);
        }
      }
    }
  }
}

export async function loadItems(items: FileItem[]): Promise<Job> {
  const warnings: LoadWarning[] = [];
  let jobName = "";
  let customer = "";
  const desItems: FileItem[] = [];
  const sbkItems: FileItem[] = [];
  const optItems: FileItem[] = [];
  const parmItems: FileItem[] = [];
  const cncItems: FileItem[] = [];
  const txtCandidates: FileItem[] = [];

  for (const it of items) {
    const nl = it.path.toLowerCase();
    if (!jobName && it.path.includes("/")) jobName = it.path.split("/")[0];
    if (nl.endsWith("jobdat.dat")) {
      try {
        const t = await it.text();
        const m = t.match(/<CustomerName>([^<]*)<\/CustomerName>/);
        if (m) customer = m[1];
      } catch (err) {
        warnings.push({ file: it.name, message: `Could not read JobDat: ${String(err)}` });
      }
    } else if (nl.endsWith(".des")) desItems.push(it);
    else if (nl.endsWith(".sbk")) sbkItems.push(it);
    else if (nl.endsWith(".opt")) optItems.push(it);
    else if (nl.endsWith("-jobparms.dat")) parmItems.push(it);
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
  const useItems = desItems.concat(
    sbkItems.filter((it) => !desBases.has(it.name.replace(/\.sbk$/i, "").toLowerCase())),
  );
  const rooms = [];
  for (const it of useItems) {
    try {
      const txt = decodeBytes(await it.raw());
      const { room, warning } = parseDes(txt, it.name);
      if (warning) warnings.push(warning);
      if (room) rooms.push(room);
    } catch (err) {
      warnings.push({ file: it.name, message: `Room failed: ${String(err)}` });
    }
  }
  rooms.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));

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

  if (!rooms.length) {
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
  return job;
}

export async function filesToItems(fileList: File[]): Promise<FileItem[]> {
  const items: FileItem[] = [];
  for (const f of fileList) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(f);
      for (const name of Object.keys(zip.files)) {
        const zf = zip.files[name];
        if (zf.dir) continue;
        items.push({
          path: name,
          name: name.split("/").pop() || name,
          text: async () => decodeBytes(await zf.async("arraybuffer")),
          raw: () => zf.async("arraybuffer"),
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
  for await (const [name, h] of dir.entries()) {
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
