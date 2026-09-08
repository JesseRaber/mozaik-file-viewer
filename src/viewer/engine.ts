import * as THREE from "three";
import { groupOf, shapeToPath, shakerOpening } from "./geom";
import { currentProduct, currentRoom, state } from "./store";
import type { ChipKey, DoorStyle, Part, Product } from "./types";
import { hoverDim, unit } from "./units";

const AX: Record<string, THREE.Vector3> = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
};

export type PartView = {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  extra: THREE.Mesh[];
  ops: THREE.Group;
  part: Part;
  home: THREE.Vector3;
  dir: THREE.Vector3;
  group: string;
};

const DEFAULT_COLORS: Record<string, string> = {
  ends: "#b08968",
  botpar: "#b08968",
  stretch: "#9c7a52",
  back: "#c4a574",
  shelf: "#c9a36a",
  frame: "#d9d2c5",
  fronts: "#d4cbb8",
  drwbox: "#e0c992",
  hardware: "#8e959c",
};

const TYPE_GROUP: Record<string, string> = {
  FEnd: "ends",
  UEnd: "ends",
  Bottom: "botpar",
  Partition: "botpar",
  Stretcher: "stretch",
  Sleeper: "stretch",
  Toe: "stretch",
  Nailer: "stretch",
  Top: "stretch",
  UBack: "back",
  AdjustableShelf: "shelf",
  Frame: "frame",
  Door: "fronts",
  Drawer: "fronts",
  DrawerSide: "drwbox",
  DrawerBack: "drwbox",
  DrawerFront: "drwbox",
  DrawerBottom: "drwbox",
  Metal: "hardware",
};

type MatSet = {
  face: THREE.MeshLambertMaterial;
  xray: THREE.MeshLambertMaterial;
  edge: THREE.LineBasicMaterial;
};

const palette: Record<string, MatSet> = {};

function hexOf(type: string): string {
  const g = TYPE_GROUP[type] || "frame";
  return state.colors[g] || DEFAULT_COLORS[g] || DEFAULT_COLORS.frame;
}

function matSet(hex: string): MatSet {
  const color = new THREE.Color(hex);
  const edge = color.clone().multiplyScalar(0.55);
  return {
    face: new THREE.MeshLambertMaterial({ color }),
    xray: new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
    edge: new THREE.LineBasicMaterial({ color: edge }),
  };
}

function setFor(type: string): MatSet {
  const hex = hexOf(type);
  const key = type + hex;
  if (!palette[key]) palette[key] = matSet(hex);
  return palette[key];
}

export function colorGroupMeta() {
  return [
    { key: "ends", label: "Ends" },
    { key: "botpar", label: "Bottom & partitions" },
    { key: "stretch", label: "Stretchers / toe" },
    { key: "back", label: "Back" },
    { key: "shelf", label: "Shelves" },
    { key: "frame", label: "Face frame" },
    { key: "fronts", label: "Doors & fronts" },
    { key: "drwbox", label: "Drawer boxes" },
    { key: "hardware", label: "Hardware" },
  ].map((g) => ({ ...g, cur: state.colors[g.key] || DEFAULT_COLORS[g.key] }));
}

const holeMat = new THREE.MeshLambertMaterial({
  color: 0x1a2028,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -4,
});
const grooveMat = new THREE.MeshLambertMaterial({
  color: 0x5e4520,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -2,
});
const hlMat = new THREE.MeshLambertMaterial({ color: 0xc45c3e, emissive: 0x3a120c });
const lineFace = new THREE.MeshLambertMaterial({ color: 0xf7f4ee });
const linePanel = new THREE.MeshLambertMaterial({ color: 0xe8e2d6 });

export type Engine = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  parts: PartView[];
  dispose: () => void;
  resize: () => void;
  render: () => void;
  setExplode: (v: number) => void;
  applyMaterials: () => void;
  rebuildCabinet: () => void;
  pick: (cx: number, cy: number) => PartView | null;
  hover: (cx: number, cy: number) => PartView | null;
  setCam: (theta: number, phi: number) => void;
  orbit: { theta: number; phi: number; dist: number; target: THREE.Vector3 };
};

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

function hardwareGeo(p: Part): THREE.BufferGeometry {
  const L = Math.min(Math.abs(p.L) || 30, 400);
  const W = Math.min(Math.abs(p.W) || 10, 40);
  const D = Math.min(Math.abs(p.thickness) || 19, 60);
  if (Math.abs(p.L - p.W) < Math.max(p.L, p.W) * 0.35) {
    const r = Math.min(Math.max(p.L, p.W) / 2, 20);
    const g = new THREE.CylinderGeometry(r, r * 0.72, D, 20);
    g.rotateX(Math.PI / 2);
    g.translate(p.L / 2, p.W / 2, D / 2);
    return g;
  }
  const bar = new THREE.BoxGeometry(L, Math.min(W, 12), Math.min(W, 12));
  bar.translate(L / 2, W / 2, D);
  return bar;
}

function extrudeShape(pts: Array<{ x: number; y: number }>, depth: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  pts.forEach((pt, i) => (i ? s.lineTo(pt.x, pt.y) : s.moveTo(pt.x, pt.y)));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

function buildMesh(p: Part, doorStyle: DoorStyle | null): { mesh: THREE.Mesh; extra: THREE.Mesh[]; edges: THREE.LineSegments } {
  const set = setFor(p.type);
  const extra: THREE.Mesh[] = [];
  let mesh: THREE.Mesh;
  const shake = shakerOpening(p, doorStyle);
  if (p.type === "Metal") {
    const g = hardwareGeo(p);
    mesh = new THREE.Mesh(g, set.face);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), set.edge);
    mesh.add(edges);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, extra, edges };
  }
  if (shake) {
    const outer = new THREE.Shape();
    outer.moveTo(0, 0);
    outer.lineTo(p.L, 0);
    outer.lineTo(p.L, p.W);
    outer.lineTo(0, p.W);
    const hole = new THREE.Path();
    hole.moveTo(shake.x, shake.y);
    hole.lineTo(shake.x + shake.w, shake.y);
    hole.lineTo(shake.x + shake.w, shake.y + shake.h);
    hole.lineTo(shake.x, shake.y + shake.h);
    outer.holes.push(hole);
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: p.thickness, bevelEnabled: false });
    mesh = new THREE.Mesh(frameGeo, set.face);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo, 20), set.edge);
    mesh.add(edges);
    const panel = new THREE.Shape();
    panel.moveTo(shake.x, shake.y);
    panel.lineTo(shake.x + shake.w, shake.y);
    panel.lineTo(shake.x + shake.w, shake.y + shake.h);
    panel.lineTo(shake.x, shake.y + shake.h);
    const panelGeo = new THREE.ExtrudeGeometry(panel, {
      depth: Math.max(3, p.thickness - shake.recess),
      bevelEnabled: false,
    });
    const pm = new THREE.Mesh(panelGeo, set.face);
    pm.add(new THREE.LineSegments(new THREE.EdgesGeometry(panelGeo, 20), set.edge));
    pm.castShadow = true;
    pm.receiveShadow = true;
    mesh.add(pm);
    extra.push(pm);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, extra, edges };
  }
  const g = extrudeShape(shapeToPath(p.shape), p.thickness);
  mesh = new THREE.Mesh(g, set.face);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), set.edge);
  mesh.add(edges);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, extra, edges };
}

function addOps(p: Part, mesh: THREE.Mesh): THREE.Group {
  const ops = new THREE.Group();
  for (const h of p.holes) {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(h.dia / 2, 0.6), Math.max(h.dia / 2, 0.6), h.depth + 2, 14),
      holeMat,
    );
    cyl.rotation.x = Math.PI / 2;
    const zc = h.flip ? h.depth / 2 - 1 : p.thickness - h.depth / 2 + 1;
    cyl.position.set(h.x, h.y, zc);
    ops.add(cyl);
  }
  for (const gr of p.grooves) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(gr.len, gr.w, gr.depth + 1.2),
      grooveMat,
    );
    const a = (gr.ang * Math.PI) / 180;
    box.position.set(
      gr.x + Math.cos(a) * gr.len / 2,
      gr.y + Math.sin(a) * gr.len / 2,
      gr.flip ? gr.depth / 2 - 0.6 : p.thickness - gr.depth / 2 + 0.6,
    );
    box.rotation.z = a;
    ops.add(box);
  }
  mesh.add(ops);
  return ops;
}

function place(p: Part, mesh: THREE.Mesh) {
  const m = new THREE.Matrix4();
  for (const r of p.rot) {
    if (!r.deg) continue;
    const axis = AX[r.axis] || AX.Z;
    m.premultiply(new THREE.Matrix4().makeRotationAxis(axis, (r.deg * Math.PI) / 180));
  }
  mesh.applyMatrix4(m);
  mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
}

export function createEngine(host: HTMLElement): Engine {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12110f);
  const camera = new THREE.PerspectiveCamera(38, 1, 8, 40000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe8e0d4, 0x2a2620, 0.95));
  const key = new THREE.DirectionalLight(0xfff6ea, 0.7);
  key.position.set(-1200, -1800, 2200);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8c4ce, 0.28);
  fill.position.set(1500, 1200, 600);
  scene.add(fill);

  const grid = new THREE.GridHelper(6000, 60, 0x2a2620, 0x1c1a17);
  grid.rotation.x = Math.PI / 2;
  grid.visible = false;
  scene.add(grid);

  const dimGroup = new THREE.Group();
  scene.add(dimGroup);

  let cabGroup: THREE.Group | null = null;
  const parts: PartView[] = [];
  const orbit = { theta: -0.55, phi: 1.18, dist: 3200, target: new THREE.Vector3() };
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function applyCam() {
    camera.up.set(0, 0, 1);
    camera.position.set(
      orbit.target.x + orbit.dist * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.target.y - orbit.dist * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      orbit.target.z + orbit.dist * Math.cos(orbit.phi),
    );
    camera.lookAt(orbit.target);
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function clearCabinet() {
    if (cabGroup) {
      scene.remove(cabGroup);
      disposeObject(cabGroup);
      cabGroup = null;
    }
    parts.length = 0;
    while (dimGroup.children.length) {
      const c = dimGroup.children[0];
      dimGroup.remove(c);
      disposeObject(c);
    }
  }

  function rebuildCabinet() {
    clearCabinet();
    grid.visible = state.grid;
    const prod = currentProduct();
    const room = currentRoom();
    if (!prod) return;
    cabGroup = new THREE.Group();
    scene.add(cabGroup);
    const doorStyle = room?.doorStyle ?? null;
    const cabCenter = new THREE.Vector3(prod.width / 2, prod.depth / 2, prod.height / 2);

    for (const p of prod.parts) {
      const built = buildMesh(p, doorStyle);
      const ops = addOps(p, built.mesh);
      place(p, built.mesh);
      cabGroup.add(built.mesh);
      const c = new THREE.Box3().setFromObject(built.mesh).getCenter(new THREE.Vector3());
      const dir = c.clone().sub(cabCenter);
      dir.x /= Math.max(prod.width, 1);
      dir.y /= Math.max(prod.depth, 1);
      dir.z /= Math.max(prod.height, 1);
      const t = p.type;
      if (t === "Door" || t === "Drawer") dir.y -= 2.2;
      else if (t === "Metal") dir.y -= 2.8;
      else if (t.startsWith("Drawer")) dir.y -= 1.2;
      else if (t === "Frame") dir.y -= 0.9;
      else if (t === "UBack") dir.y += 1.6;
      else if (t === "Bottom" || t === "Toe" || t === "Sleeper") dir.z -= 1.2;
      else if (t === "Stretcher") dir.z += 0.9;
      else if (t === "AdjustableShelf") dir.z += 0.5;
      else if (t === "FEnd" || t === "UEnd") dir.x += c.x > cabCenter.x ? 1.4 : -1.4;
      dir.multiplyScalar(Math.max(prod.width, prod.height) * 0.46);
      parts.push({
        mesh: built.mesh,
        edges: built.edges,
        extra: built.extra,
        ops,
        part: p,
        home: built.mesh.position.clone(),
        dir,
        group: groupOf(t),
      });
    }
    orbit.target.copy(cabCenter);
    orbit.dist = Math.max(prod.width, prod.height, prod.depth) * 2.7;
    applyCam();
    setExplode(state.explode);
    applyMaterials();
    rebuildDims();
  }

  function setExplode(v: number) {
    for (const pp of parts) pp.mesh.position.copy(pp.home).addScaledVector(pp.dir, v);
    if (state.dims) rebuildDims();
  }

  function applyMaterials() {
    for (const pp of parts) {
      const on = state.chips[pp.group as ChipKey] !== false;
      pp.mesh.visible = on;
      pp.ops.visible = on && state.chips.Machining !== false;
      const set = setFor(pp.part.type);
      const sel = state.selected === pp.part.id;
      const mat = sel
        ? hlMat
        : state.mode === "xray"
          ? set.xray
          : state.mode === "line"
            ? lineFace
            : set.face;
      const pmat = sel ? hlMat : state.mode === "line" ? linePanel : mat;
      pp.mesh.material = mat;
      pp.mesh.renderOrder = state.mode === "xray" ? 1 : 0;
      for (const m of pp.extra) {
        m.material = pmat;
        m.renderOrder = pp.mesh.renderOrder;
      }
    }
    grid.visible = state.grid;
    rebuildDims();
  }

  function makeLabel(text: string): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.font = "600 58px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#12110f";
    const w = ctx.measureText(text).width + 34;
    ctx.fillRect(256 - w / 2, 22, w, 84);
    ctx.fillStyle = "#c8ccd4";
    ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    return spr;
  }

  function dimText(v: number) {
    return unit === "mm" ? v.toFixed(1) : hoverDim(v).split(" ")[0];
  }

  function drawDim(p1: THREE.Vector3, p2: THREE.Vector3, off: THREE.Vector3, scale: number) {
    const a = p1.clone().add(off);
    const b = p2.clone().add(off);
    const geo = new THREE.BufferGeometry().setFromPoints([p1, a, p2, b, a, b]);
    dimGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8ccd4 })));
    const t = off.clone().normalize().multiplyScalar(scale * 0.35);
    const tick = new THREE.BufferGeometry().setFromPoints([
      a.clone().sub(t),
      a.clone().add(t),
      b.clone().sub(t),
      b.clone().add(t),
    ]);
    dimGroup.add(new THREE.LineSegments(tick, new THREE.LineBasicMaterial({ color: 0xc8ccd4 })));
    const label = makeLabel(dimText(p1.distanceTo(p2)));
    label.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(off.clone().normalize().multiplyScalar(scale * 0.9));
    label.scale.set(scale * 3.4, scale * 0.85, 1);
    dimGroup.add(label);
  }

  function rebuildDims() {
    while (dimGroup.children.length) {
      const c = dimGroup.children[0];
      dimGroup.remove(c);
      disposeObject(c);
    }
    if (!state.dims) return;
    const prod = currentProduct();
    if (!prod) return;
    const s = Math.max(prod.width, prod.height) * 0.055;
    const sel = parts.find((p) => p.part.id === state.selected);
    if (sel) {
      const bb = new THREE.Box3().setFromObject(sel.mesh);
      const pad = s * 1.2;
      if (bb.max.x - bb.min.x > 1)
        drawDim(new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z), new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z), new THREE.Vector3(0, -pad, -pad), s);
      if (bb.max.z - bb.min.z > 1)
        drawDim(new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z), new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z), new THREE.Vector3(-pad, -pad, 0), s);
      if (bb.max.y - bb.min.y > 1)
        drawDim(new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z), new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z), new THREE.Vector3(pad, 0, -pad), s);
    } else {
      const pad = s * 1.6;
      drawDim(new THREE.Vector3(0, 0, 0), new THREE.Vector3(prod.width, 0, 0), new THREE.Vector3(0, -pad, -pad), s);
      drawDim(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, prod.height), new THREE.Vector3(-pad, -pad, 0), s);
      drawDim(new THREE.Vector3(prod.width, 0, 0), new THREE.Vector3(prod.width, prod.depth, 0), new THREE.Vector3(pad, 0, -pad), s);
    }
  }

  function pickAt(cx: number, cy: number): PartView | null {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((cx - r.left) / r.width) * 2 - 1;
    mouse.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const objs = parts.filter((p) => p.mesh.visible).map((p) => p.mesh);
    const hits = ray.intersectObjects(objs, true);
    if (!hits.length) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      const found = parts.find((p) => p.mesh === obj);
      if (found) return found;
      obj = obj.parent;
    }
    return null;
  }

  function render() {
    applyCam();
    renderer.render(scene, camera);
  }

  resize();
  applyCam();

  return {
    scene,
    camera,
    renderer,
    parts,
    dispose() {
      clearCabinet();
      renderer.dispose();
      renderer.domElement.remove();
    },
    resize,
    render,
    setExplode,
    applyMaterials,
    rebuildCabinet,
    pick: pickAt,
    hover: pickAt,
    setCam(theta, phi) {
      orbit.theta = theta;
      orbit.phi = phi;
      applyCam();
    },
    orbit,
  };
}

export function partCaption(p: Part): string {
  return `${p.name} · ${p.type}`;
}

export function partDims(p: Part): string {
  return `${hoverDim(p.L)} × ${hoverDim(p.W)} × ${hoverDim(p.thickness)}`;
}

export type { Product };
