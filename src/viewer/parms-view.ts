import { parmValueText } from "./parse/parms";
import { printHtml } from "./print";
import { currentProduct, state } from "./store";
import { unit } from "./units";
import { clear, el } from "./dom";

export function openParms(host: HTMLElement) {
  clear(host);
  host.classList.add("open");
  const libs = state.job?.parms || [];
  const bar = el("div", { class: "sheet-bar light" });
  const title = el("div", { class: "sheet-title dark", text: "Construction parameters" });
  const sel = el("select", { "aria-label": "Parameter library" }) as HTMLSelectElement;
  libs.forEach((l, i) => {
    sel.append(el("option", { value: String(i), text: l.lib }));
  });
  const cabLib = currentProduct()?.sourceLib;
  if (cabLib) {
    const i = libs.findIndex((l) => l.lib === cabLib || l.lib.includes(cabLib) || cabLib.includes(l.lib));
    if (i >= 0) sel.value = String(i);
  }
  const search = el("input", {
    type: "text",
    placeholder: "Search code or description…", "aria-label": "Search parameters",
  }) as HTMLInputElement;
  const printBtn = el("button", { type: "button", text: "Print" });
  const close = el("button", { type: "button", class: "sheet-close", text: "Close" });
  const base = el("select", { "aria-label": "Parameter category numbering" }) as HTMLSelectElement;
  base.append(el("option", {value: "", text: "All categories (numbering unverified)"}),
    el("option", {value: "0", text: "Categories start at 0"}), el("option", {value: "1", text: "Categories start at 1"}));
  bar.append(title, sel, base, search, printBtn, close);
  const body = el("div", { class: "prm-body" });
  const cats = el("div", { class: "prm-cats" });
  const tblWrap = el("div", { class: "prm-tbl-wrap" });
  const table = el("table", { class: "sheet-table light" });
  tblWrap.append(table);
  body.append(cats, tblWrap);
  host.append(bar, body);
  close.onclick = () => {
    host.classList.remove("open");
    clear(host);
  };

  let cat = 0;
  base.value = libs[+sel.value]?.categoryBase?.toString() ?? "";
  function render() {
    const L = libs[+sel.value];
    clear(cats);
    clear(table);
    if (!L) {
      table.append(el("tr", {}, el("td", { text: "No parameter libraries in this job." })));
      return;
    }
    const q = search.value.trim().toLowerCase();
    if (base.value !== "") L.cats.forEach((c, i) => {
      const b = el("button", { type: "button", text: c, class: i === cat ? "on" : "" });
      b.onclick = () => {
        cat = i;
        render();
      };
      cats.append(b);
    });
    const head = el("tr");
    for (const h of ["Code", "Description", "Value"]) head.append(el("th", { text: h }));
    table.append(head);
    for (const p of L.params) {
      const inCat = base.value === "" || p.cat === cat + Number(base.value);
      if (!inCat) continue;
      if (q && !`${p.code} ${p.desc}`.toLowerCase().includes(q)) continue;
      const tr = el("tr");
      tr.append(
        el("td", { class: "code", text: p.code }),
        el("td", { text: p.desc || "—" }),
        el("td", { class: "val", text: parmValueText(p, unit) }),
      );
      table.append(tr);
    }
  }
  sel.onchange = () => { cat = 0; base.value = libs[+sel.value]?.categoryBase?.toString() ?? ""; render(); };
  base.onchange = () => { cat = 0; render(); };
  search.oninput = render;
  printBtn.onclick = () =>
    printHtml(
      "Parameters",
      `
    table{border-collapse:collapse;width:100%}
    th{background:#1c1a17;color:#eee;padding:6px;text-align:left}
    td{border:1px solid #ccc;padding:4px 8px}
  `,
      table,
    );
  render();
}
