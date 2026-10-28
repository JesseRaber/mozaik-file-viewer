import { checkCutlist, readCutlistArchive } from "./cutlist";
import type { CabinetCheck, CheckRow, CheckStatus, CutlistCheck, Size } from "./cutlist";
import { IMPORT_LIMITS } from "./archive";
import { clear, el } from "./dom";
import { pickCutlistFile } from "./fs";
import { printHtml } from "./print";
import { state } from "./store";
import { fmt, unitLabel } from "./units";

const STATUS_TEXT: Record<CheckStatus, string> = {
  match: "Matches",
  expected: "Expected",
  differs: "Differs",
  "job-only": "Only in job",
  "export-only": "Only in export",
};
const PROBLEM: CheckStatus[] = ["differs", "job-only", "export-only"];
const LIMITS_NOTE = "Compares part names, sizes and quantities per cabinet. Labels and edge banding are not checked. The export is read only; nothing is written back.";

const problems = (c: CabinetCheck) => PROBLEM.reduce((n, k) => n + c.units[k], 0);
const size = (s?: Size) => (s ? `${fmt(s.L)} × ${fmt(s.W)}` : "—");

/** Load a .mzkcut chosen by the user. Cancel or any error leaves the loaded job and any prior export untouched. */
async function addExport(): Promise<string | null> {
  const job = state.job;
  if (!job) return null;
  const file = await pickCutlistFile();
  if (!file) return null;
  if (file.size > IMPORT_LIMITS.archiveBytes) throw new Error("Cutlist export exceeds the 64 MiB limit");
  const cut = await readCutlistArchive(await file.arrayBuffer(), file.name);
  checkCutlist(job, cut); // validate before replacing anything
  if (state.job !== job) return null; // a different job was opened meanwhile
  job.cutlist = cut;
  return file.name;
}

export function openCutlist(host: HTMLElement, flash: (msg: string) => void) {
  clear(host);
  host.classList.add("open");
  const bar = el("div", { class: "sheet-bar cut-bar" });
  const title = el("div", { class: "sheet-title", text: "Cutlist check" });
  const add = el("button", { type: "button", class: "primary" });
  const filter = el("select", { "aria-label": "Cabinets shown" }) as HTMLSelectElement;
  filter.append(el("option", { value: "review", text: "Cabinets to review" }), el("option", { value: "all", text: "All cabinets" }));
  const printBtn = el("button", { type: "button", text: "Print" });
  const close = el("button", { type: "button", class: "sheet-close", text: "Close" });
  bar.append(title, add, filter, printBtn, close);
  const page = el("div", { class: "sheet-page cut-page" });
  host.append(bar, el("div", { class: "sheet-scroll" }, page));
  close.onclick = () => {
    host.classList.remove("open");
    clear(host);
  };

  let check: CutlistCheck | null = null;
  function render() {
    const job = state.job;
    clear(page);
    check = null;
    add.textContent = job?.cutlist ? "Choose another export" : "Add cutlist export (.mzkcut)";
    page.append(el("h2", { text: "Cutlist check — loaded job vs Mozaik cutlist export" }));
    if (!job || !job.rooms.length) {
      page.append(el("p", { text: "Open a job folder first." }));
      add.disabled = true; filter.disabled = true; printBtn.disabled = true;
      return;
    }
    add.disabled = false;
    if (!job.cutlist) {
      page.append(
        el("p", { text: "Add the cutlist export Mozaik made for this job (Export to apps, file ending .mzkcut). Each cabinet's parts are compared with the loaded job." }),
        el("p", { class: "cut-limits", text: LIMITS_NOTE }),
      );
      filter.disabled = true; printBtn.disabled = true;
      return;
    }
    try {
      check = checkCutlist(job, job.cutlist);
    } catch (e) {
      page.append(el("p", { class: "cut-warn", text: String((e as Error)?.message || e) }));
      filter.disabled = true; printBtn.disabled = true;
      return;
    }
    filter.disabled = false; printBtn.disabled = false;
    page.append(report(check, filter.value === "all"));
  }

  add.onclick = () => {
    const before = state.job?.cutlist;
    addExport()
      .then((name) => {
        if (name) flash(`Cutlist export ${name} loaded; job unchanged.`);
        render();
      })
      .catch((e) => {
        if (state.job) state.job.cutlist = before;
        flash(`${String((e as Error)?.message || e).replace(/\.$/, "")}. Nothing was changed.`);
        render();
      });
  };
  filter.onchange = render;
  printBtn.onclick = () => {
    if (!check) return;
    printHtml("Cutlist check", `
      h2{font:700 16px/1.3 "Segoe UI",sans-serif;margin:0 0 6px} h3{font:600 13px/1.3 "Segoe UI",sans-serif;margin:14px 0 4px}
      p{margin:4px 0} table{border-collapse:collapse;width:100%} thead{display:table-header-group} tr,section{break-inside:avoid}
      th{background:#182230;color:#fff;padding:5px;text-align:left} td{border:1px solid #ccc;padding:3px 6px}
      .cut-bad td{color:#9b2c14;font-weight:600} .cut-exp td{color:#555} .cut-warn{color:#9b2c14;font-weight:600}
      details>summary{list-style:none} details:not([open])>table{display:none}
    `, report(check, filter.value === "all"));
  };
  render();
}

function report(check: CutlistCheck, all: boolean): HTMLElement {
  const job = state.job!;
  const wrap = el("div");
  const review = check.cabinets.filter((c) => problems(c) > 0);
  wrap.append(
    el("div", { class: "sheet-meta", text: `Job: ${job.jobName} · Export: ${check.file} · ${check.jobName || "—"} ${check.runName} · Sizes L × W (${unitLabel()})` }),
    el("p", { class: "cut-limits", text: LIMITS_NOTE }),
  );
  for (const w of check.warnings) wrap.append(el("p", { class: "cut-warn", role: "note", text: w }));
  const u = check.units;
  wrap.append(
    el("p", {
      class: review.length ? "cut-verdict cut-warn" : "cut-verdict cut-ok",
      text: review.length
        ? `${review.length} of ${check.cabinets.length} cabinets need review.`
        : `All ${check.cabinets.length} compared cabinets agree with the export, apart from expected differences.`,
    }),
    el("p", {
      class: "cut-summary",
      text: `Part units: ${u.match} match · ${u.expected} expected · ${u.differs} differ · ${u["job-only"]} only in job · ${u["export-only"]} only in export`,
    }),
  );
  if (check.jobOnlyCabinets.length)
    wrap.append(el("p", { class: "cut-warn", text: `Cabinets only in the job (not compared): ${check.jobOnlyCabinets.map((c) => `#${c.cabNo} ${c.name}`).join(", ")}` }));
  if (check.exportOnlyCabinets.length)
    wrap.append(el("p", { class: "cut-warn", text: `Cabinets only in the export (not compared): ${check.exportOnlyCabinets.map((c) => `#${c.cabNo} (${c.roomName}, ${c.units} parts)`).join(", ")}` }));
  const shown = all ? check.cabinets : review;
  if (!shown.length) wrap.append(el("p", { text: "No cabinet needs review. Choose All cabinets to see each comparison." }));
  for (const c of shown) wrap.append(cabinet(c));
  return wrap;
}

function cabinet(c: CabinetCheck): HTMLElement {
  const bad = problems(c);
  const sec = el("section", { class: "cut-cab" });
  sec.append(
    el("h3", {}, `#${c.cabNo} ${c.name}`, el("span", { class: "cut-room", text: ` · ${c.roomName}` }), " ",
      el("span", { class: bad ? "cut-pill bad" : "cut-pill ok", text: bad ? `Review: ${bad} part${bad === 1 ? "" : "s"}` : "Agrees" })),
    el("p", { class: "cut-summary", text: `${c.units.match} match · ${c.units.expected} expected · ${c.units.differs} differ · ${c.units["job-only"]} only in job · ${c.units["export-only"]} only in export` }),
  );
  const order: CheckStatus[] = ["differs", "job-only", "export-only", "expected"];
  const listed = order.flatMap((s) => c.rows.filter((r) => r.status === s));
  if (listed.length) sec.append(table(listed));
  const matches = c.rows.filter((r) => r.status === "match");
  if (matches.length) {
    const det = el("details", { class: "cut-matches" });
    det.append(el("summary", { text: `Show ${matches.length} matching part rows` }), table(matches));
    sec.append(det);
  }
  return sec;
}

function table(rows: CheckRow[]): HTMLTableElement {
  const t = el("table", { class: "sheet-table cut-table" });
  const head = el("tr");
  for (const h of ["Part", "Job size", "Export size", "Qty", "Result"]) head.append(el("th", { text: h }));
  t.append(el("thead", {}, head));
  const body = el("tbody");
  for (const r of rows) {
    const cls = PROBLEM.includes(r.status) ? "cut-bad" : r.status === "expected" ? "cut-exp" : "";
    const qty = r.job && r.exp ? String(r.job.qty) : r.job ? `${r.job.qty} / 0` : `0 / ${r.exp?.qty ?? 0}`;
    body.append(el("tr", { class: cls || undefined },
      el("td", { text: r.name }),
      el("td", { class: "num", text: size(r.job) }),
      el("td", { class: "num", text: size(r.exp) }),
      el("td", { class: "num", text: qty, title: "Job / export when they differ" }),
      el("td", { text: r.note ? `${STATUS_TEXT[r.status]}: ${r.note}` : STATUS_TEXT[r.status] }),
    ));
  }
  t.append(body);
  return t;
}
