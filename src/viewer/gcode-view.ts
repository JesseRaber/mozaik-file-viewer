import * as THREE from "three";
import { parseGcode, toolDiaMm, type GFile } from "./parse/gcode";
import { currentProduct, state } from "./store";
import { clear, el } from "./dom";

const TOOL_COLOR = [0xc8ccd4, 0x6b8f71, 0xc45c3e, 0x7a9bb8, 0xc4a574];

export function openGcode(host: HTMLElement) {
  clear(host);
  host.classList.add("open");
  const bar = el("div", { class: "sheet-bar" });
  const title = el("div", { class: "sheet-title", text: "G-code sheet visualizer" });
  const note = el("div", { class: "sheet-note" });
  const close = el("button", { type: "button", class: "sheet-close", text: "Close" });
  bar.append(title, note, close);
  const view = el("div", { class: "gcode-view" });
  host.append(bar, view);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1a17);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 20000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  view.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe8e0d4, 0x2a2620, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(-40, 80, 60);
  scene.add(key);

  let group: THREE.Group | null = null;
  let theta = -0.4,
    phi = 1.05,
    dist = 2500;
  const target = new THREE.Vector3();
  let drag: { x: number; y: number } | null = null;
  let alive = true;
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  function disposeGeo(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  function dispose() {
    alive = false;
    ac.abort();
    if (group) disposeGeo(group);
    renderer.dispose();
    host.classList.remove("open");
    clear(host);
  }
  close.onclick = dispose;

  function applyCam() {
    camera.up.set(0, 1, 0);
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.sin(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(target);
  }

  function resize() {
    const w = view.clientWidth || 1;
    const h = view.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    theta -= dx * 0.005;
    phi = Math.max(0.08, Math.min(Math.PI - 0.08, phi - dy * 0.005));
  }, sig);
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dist = Math.max(200, Math.min(12000, dist * (1 + Math.sign(e.deltaY) * 0.09)));
    },
    { passive: false, signal: ac.signal },
  );

  function draw(files: GFile[]) {
    if (group) {
      scene.remove(group);
      disposeGeo(group);
    }
    group = new THREE.Group();
    scene.add(group);
    const W = files.find((f) => f.sheetW)?.sheetW || 48.5 * 25.4;
    const L = files.find((f) => f.sheetL)?.sheetL || 96.5 * 25.4;
    const T = files.find((f) => f.thickness)?.thickness || 19.05;
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(W, T, L),
      new THREE.MeshLambertMaterial({ color: 0x3a342c }),
    );
    bed.position.set(W / 2, -T / 2, -L / 2);
    group.add(bed);
    target.set(W / 2, 0, -L / 2);
    dist = Math.max(W, L) * 1.6;
    files.forEach((f, fi) => {
      const yFlip = f.flip ? -T : 0.4;
      f.episodes.forEach((ep) => {
        const col = TOOL_COLOR[(ep.tool ?? fi) % TOOL_COLOR.length];
        const pts = ep.pts.map((p) => new THREE.Vector3(p[0], yFlip, -p[1]));
        if (pts.length < 2) return;
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const dia = toolDiaMm(ep.tool != null ? f.tools[ep.tool] : undefined);
        const mat = new THREE.LineBasicMaterial({ color: col, linewidth: Math.max(1, dia / 8) });
        group!.add(new THREE.Line(geo, mat));
      });
    });
  }

  void (async () => {
    const items = state.job?.cncFiles || [];
    if (!items.length) {
      note.textContent = "No G-code in this job — drop a .TXT onto the window, or open the job folder.";
      return;
    }
    note.textContent = `Loading ${items.length} file${items.length > 1 ? "s" : ""}…`;
    const files: GFile[] = [];
    for (const it of items) {
      files.push(parseGcode(await it.text(), it.name));
    }
    if (!alive) return;
    const tools = files.flatMap((f) => Object.values(f.tools).map((c) => toolDiaMm(c)));
    const diaNote = tools.length ? ` · bits ${[...new Set(tools.map((d) => d.toFixed(1)))].join("/")} mm` : "";
    note.textContent = `${files.length} file${files.length > 1 ? "s" : ""} · ${currentProduct()?.name ?? ""} · millimetres (G20/G21)${diaNote}`;
    draw(files);
  })();

  const loop = () => {
    if (!alive) return;
    requestAnimationFrame(loop);
    resize();
    applyCam();
    renderer.render(scene, camera);
  };
  loop();
}
