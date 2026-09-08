import * as THREE from "three";
import { openAssembly } from "./assembly";
import { buildDemoJob } from "./demo";
import { clear, el, svg } from "./dom";
import type { Engine } from "./engine";
import { colorGroupMeta, createEngine, partDims } from "./engine";
import { openFaceFrame } from "./faceframe";
import { openFiles, openJobFolder, openRecent, recentJobs, setJobsRoot } from "./fs";
import { openGcode } from "./gcode-view";
import { filesToItems, loadItems } from "./parse/load";
import { openParms } from "./parms-view";
import {
  currentProduct,
  emit,
  initPrefs,
  saveColors,
  saveTitle,
  setJob,
  state,
  subscribe,
  unit,
} from "./store";
import { fmt, setUnit, unitLabel } from "./units";
import type { ChipKey, RenderMode } from "./types";

function iconFrame(): SVGElement {
  const g = svg("svg", { viewBox: "0 0 32 32", width: 28, height: 28, class: "mark" });
  g.append(
    svg("rect", { width: 32, height: 32, rx: 6, fill: "#12110f" }),
    svg("rect", { x: 7, y: 5, width: 18, height: 20, fill: "none", stroke: "#c8ccd4", "stroke-width": 2 }),
    svg("rect", { x: 15, y: 5, width: 2, height: 20, fill: "#c8ccd4" }),
    svg("rect", { x: 7, y: 13, width: 18, height: 2, fill: "#c8ccd4" }),
  );
  return g;
}

function iconEye(on: boolean): SVGElement {
  const g = svg("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", "stroke-width": 1.8 });
  g.append(svg("path", { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" }));
  if (on) g.append(svg("circle", { cx: 12, cy: 12, r: 2.2, fill: "currentColor", stroke: "none" }));
  else g.append(svg("path", { d: "M4 4l16 16" }));
  return g;
}

function feat(title: string, body: string, d: string) {
  const row = el("div", { class: "feat" });
  const glyph = el("div", { class: "glyph" });
  const ic = svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 1.7 });
  ic.append(svg("path", { d }));
  glyph.append(ic);
  const copy = el("div");
  copy.append(el("b", { text: title }), el("span", { text: body }));
  row.append(glyph, copy);
  return row;
}

export function mountViewer(root: HTMLElement): () => void {
  initPrefs();
  clear(root);
  root.className = "mfv-root";

  const offs: Array<() => void> = [];
  const onWin = <K extends keyof WindowEventMap>(type: K, fn: (ev: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    window.addEventListener(type, fn as EventListener, opts);
    offs.push(() => window.removeEventListener(type, fn as EventListener, opts));
  };

  const side = el("aside", { class: "mfv-side" });
  const brand = el("div", { class: "mfv-brand" });
  brand.append(iconFrame(), el("span", { class: "kicker", text: "Mozaik File Viewer" }), el("span", { class: "beta", text: "Local" }));
  const pname = el("h1", { text: "No cabinet loaded" });
  const pdims = el("p", { class: "sub", text: "Open a job folder to begin" });
  const openRow = el("div", { class: "open-row" });
  const bDir = el("button", { type: "button", class: "primary", text: "Open job folder" });
  const bFiles = el("button", { type: "button", text: "Files / zip" });
  openRow.append(bDir, bFiles);
  const warn = el("div", { class: "warn" });
  warn.hidden = true;
  const roomRow = el("label", { class: "sel" }, el("span", { text: "Room" }));
  const selRoom = el("select") as HTMLSelectElement;
  roomRow.append(selRoom);
  const cabRow = el("div", { class: "cab-row" });
  const cabSelWrap = el("label", { class: "sel" }, el("span", { text: "Cabinet" }));
  const selCab = el("select") as HTMLSelectElement;
  cabSelWrap.append(selCab);
  const units = el("div", { class: "units" });
  const uIn = el("button", { type: "button", class: unit === "in" ? "on" : "", text: "in" });
  const uMm = el("button", { type: "button", class: unit === "mm" ? "on" : "", text: "mm" });
  units.append(uIn, uMm);
  cabRow.append(cabSelWrap, units);
  const search = el("input", {
    class: "search",
    type: "search",
    placeholder: "Search cabinets…",
  }) as HTMLInputElement;
  const libTag = el("button", { type: "button", class: "lib-tag" });
  libTag.hidden = true;
  const actions = el("div", { class: "actions" });
  const bFF = el("button", { type: "button", class: "act ff", text: "Face frame sheet" });
  const bAsm = el("button", { type: "button", class: "act asm", text: "Box assembly sheet" });
  const bPrm = el("button", { type: "button", class: "act prm", text: "Construction parameters" });
  const bGcv = el("button", { type: "button", class: "act gcv", text: "G-code visualizer" });
  const bPref = el("button", { type: "button", text: "Preferences" });
  actions.append(bFF, bAsm, bPrm, bGcv, bPref);
  const groups = el("div", { class: "groups" });
  const foot = el(
    "footer",
    {},
    "Drag to orbit · Shift-drag pan · scroll zoom. Double-click a chip to isolate. Files never leave this machine.",
  );
  const menuBtn = el("button", { type: "button", class: "menu-btn", "aria-label": "Open menu" });
  menuBtn.append(
    svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 1.8 },
      svg("path", { d: "M4 7h16M4 12h16M4 17h16" }),
    ),
  );
  const scrim = el("div", { class: "scrim" });
  side.append(brand, pname, pdims, openRow, warn, search, roomRow, cabRow, libTag, actions, groups, foot);

  const stage = el("div", { class: "mfv-stage" });
  const landing = el("div", { class: "landing" });
  const card = el("div", { class: "card" });
  card.append(
    el("h2", { text: "Mozaik File Viewer" }),
    el("p", { class: "lede", text: "Open a job folder. Nothing is uploaded. Nothing is written back." }),
  );
  const feats = el("div", { class: "feats" });
  feats.append(
    feat("3D cabinet", "Orbit a room, explode parts, isolate layers.", "M4 7l8-4 8 4v10l-8 4-8-4zM12 3v18"),
    feat("Shop sheets", "Face-frame cut list and box assembly from the same job.", "M6 4h12v16H6zM9 8h6M9 12h6"),
    feat("Nested G-code", "Toolpaths in millimetres. G20 and G21 detected.", "M4 16l4-8 4 5 3-3 5 6"),
  );
  card.append(feats);
  const recentWrap = el("div", { class: "recent" });
  recentWrap.hidden = true;
  recentWrap.append(el("div", { class: "rhead", text: "Recent jobs" }));
  const recentList = el("div", { class: "recent-list" });
  recentWrap.append(recentList);
  const cardActions = el("div", { class: "card-actions" });
  const bRoot = el("button", { type: "button", text: "Set Jobs folder" });
  const bDemo = el("button", { type: "button", class: "primary", text: "Load demo cabinet" });
  cardActions.append(bDemo, bRoot);
  card.append(recentWrap, cardActions);
  landing.append(card);
  const chips = el("div", { class: "chips" });
  const tools = el("div", { class: "tools" });
  const mkTool = (id: string, label: string, cls = "") =>
    el("button", { type: "button", "data-id": id, class: cls, text: label });
  tools.append(
    mkTool("front", "Front"),
    mkTool("iso", "Iso", "on"),
    mkTool("back", "Back"),
    el("span", { class: "sep" }),
    mkTool("solid", "Solid", "on"),
    mkTool("xray", "X-ray"),
    mkTool("line", "Line"),
    mkTool("grid", "Grid"),
    mkTool("dims", "Dims"),
  );
  const bar = el("div", { class: "explode" });
  const ruler = el("input", { type: "range", min: "0", max: "100", value: "0", "aria-label": "Explode" }) as HTMLInputElement;
  const pct = el("span", { class: "pct", text: "0%" });
  bar.append(el("label", { text: "Explode" }), ruler, pct);
  const tag = el("div", { class: "tag" });
  const drop = el("div", { class: "drop", text: "Drop a Mozaik job folder or .zip" });
  const overlay = el("div", { class: "overlay" });
  const toast = el("div", { class: "toast" });
  stage.append(landing, chips, tools, bar, tag, drop);
  root.append(menuBtn, scrim, side, stage, overlay, toast);

  const engine: Engine = createEngine(stage);
  let raf = 0;
  let alive = true;
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!overlay.classList.contains("open")) engine.render();
  };
  loop();

  const ro = new ResizeObserver(() => engine.resize());
  ro.observe(stage);

  function flash(msg: string) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 5200);
  }

  function closeNav() {
    side.classList.remove("open");
    root.classList.remove("nav-open");
  }
  function openNav() {
    side.classList.add("open");
    root.classList.add("nav-open");
  }

  async function refreshRecent() {
    const rec = await recentJobs();
    clear(recentList);
    if (!rec.length) {
      recentWrap.hidden = true;
      return;
    }
    recentWrap.hidden = false;
    rec.forEach((r) => {
      const b = el("button", { type: "button", class: "rjob", text: r.name });
      b.onclick = () => openRecent(r).catch((err) => flash(String(err?.message || err)));
      recentList.append(b);
    });
  }
  void refreshRecent();

  function fillSelects() {
    const job = state.job;
    clear(selRoom);
    clear(selCab);
    if (!job) return;
    const q = search.value.trim().toLowerCase();
    job.rooms.forEach((r, i) => {
      const n = r.products.filter((p) =>
        q ? `${p.name} ${p.cabNo} ${r.name}`.toLowerCase().includes(q) : true,
      ).length;
      selRoom.append(el("option", { value: String(i), text: `${r.name} (${r.file}) — ${n} cab` }));
    });
    selRoom.value = String(state.roomIndex);
    const room = job.rooms[state.roomIndex];
    room?.products.forEach((p, i) => {
      if (q && !`${p.name} ${p.cabNo} ${room.name}`.toLowerCase().includes(q)) return;
      selCab.append(el("option", { value: String(i), text: `#${p.cabNo || i + 1} ${p.name}` }));
    });
    selCab.value = String(state.cabIndex);
  }

  function fillGroups() {
    clear(groups);
    const order: ChipKey[] = ["Case", "Face frame", "Doors & fronts", "Drawer boxes", "Shelves", "Hardware"];
    for (const gname of order) {
      const members = engine.parts.filter((p) => p.group === gname);
      if (!members.length) continue;
      const box = el("div", { class: "grp" });
      const btn = el("button", { type: "button" });
      const eye = el("span", { class: "eye" });
      eye.append(iconEye(state.chips[gname] !== false));
      btn.append(eye, document.createTextNode(gname), el("span", { class: "n", text: String(members.length) }));
      const list = el("div", { class: "plist" });
      btn.onclick = () => box.classList.toggle("open");
      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        state.chips[gname] = state.chips[gname] === false;
        engine.applyMaterials();
        fillChips();
        fillGroups();
      });
      members.forEach((m) => {
        const row = el("button", { type: "button", class: "prow" });
        if (state.selected === m.part.id) row.classList.add("sel");
        row.append(
          el("span", { text: m.part.name }),
          el("span", { class: "dim", text: `${fmt(m.part.L)}×${fmt(m.part.W)}×${fmt(m.part.thickness)}` }),
        );
        row.onclick = () => {
          state.selected = state.selected === m.part.id ? null : m.part.id;
          engine.applyMaterials();
          fillGroups();
        };
        list.append(row);
      });
      box.append(btn, list);
      groups.append(box);
    }
  }

  function fillChips() {
    clear(chips);
    const defs: Array<{ key: ChipKey; label: string; color: string }> = [
      { key: "Case", label: "Case", color: "#b08968" },
      { key: "Face frame", label: "Face frame", color: "#d9d2c5" },
      { key: "Doors & fronts", label: "Doors & fronts", color: "#d4cbb8" },
      { key: "Drawer boxes", label: "Drawer boxes", color: "#e0c992" },
      { key: "Shelves", label: "Shelves", color: "#c9a36a" },
      { key: "Hardware", label: "Hardware", color: "#8e959c" },
      { key: "Machining", label: "Machining", color: "#c8ccd4" },
    ];
    defs.forEach((d) => {
      const present =
        d.key === "Machining"
          ? engine.parts.some((p) => p.part.holes.length || p.part.grooves.length)
          : engine.parts.some((p) => p.group === d.key);
      if (!present) return;
      const b = el("button", { type: "button", class: state.chips[d.key] === false ? "off" : "" });
      const sw = el("span", { class: "sw" });
      sw.style.background = d.color;
      b.append(sw, document.createTextNode(d.label));
      let t: number | null = null;
      b.onclick = () => {
        if (t) clearTimeout(t);
        t = window.setTimeout(() => {
          state.chips[d.key] = state.chips[d.key] === false;
          engine.applyMaterials();
          fillChips();
          fillGroups();
        }, 200);
      };
      b.ondblclick = () => {
        if (t) clearTimeout(t);
        if (d.key === "Machining") return;
        const isolated =
          state.chips[d.key] &&
          (Object.keys(state.chips) as ChipKey[]).filter((k) => k !== "Machining" && state.chips[k]).length === 1;
        if (isolated) {
          (Object.keys(state.chips) as ChipKey[]).forEach((k) => {
            if (k !== "Machining") state.chips[k] = true;
          });
        } else {
          (Object.keys(state.chips) as ChipKey[]).forEach((k) => {
            if (k !== "Machining") state.chips[k] = k === d.key;
          });
        }
        engine.applyMaterials();
        fillChips();
        fillGroups();
      };
      chips.append(b);
    });
  }

  function paintHeader() {
    const prod = currentProduct();
    if (!prod) {
      pname.textContent = "No cabinet loaded";
      pdims.textContent = "Open a job folder to begin";
      libTag.hidden = true;
      landing.classList.remove("gone");
      return;
    }
    pname.textContent = prod.name;
    const fast = prod.fasteners.length
      ? " · " + prod.fasteners.map((f) => `${f.count}× ${f.name}`).join(", ")
      : "";
    pdims.textContent = `${fmt(prod.width)} W × ${fmt(prod.height)} H × ${fmt(prod.depth)} D ${unitLabel()} · ${prod.parts.length} parts${fast}`;
    if (prod.sourceLib) {
      libTag.hidden = false;
      libTag.textContent = `Parameters: ${prod.sourceLib}`;
    } else libTag.hidden = true;
    bFF.style.display = prod.parts.some((p) => p.type === "Frame") ? "block" : "none";
    landing.classList.add("gone");
    const w = state.job?.warnings ?? [];
    if (w.length) {
      warn.hidden = false;
      warn.textContent = w.map((x) => `${x.file}: ${x.message}`).join(" · ");
    } else warn.hidden = true;
  }

  function rebuild() {
    fillSelects();
    engine.rebuildCabinet();
    fillChips();
    fillGroups();
    paintHeader();
    engine.resize();
  }

  const unsub = subscribe(() => {
    uIn.classList.toggle("on", unit === "in");
    uMm.classList.toggle("on", unit === "mm");
    rebuild();
  });

  bDir.onclick = () => openJobFolder().catch((e) => flash(String(e?.message || e)));
  bFiles.onclick = () => openFiles().catch((e) => flash(String(e?.message || e)));
  bDemo.onclick = () => setJob(buildDemoJob());
  bRoot.onclick = () => {
    void setJobsRoot().then(refreshRecent);
  };
  selRoom.onchange = () => {
    state.roomIndex = +selRoom.value;
    state.cabIndex = 0;
    state.selected = null;
    emit();
  };
  selCab.onchange = () => {
    state.cabIndex = +selCab.value;
    state.selected = null;
    emit();
  };
  search.oninput = () => fillSelects();
  uIn.onclick = () => {
    setUnit("in");
    emit();
  };
  uMm.onclick = () => {
    setUnit("mm");
    emit();
  };
  ruler.oninput = () => {
    state.explode = +ruler.value / 100;
    pct.textContent = `${Math.round(state.explode * 100)}%`;
    engine.setExplode(state.explode);
  };

  tools.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (id === "front") engine.setCam(0, Math.PI / 2);
    if (id === "iso") engine.setCam(-0.55, 1.18);
    if (id === "back") engine.setCam(Math.PI, Math.PI / 2);
    if (id === "solid" || id === "xray" || id === "line") {
      state.mode = id as RenderMode;
      engine.applyMaterials();
    }
    if (id === "grid") {
      state.grid = !state.grid;
      engine.applyMaterials();
    }
    if (id === "dims") {
      state.dims = !state.dims;
      engine.applyMaterials();
    }
    tools.querySelectorAll("button").forEach((b) => {
      const i = b.getAttribute("data-id");
      if (["front", "iso", "back"].includes(i || "") && ["front", "iso", "back"].includes(id || "")) {
        b.classList.toggle("on", i === id);
      }
      if (["solid", "xray", "line"].includes(i || "") && ["solid", "xray", "line"].includes(id || "")) {
        b.classList.toggle("on", i === id);
      }
      if (i === "grid") b.classList.toggle("on", state.grid);
      if (i === "dims") b.classList.toggle("on", state.dims);
    });
  });

  bFF.onclick = () => openFaceFrame(overlay);
  bAsm.onclick = () => openAssembly(overlay, engine);
  bPrm.onclick = () => openParms(overlay);
  bGcv.onclick = () => openGcode(overlay);
  libTag.onclick = () => openParms(overlay);
  menuBtn.onclick = () => (side.classList.contains("open") ? closeNav() : openNav());
  scrim.onclick = closeNav;

  function closeOverlay() {
    const closer = overlay.querySelector(".sheet-close") as HTMLButtonElement | null;
    if (closer) closer.click();
    else {
      overlay.classList.remove("open");
      clear(overlay);
    }
  }

  function openPrefs() {
    overlay.classList.add("open");
    clear(overlay);
    const pref = el("div", { class: "pref-card" });
    pref.append(el("h3", { text: "Preferences" }));
    colorGroupMeta().forEach((g) => {
      const row = el("label", { class: "pref-row" }, el("span", { text: g.label }));
      const inp = el("input", { type: "color", value: g.cur }) as HTMLInputElement;
      inp.oninput = () => {
        state.colors[g.key] = inp.value;
        saveColors();
        engine.rebuildCabinet();
        fillChips();
      };
      row.append(inp);
      pref.append(row);
    });
    pref.append(el("h4", { text: "Title block" }));
    (["company", "drawn", "job", "customer", "rev"] as const).forEach((k) => {
      const row = el("label", { class: "pref-row" }, el("span", { text: k }));
      const inp = el("input", { type: "text", value: state.title[k] }) as HTMLInputElement;
      inp.oninput = () => {
        state.title[k] = inp.value;
        saveTitle();
      };
      row.append(inp);
      pref.append(row);
    });
    const done = el("button", { type: "button", class: "sheet-close primary", text: "Done" });
    const reset = el("button", { type: "button", text: "Reset colors" });
    done.onclick = () => {
      overlay.classList.remove("open");
      clear(overlay);
    };
    reset.onclick = () => {
      state.colors = {};
      saveColors();
      engine.rebuildCabinet();
      fillChips();
      openPrefs();
    };
    pref.append(el("div", { class: "pref-btns" }, reset, done));
    overlay.append(pref);
  }
  bPref.onclick = openPrefs;

  let drag: { x: number; y: number; pan: boolean; moved: number } | null = null;
  const canvas = engine.renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (drag && drag.moved < 5) {
      const hit = engine.pick(e.clientX, e.clientY);
      state.selected = hit ? hit.part.id : null;
      engine.applyMaterials();
      fillGroups();
    }
  });
  onWin("pointerup", () => {
    drag = null;
  });
  onWin("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) {
        const s = engine.orbit.dist / 900;
        const right = new THREE.Vector3().setFromMatrixColumn(engine.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(engine.camera.matrix, 1);
        engine.orbit.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else {
        engine.orbit.theta -= dx * 0.0055;
        engine.orbit.phi = Math.max(0.08, Math.min(Math.PI - 0.08, engine.orbit.phi - dy * 0.0055));
      }
    }
    if (overlay.classList.contains("open")) return;
    const hit = engine.hover(e.clientX, e.clientY);
    if (hit) {
      tag.style.display = "block";
      const r = stage.getBoundingClientRect();
      tag.style.left = `${e.clientX - r.left + 14}px`;
      tag.style.top = `${e.clientY - r.top + 14}px`;
      const p = hit.part;
      tag.replaceChildren(
        el("b", { text: p.name }),
        document.createTextNode(` · ${p.type}`),
        el("div", { class: "t2", text: partDims(p) }),
        el("div", {
          class: "t2",
          text: p.hardware || `${p.holes.length} holes · ${p.grooves.length} dados · ${p.thicknessSource}`,
        }),
      );
    } else tag.style.display = "none";
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      engine.orbit.dist = Math.max(300, Math.min(25000, engine.orbit.dist * (1 + Math.sign(e.deltaY) * 0.09)));
    },
    { passive: false },
  );
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  let depth = 0;
  onWin("dragenter", (e) => {
    e.preventDefault();
    if (++depth) root.classList.add("dragging");
  });
  onWin("dragleave", (e) => {
    e.preventDefault();
    if (--depth <= 0) {
      depth = 0;
      root.classList.remove("dragging");
    }
  });
  onWin("dragover", (e) => e.preventDefault());
  onWin("drop", (e) => {
    e.preventDefault();
    depth = 0;
    root.classList.remove("dragging");
    const files = [...((e as DragEvent).dataTransfer?.files || [])];
    if (!files.length) return;
    void (async () => {
      try {
        setJob(await loadItems(await filesToItems(files)));
      } catch (err) {
        flash(String((err as Error).message || err));
      }
    })();
  });
  onWin("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (overlay.classList.contains("open")) closeOverlay();
    else closeNav();
  });
  onWin("beforeprint", () => {
    try {
      engine.renderer.setSize(2, 2, false);
    } catch {
      /* ignore */
    }
  });
  onWin("afterprint", () => engine.resize());

  paintHeader();
  engine.resize();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    unsub();
    ro.disconnect();
    offs.forEach((fn) => fn());
    engine.dispose();
  };
}
