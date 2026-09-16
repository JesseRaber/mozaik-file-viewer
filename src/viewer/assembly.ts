import * as THREE from "three";
import { assyMatches, dimClose, groupOf, normName } from "./geom";
import { printHtml } from "./print";
import { currentProduct, currentRoom, state } from "./store";
import type { Engine, PartView } from "./engine";
import type { Part } from "./types";
import { dim, unitLabel } from "./units";
import { clear, el } from "./dom";

export function openAssembly(host: HTMLElement, engine: Engine) {
  const prod = currentProduct();
  const room = currentRoom();
  clear(host);
  host.classList.add("open");
  const bar = el("div", { class: "sheet-bar" });
  const title = el("div", { class: "sheet-title", text: `Box assembly — ${prod?.name ?? ""}` });
  const runSel = el("select") as HTMLSelectElement;
  const explode = el("input", { type: "range", min: "0", max: "50", value: "12", "aria-label": "Explode" }) as HTMLInputElement;
  const printBtn = el("button", { type: "button", text: "Print" });
  const close = el("button", { type: "button", class: "sheet-close", text: "Close" });
  bar.append(title, runSel, el("span", { class: "lbl", text: "Explode" }), explode, printBtn, close);

  const page = el("div", { class: "sheet-page" });
  const head = el("div", { class: "sheet-head" }, el("h2", { text: "Cabinet box — assembly / cut sheet" }));
  const sub = el("div", { class: "sheet-meta" });
  const body = el("div", { class: "sheet-body" });
  const img = el("div", { class: "asm-img" });
  const tableWrap = el("div", { class: "sheet-table-wrap" });
  const table = el("table", { class: "sheet-table" });
  const note = el("p", { class: "sheet-note" });
  note.style.margin = "8px 2px 0";
  note.style.fontSize = "12px";
  note.style.lineHeight = "1.45";
  note.style.color = "#8a6d3b";
  note.hidden = true;
  tableWrap.append(table, note);
  body.append(img, tableWrap);
  page.append(head, sub, body);
  host.append(bar, el("div", { class: "sheet-scroll" }, page));

  const runs = state.job?.runs || {};
  const ids = Object.keys(runs).sort((a, b) => Number(b) - Number(a));
  if (!ids.length) runSel.style.display = "none";
  else {
    ids.forEach((id) => runSel.append(el("option", { value: id, text: `Run ${id}` })));
    runSel.value = ids[0];
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0xf3efe6);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  img.appendChild(renderer.domElement);
  const cam = new THREE.PerspectiveCamera(38, 1, 8, 40000);
  let theta = 0,
    phi = Math.PI / 2,
    dist = 2500;
  const target = new THREE.Vector3();
  let drag: { x: number; y: number } | null = null;
  let alive = true;
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  function applyCam() {
    cam.up.set(0, 0, 1);
    cam.position.set(
      target.x + dist * Math.sin(phi) * Math.sin(theta),
      target.y - dist * Math.sin(phi) * Math.cos(theta),
      target.z + dist * Math.cos(phi),
    );
    cam.lookAt(target);
  }
  function resize() {
    const w = img.clientWidth || 480;
    const h = Math.max(320, w * 0.72);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    img.style.height = `${h}px`;
  }

  renderer.domElement.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    renderer.domElement.setPointerCapture(e.pointerId);
  }, sig);
  window.addEventListener("pointerup", () => {
    drag = null;
  }, sig);
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    theta -= (e.clientX - drag.x) * 0.005;
    phi = Math.max(0.08, Math.min(Math.PI - 0.08, phi - (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY };
  }, sig);
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dist = Math.max(300, Math.min(20000, dist * (1 + Math.sign(e.deltaY) * 0.09)));
    },
    { passive: false, signal: ac.signal },
  );

  // A thickness the job never stated is a guess from the part type. Mark it on
  // screen and on paper rather than letting it print as if it were measured.
  function thickCell(r: Row): HTMLElement {
    const td = el("td", {
      class: "mono",
      text: r.thSrc === "default" ? `${dim(r.th)} *` : dim(r.th),
    });
    if (r.thSrc === "default") {
      td.style.background = "#fff4d6";
      td.style.color = "#6b4b00";
    }
    return td;
  }

  type Row = {
    name: string;
    type: string;
    L: number;
    W: number;
    th: number;
    thSrc: Part["thicknessSource"];
    qty: number;
    labels: string;
    mat: string;
    members: PartView[];
  };

  function rows(): Row[] {
    const map = new Map<string, Row>();
    for (const pp of engine.parts) {
      if (groupOf(pp.part.type) === "Doors & fronts") continue;
      if (groupOf(pp.part.type) === "Face frame") continue;
      if (groupOf(pp.part.type) === "Hardware") continue;
      const key = `${normName(pp.part.name)}|${Math.round(pp.part.L)}x${Math.round(pp.part.W)}`;
      let g = map.get(key);
      if (!g) {
        g = {
          name: pp.part.name,
          type: pp.part.type,
          L: pp.part.L,
          W: pp.part.W,
          th: pp.part.thickness,
          thSrc: pp.part.thicknessSource,
          qty: 0,
          labels: "",
          mat: pp.part.material || "",
          members: [],
        };
        map.set(key, g);
      }
      g.qty += 1;
      g.members.push(pp);
    }
    const list = [...map.values()];
    const run = runs[runSel.value];
    if (run) {
      for (const mat of run.materials) {
        for (const op of mat.parts) {
          if (!assyMatches(op.assy, room?.file || "", prod?.cabNo || "1")) continue;
          const hit = list.find(
            (g) =>
              (normName(g.name) === normName(op.name) ||
                normName(g.name).includes(normName(op.name)) ||
                normName(op.name).includes(normName(g.name))) &&
              dimClose(g.L, g.W, op.L, op.W, 1.2),
          );
          if (hit) {
            hit.labels = hit.labels ? `${hit.labels}, ${op.id}` : String(op.id);
            hit.mat = hit.mat || mat.name;
          }
        }
      }
    }
    return list.sort((a, b) => b.L * b.W - a.L * a.W);
  }

  function fillTable() {
    clear(table);
    const headRow = el("tr");
    for (const h of ["#", "Part", "Q", "L", "W", "Thk", "Label", "Material"]) {
      headRow.append(el("th", { text: h }));
    }
    table.append(headRow);
    rows().forEach((r, i) => {
      const tr = el("tr");
      tr.append(
        el("td", { class: "num", text: String(i + 1) }),
        el("td", { text: r.name }),
        el("td", { class: "num", text: String(r.qty) }),
        el("td", { class: "mono", text: dim(r.L) }),
        el("td", { class: "mono", text: dim(r.W) }),
        thickCell(r),
        el("td", { class: "mono", text: r.labels || "—" }),
        el("td", { text: r.mat || "—" }),
      );
      table.append(tr);
    });
    sub.textContent = `${room?.name ?? ""} · cab #${prod?.cabNo ?? "?"} · ${unitLabel()}${runSel.value ? ` · Run ${runSel.value}` : ""}`;

    const all = rows();
    const guessed = all.filter((r) => r.thSrc === "default").length;
    clear(note);
    if (guessed) {
      note.append(
        el("b", { text: "* " }),
        document.createTextNode(
          `${guessed} of ${all.length} thicknesses are defaults for the part type, not values from this job. Check them before cutting.`,
        ),
      );
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  function applyExplode() {
    const v = Number(explode.value) / 100;
    for (const pp of engine.parts) {
      const g = groupOf(pp.part.type);
      const hide = g === "Doors & fronts" || g === "Face frame" || g === "Hardware";
      pp.mesh.visible = !hide && state.chips[g as keyof typeof state.chips] !== false;
      pp.mesh.position.copy(pp.home).addScaledVector(pp.dir, v);
    }
  }

  const prevBg = engine.scene.background;
  engine.scene.background = new THREE.Color(0xf3efe6);
  const paperFill = new THREE.AmbientLight(0xffffff, 1.1);
  const paperKey = new THREE.DirectionalLight(0xfff6ea, 0.55);
  paperKey.position.set(-800, -1400, 1800);
  engine.scene.add(paperFill, paperKey);

  explode.oninput = applyExplode;
  runSel.onchange = fillTable;

  if (prod) {
    target.set(prod.width / 2, prod.depth / 2, prod.height / 2);
    dist = Math.max(prod.width, prod.height, prod.depth) * 2.4;
  }
  applyExplode();
  fillTable();

  const loop = () => {
    if (!alive) return;
    requestAnimationFrame(loop);
    resize();
    applyCam();
    renderer.render(engine.scene, cam);
  };
  loop();

  printBtn.onclick = () => {
    applyCam();
    renderer.render(engine.scene, cam);
    const url = renderer.domElement.toDataURL("image/png");
    const wrap = document.createElement("div");
    const h2 = document.createElement("h2");
    h2.textContent = "Cabinet box — assembly / cut sheet";
    const p = document.createElement("p");
    p.textContent = sub.textContent || "";
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "12px";
    const imgEl = document.createElement("img");
    imgEl.src = url;
    imgEl.alt = "Assembly view";
    imgEl.style.width = "62%";
    imgEl.style.border = "1.5px solid #222";
    row.append(imgEl, table.cloneNode(true));
    wrap.append(h2, p, row);
    if (!note.hidden) wrap.append(note.cloneNode(true));
    printHtml(
      "Assembly",
      `h2{margin:0} table{border-collapse:collapse;width:100%}
       th{background:#1c1a17;color:#eee;padding:4px} td{border:1px solid #ccc;padding:3px 6px}
       .sheet-note{font-size:10pt;margin-top:8px;color:#6b4b00}`,
      wrap,
      "17in 11in",
    );
  };

  function teardown() {
    alive = false;
    ac.abort();
    renderer.dispose();
    for (const pp of engine.parts) {
      pp.mesh.visible = true;
      pp.mesh.position.copy(pp.home).addScaledVector(pp.dir, state.explode);
    }
    engine.scene.remove(paperFill, paperKey);
    paperFill.dispose();
    paperKey.dispose();
    engine.scene.background = prevBg;
    engine.applyMaterials();
    host.classList.remove("open");
    clear(host);
  }
  close.onclick = teardown;
}
