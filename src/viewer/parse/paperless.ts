import { assyMatches, dimClose, normName } from "../geom";
import { xmlPayload } from "../encoding";
import type { Job, LoadWarning, PaperlessData, PaperlessPart } from "../types";

function num(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function flag(el: Element, name: string): boolean {
  return /^(true|1|yes)$/i.test(el.getAttribute(name) || "");
}

/**
 * Parse the LabelData produced by Mozaik's "export to apps".
 *
 * Accepts the text of either `<Job>-<Run>-LabelStatus.xml` (written beside the
 * app files on the Paperless Shop share) or the `LabelData.xml` found inside a
 * `.mzklbl` archive. Both carry the same <LabelData> element.
 *
 * This is the richest description of a job Mozaik emits: material thickness,
 * the cabinet and room a part belongs to, nested sheet positions and edge
 * banding are all stated rather than inferred.
 *
 * Note the `:scope >` selectors. A status file also contains progress records
 * shaped like `<Mat Index="…"><Part Index="1" Printed="True" /></Mat>`, which
 * sit outside <LabelData> and must never be read as cabinet parts.
 */
export function parseLabelData(
  text: string,
  fname: string,
): { data: PaperlessData | null; warning?: LoadWarning } {
  const payload = xmlPayload(text);
  if (!payload) {
    return { data: null, warning: { file: fname, message: "No XML payload" } };
  }
  const doc = new DOMParser().parseFromString(payload, "text/xml");
  if (doc.querySelector("parsererror")) {
    return { data: null, warning: { file: fname, message: "LabelData XML parse error" } };
  }
  const ld = doc.querySelector("LabelData");
  if (!ld) {
    // A status file with no work recorded yet is just a <JobData/> header.
    return { data: null };
  }

  const parts: PaperlessPart[] = [];
  const materials: PaperlessData["materials"] = [];
  let remnants = 0;

  ld.querySelectorAll(":scope > Material").forEach((mEl) => {
    const matName = mEl.getAttribute("Name") || "";
    const thickness = num(mEl, "Thickness");
    materials.push({ name: matName, abbr: mEl.getAttribute("Abbr") || "", thickness });

    mEl.querySelectorAll(":scope > Sheet").forEach((sEl) => {
      const sheetId = num(sEl, "ID");
      const patternNum = num(sEl, "PatternNum");
      const gcodeFile = sEl.getAttribute("GcodeFilename") || "";

      sEl.querySelectorAll(":scope > Part").forEach((pEl) => {
        // Remnants are offcuts Mozaik draws on the sheet, not cabinet parts.
        if (flag(pEl, "IsRemnant")) {
          remnants++;
          return;
        }
        parts.push({
          name: pEl.getAttribute("Name") || "",
          L: num(pEl, "L"),
          W: num(pEl, "W"),
          assy: pEl.getAttribute("AssyNo") || "",
          cabName: pEl.getAttribute("CabName") || "",
          roomName: pEl.getAttribute("RoomName") || "",
          material: matName,
          thickness,
          edgeBand: pEl.getAttribute("EdgeBand") || "",
          partNo: num(pEl, "PartNo"),
          shorthand: pEl.getAttribute("ShorthandName") || "",
          comment: pEl.getAttribute("Comment") || "",
          sheetId,
          patternNum,
          x: num(pEl, "X"),
          y: num(pEl, "Y"),
          rot: num(pEl, "Rot"),
          gcodeFile,
        });
      });
    });
  });

  const data: PaperlessData = {
    file: fname,
    jobName: ld.getAttribute("JobName") || "",
    runName: ld.getAttribute("RunName") || "",
    device: ld.getAttribute("TargetCpuDisplayName") || "",
    generator: ld.getAttribute("GeneratorCpuCpuName") || "",
    inches: flag(ld, "Inches"),
    materials,
    parts,
    remnants,
  };
  if (!parts.length) {
    return { data, warning: { file: fname, message: "LabelData has no cabinet parts" } };
  }
  return { data };
}

/**
 * Overlay Paperless Shop data onto a job loaded from its folder.
 *
 * Mozaik states thickness per material here, so anything matched stops being a
 * guess. Only about 6% of <CabProdPart> elements carry a usable thickness
 * attribute, so on a typical job this is the difference between a printed cut
 * sheet you can trust and one you cannot.
 *
 * Runs AFTER applyOptimizerThickness and deliberately overrides it: a stated
 * material thickness beats a fuzzy optimizer match.
 *
 * Returns the number of parts matched.
 */
export function applyPaperless(job: Job, data: PaperlessData): number {
  let matched = 0;
  for (const room of job.rooms) {
    for (const prod of room.products) {
      const candidates = data.parts.filter((pp) =>
        assyMatches(pp.assy, room.file, prod.cabNo || "1"),
      );
      if (!candidates.length) continue;
      // One optimizer label belongs to one physical part, so a candidate is
      // consumed once. Two identical shelves take two labels, not the same one.
      const used = new Set<number>();
      for (const part of prod.parts) {
        let hitIdx = -1;
        for (let i = 0; i < candidates.length; i++) {
          if (used.has(i)) continue;
          const c = candidates[i];
          if (!dimClose(part.L, part.W, c.L, c.W, 1.2)) continue;
          const a = normName(part.name);
          const b = normName(c.name);
          if (a !== b && !a.includes(b) && !b.includes(a)) continue;
          hitIdx = i;
          break;
        }
        if (hitIdx < 0) continue;
        const c = candidates[hitIdx];
        used.add(hitIdx);
        if (c.thickness > 0.2) {
          part.thickness = c.thickness;
          part.thicknessSource = "paperless";
        }
        part.material = c.material || part.material;
        part.edgeBand =
          c.edgeBand && c.edgeBand.toUpperCase() !== "NONE" ? c.edgeBand : part.edgeBand;
        part.labelNo = c.partNo || part.labelNo;
        matched++;
      }
    }
  }
  return matched;
}
