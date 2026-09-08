import { xmlPayload } from "../encoding";
import { defaultThickness, readThicknessAttr } from "../geom";
import type {
  DoorStyle,
  HoleOp,
  GrooveOp,
  LoadWarning,
  Part,
  Product,
  Room,
  Rot,
  ShapePt,
  Wall,
} from "../types";

function num(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function flag(el: Element, name: string): boolean {
  return /^(true|1|yes)$/i.test(el.getAttribute(name) || "");
}

function parseDoorStyle(roomEl: Element): DoorStyle | null {
  const ds =
    roomEl.querySelector("RoomSet > NonColumnBaseDoorSettings") ||
    roomEl.querySelector("NonColumnBaseDoorSettings") ||
    roomEl.querySelector("DoorSettings");
  if (!ds) return null;
  const top = num(ds, "TopRail");
  const bot = num(ds, "BottomRail");
  const stile = num(ds, "Stiles") || num(ds, "Stile");
  const recess = num(ds, "PanelRecess");
  if (top <= 0 && bot <= 0 && stile <= 0) return null;
  return { top, bot, stile, recess };
}

function parseShape(cp: Element, L: number, W: number): ShapePt[] {
  const pts: ShapePt[] = [];
  cp.querySelectorAll(":scope > PartShapeXml > ShapePoint, :scope > ShapePoint").forEach((sp) => {
    pts.push({
      x: num(sp, "X"),
      y: num(sp, "Y"),
      type: num(sp, "PtType"),
      data: num(sp, "Data"),
    });
  });
  if (pts.length < 3) {
    return [
      { x: 0, y: 0, type: 0, data: 0 },
      { x: L, y: 0, type: 0, data: 0 },
      { x: L, y: W, type: 0, data: 0 },
      { x: 0, y: W, type: 0, data: 0 },
    ];
  }
  return pts;
}

function axisOf(v: string | null): Rot["axis"] {
  const a = (v || "Z").toUpperCase();
  if (a === "X" || a === "Y" || a === "Z") return a;
  return "Z";
}

export function parseDes(text: string, fname: string): { room: Room | null; warning?: LoadWarning } {
  const payload = xmlPayload(text);
  if (!payload) {
    return { room: null, warning: { file: fname, message: "No XML payload (check encoding)" } };
  }
  const doc = new DOMParser().parseFromString(payload, "text/xml");
  if (doc.querySelector("parsererror")) {
    return { room: null, warning: { file: fname, message: "XML parse error" } };
  }
  const roomEl = doc.querySelector("Room");
  if (!roomEl) return { room: null, warning: { file: fname, message: "No <Room> element" } };

  const walls: Wall[] = [];
  roomEl.querySelectorAll("Walls > Wall").forEach((w) => {
    walls.push({
      len: num(w, "Len"),
      height: num(w, "Height"),
      x: num(w, "PosX"),
      y: num(w, "PosY"),
      ang: num(w, "Ang"),
      thickness: num(w, "Thickness", 101.6),
    });
  });

  const products: Product[] = [];
  roomEl.querySelectorAll("Products > Product").forEach((pEl) => {
    const prod: Product = {
      name: pEl.getAttribute("ProdName") || "Product",
      cabNo: pEl.getAttribute("CabNo") || "",
      width: num(pEl, "Width"),
      height: num(pEl, "Height"),
      depth: num(pEl, "Depth"),
      wall: pEl.getAttribute("Wall") || "",
      wallX: num(pEl, "X"),
      elev: num(pEl, "Elev"),
      sourceLib: pEl.getAttribute("SourceLib") || "",
      desc: pEl.getAttribute("ProductDesc") || "",
      fasteners: [...pEl.querySelectorAll(":scope > JointFastenerCounts > JointFastenerCount")].map(
        (f) => ({
          name: f.getAttribute("Name") || "Fastener",
          count: num(f, "Count"),
        }),
      ),
      parts: [],
    };
    let idx = 0;
    pEl.querySelectorAll(":scope > CabProdParts > CabProdPart").forEach((cp) => {
      const L = num(cp, "L");
      const W = num(cp, "W");
      const type = cp.getAttribute("Type") || "Unknown";
      const xmlTh = readThicknessAttr(cp);
      const thickness = xmlTh ?? defaultThickness(type);
      const holes: HoleOp[] = [];
      cp.querySelectorAll("OperationHole").forEach((h) => {
        holes.push({
          x: num(h, "X"),
          y: num(h, "Y"),
          dia: num(h, "Diameter"),
          depth: num(h, "Depth"),
          flip: flag(h, "FlipSideOp"),
        });
      });
      const grooves: GrooveOp[] = [];
      cp.querySelectorAll("OperationGroove").forEach((gr) => {
        grooves.push({
          x: num(gr, "X"),
          y: num(gr, "Y"),
          w: num(gr, "Width"),
          len: num(gr, "Len"),
          ang: num(gr, "Ang"),
          depth: num(gr, "Depth"),
          flip: flag(gr, "FlipSideOp"),
        });
      });
      const part: Part = {
        id: idx++,
        name: cp.getAttribute("Name") || `Part ${idx}`,
        type,
        layer: num(cp, "Layer"),
        qty: num(cp, "Quan", 1),
        W,
        L,
        thickness,
        thicknessSource: xmlTh != null ? "xml" : "default",
        pos: [num(cp, "X"), num(cp, "Y"), num(cp, "Z")],
        rot: [
          { axis: axisOf(cp.getAttribute("R1")), deg: num(cp, "A1") },
          { axis: axisOf(cp.getAttribute("R2")), deg: num(cp, "A2") },
          { axis: axisOf(cp.getAttribute("R3")), deg: num(cp, "A3") },
        ],
        shape: parseShape(cp, L, W),
        holes,
        grooves,
        hardware: type === "Metal" ? cp.getAttribute("SUPartName") || "" : "",
        material: cp.getAttribute("Material") || cp.getAttribute("MatName") || undefined,
      };
      prod.parts.push(part);
    });
    products.push(prod);
  });

  if (!products.length) {
    return { room: null, warning: { file: fname, message: "Room has no products" } };
  }

  const room: Room = {
    name: roomEl.getAttribute("Name") || fname,
    file: fname,
    walls,
    products,
    doorStyle: parseDoorStyle(roomEl),
  };
  return { room };
}
