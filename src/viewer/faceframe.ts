import { computeFrame } from "./geom";
import { printHtml } from "./print";
import { currentProduct, currentRoom, state } from "./store";
import { dim, unitLabel } from "./units";
import { clear, el, svg } from "./dom";

export function openFaceFrame(host: HTMLElement) {
  const prod = currentProduct();
  const layout = prod && computeFrame(prod);
  clear(host);
  host.classList.add("open");
  const bar = el("div", { class: "sheet-bar" });
  const title = el("div", { class: "sheet-title", text: "Face frame — assembly / cut sheet" });
  const flip = el("button", { type: "button", text: "Invert drawing" });
  const close = el("button", { type: "button", class: "sheet-close", text: "Close" });
  const printBtn = el("button", { type: "button", text: "Print" });
  bar.append(title, flip, printBtn, close);
  const page = el("div", { class: "sheet-page" });
  host.append(bar, el("div", { class: "sheet-scroll" }, page));
  close.onclick = () => {
    host.classList.remove("open");
    clear(host);
  };
  if (!prod || !layout) {
    page.append(el("p", { class: "muted", text: "This cabinet has no face-frame members." }));
    return;
  }

  let invert = false;

  function draw() {
    clear(page);
    const h2 = el("h2", { text: "Face Frame — Assembly / Cut Sheet" });
    const meta = el(
      "div",
      { class: "sheet-meta" },
      `${currentRoom()?.name ?? ""} · #${prod!.cabNo} ${prod!.name} · ${layout!.members.length} members`,
    );
    const body = el("div", { class: "sheet-body" });
    const svgWrap = el("div", { class: "sheet-svg" });
    const tableWrap = el("div", { class: "sheet-table-wrap" });
    body.append(svgWrap, tableWrap);
    const tb = titleBlock();
    page.append(h2, meta, body, tb);

    const bb = layout!.bb;
    const pad = 40;
    const fw = bb.x1 - bb.x0 || 1;
    const fh = bb.z1 - bb.z0 || 1;
    const dw = 520;
    const dh = Math.max(280, (fh / fw) * dw);
    const s = Math.min((dw - pad * 2) / fw, (dh - pad * 2) / fh);
    const mx = (x: number) => pad + (x - bb.x0) * s;
    const mz = (z: number) => (invert ? pad + (z - bb.z0) * s : dh - pad - (z - bb.z0) * s);
    const zh = (z0: number, z1: number) => Math.abs(mz(z1) - mz(z0));

    const root = svg("svg", { viewBox: `0 0 ${dw} ${dh}`, width: dw, height: dh });
    for (const m of layout!.members) {
      const y = Math.min(mz(m.z0), mz(m.z1));
      const rect = svg("rect", {
        x: mx(m.x0),
        y,
        width: Math.max(1, (m.x1 - m.x0) * s),
        height: Math.max(1, zh(m.z0, m.z1)),
        fill: "#f3efe6",
        stroke: "#1a1714",
        "stroke-width": 1.2,
      });
      root.appendChild(rect);
      const label = svg("text", {
        x: (mx(m.x0) + mx(m.x1)) / 2,
        y: y + zh(m.z0, m.z1) / 2,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "#1a1714",
        "font-size": 9,
      });
      label.textContent = m.name;
      root.appendChild(label);
      for (const pk of m.pockets) {
        root.appendChild(
          svg("ellipse", {
            cx: mx(pk.x),
            cy: mz(pk.z),
            rx: 4.5,
            ry: 2.4,
            fill: "none",
            stroke: "#3a3f46",
            "stroke-width": 1,
            transform: pk.ang ? `rotate(${pk.ang} ${mx(pk.x)} ${mz(pk.z)})` : undefined,
          }),
        );
      }
    }
    const dimLine = (x1: number, y1: number, x2: number, y2: number, label: string) => {
      root.appendChild(svg("line", { x1, y1, x2, y2, stroke: "#3a3f46", "stroke-width": 0.8 }));
      const t = svg("text", {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2 - 4,
        "text-anchor": "middle",
        fill: "#3a3f46",
        "font-size": 9,
        "font-family": "IBM Plex Mono, ui-monospace, Consolas, monospace",
      });
      t.textContent = label;
      root.appendChild(t);
    };
    dimLine(mx(bb.x0), invert ? dh - 14 : dh - 14, mx(bb.x1), dh - 14, dim(fw));
    dimLine(14, mz(bb.z0), 14, mz(bb.z1), dim(fh));
    svgWrap.appendChild(root);

    const table = el("table", { class: "sheet-table" });
    const head = el("tr");
    for (const h of ["#", "Part", "Q", "Len", "Wid", "Thk", "Pk"]) head.append(el("th", { text: h }));
    table.append(head);
    layout!.members.forEach((m, i) => {
      const tr = el("tr");
      tr.append(
        el("td", { class: "num", text: String(i + 1) }),
        el("td", { text: m.name }),
        el("td", { class: "num", text: String(m.part.qty) }),
        el("td", { class: "mono", text: dim(m.len) }),
        el("td", { class: "mono", text: dim(m.w) }),
        el("td", { class: "mono", text: dim(m.thick) }),
        el("td", { class: "num", text: m.pockets.length ? String(m.pockets.length) : "—" }),
      );
      table.append(tr);
    });
    tableWrap.append(table);
  }

  flip.onclick = () => {
    invert = !invert;
    draw();
  };
  draw();

  printBtn.onclick = () => {
    printHtml("Face frame", sheetCss(), page, "17in 11in");
  };
}

function titleBlock() {
  const t = state.title;
  const table = el("table", { class: "title-block" });
  const r1 = el("tr");
  r1.append(
    cell("Company", t.company || "Your shop"),
    cell("Job", t.job || state.job?.jobName || "—"),
    cell("Room", currentRoom()?.name || "—"),
    cell("Cabinet", `#${currentProduct()?.cabNo ?? "?"} ${currentProduct()?.name ?? ""}`),
  );
  const r2 = el("tr");
  r2.append(
    cell("Customer", t.customer || state.job?.customer || "—"),
    cell("Units", unitLabel()),
    cell("Source library", currentProduct()?.sourceLib || "—"),
    cell("Drawn by", t.drawn || "—"),
  );
  table.append(r1, r2);
  return table;
}

function cell(k: string, v: string) {
  const td = el("td");
  td.append(el("span", { class: "k", text: k }), el("div", { class: "v", text: v }));
  return td;
}

function sheetCss() {
  return `
    h2{font:700 16px/1.2 "IBM Plex Serif",serif;margin:0 0 4px}
    .sheet-meta{font:11px "IBM Plex Mono",ui-monospace,Consolas,monospace;color:#555;margin-bottom:10px}
    .sheet-body{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .sheet-table{border-collapse:collapse;width:100%;font:11px "IBM Plex Sans",sans-serif}
    .sheet-table th{background:#1c1a17;color:#eeeae4;padding:4px 6px;text-align:left}
    .sheet-table td{border:1px solid #ccc;padding:3px 6px}
    .title-block{width:100%;border-collapse:collapse;border:2px solid #111;margin-top:12px}
    .title-block td{border:1px solid #555;padding:4px 8px;vertical-align:top}
    .k{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#666}
    .v{font-weight:700}
    .muted{color:#666;padding:24px}
  `;
}
