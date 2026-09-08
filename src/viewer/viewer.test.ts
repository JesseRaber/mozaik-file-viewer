import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoJob } from "./demo.ts";
import { decodeBytes, xmlPayload } from "./encoding.ts";
import { partAABB, shakerOpening } from "./geom.ts";
import { parseGcode } from "./parse/gcode.ts";

test("demo cabinet occupies a 24×24×34.5 envelope plus front frame", () => {
  const job = buildDemoJob();
  const prod = job.rooms[0].products[0];
  const mn = [1e9, 1e9, 1e9];
  const mx = [-1e9, -1e9, -1e9];
  const byName: Record<string, ReturnType<typeof partAABB>> = {};
  for (const p of prod.parts) {
    const bb = partAABB(p);
    byName[p.name] = bb;
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i], bb.mn[i]);
      mx[i] = Math.max(mx[i], bb.mx[i]);
    }
  }
  const { width: W, height: H, depth: D } = prod;
  assert.ok(mn[0] > -40 && mx[0] < W + 40, `X ${mn[0].toFixed(1)}..${mx[0].toFixed(1)} vs W ${W}`);
  assert.ok(mn[1] > -80 && mx[1] < D + 40, `Y ${mn[1].toFixed(1)}..${mx[1].toFixed(1)} vs D ${D}`);
  assert.ok(mn[2] > -20 && mx[2] < H + 40, `Z ${mn[2].toFixed(1)}..${mx[2].toFixed(1)} vs H ${H}`);
  assert.ok(mx[0] - mn[0] > W * 0.9, "width span");
  assert.ok(mx[2] - mn[2] > H * 0.9, "height span");
  assert.ok(mx[1] - mn[1] > D * 0.9, "depth span");

  const left = byName.FEnd;
  assert.ok(left.mn[0] < 5 && left.mx[0] < 30, "left end at X≈0");
  assert.ok(left.mx[2] - left.mn[2] > H * 0.9, "left end stands up");

  const right = byName.UEnd;
  assert.ok(right.mx[0] > W - 5 && right.mn[0] > W - 30, "right end at X≈W");

  const bot = byName.Bottom;
  assert.ok(bot.mx[2] < 30, "bottom stays near Z=0");
  assert.ok(bot.mx[1] - bot.mn[1] > D * 0.8, "bottom spans depth");

  const bk = byName.UBack;
  assert.ok(bk.mn[1] > D - 30, "back near Y=D");

  const door = byName["Door(L)"];
  const doorDx = door.mx[0] - door.mn[0];
  const doorDz = door.mx[2] - door.mn[2];
  assert.ok(doorDz > doorDx, `left door is taller than wide (${doorDz.toFixed(0)} vs ${doorDx.toFixed(0)})`);
  assert.ok(door.mx[1] < 5, "doors sit on the front");
});

test("shaker opening only when rails leave a real panel", () => {
  const job = buildDemoJob();
  const door = job.rooms[0].products[0].parts.find((p) => p.type === "Door")!;
  assert.equal(shakerOpening(door, null), null);
  const open = shakerOpening(door, job.rooms[0].doorStyle);
  assert.ok(open && open.w > 20 && open.h > 20);
  const drawer = job.rooms[0].products[0].parts.find((p) => p.type === "Drawer")!;
  assert.equal(shakerOpening(drawer, job.rooms[0].doorStyle), null);
  assert.equal(
    shakerOpening(door, { top: 2, bot: 2, stile: 2, recess: 8 }),
    null,
  );
});

test("decodeBytes sniffs UTF-16LE without BOM", () => {
  const le = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x52, 0x00]);
  assert.equal(decodeBytes(le.buffer), "<R");
  const raw = new Uint8Array(80);
  for (let i = 0; i < 40; i++) {
    raw[i * 2] = 65;
    raw[i * 2 + 1] = 0;
  }
  const s = decodeBytes(raw.buffer);
  assert.ok(s.startsWith("A"));
  assert.equal(xmlPayload("garbage <?xml version='1.0'?><Room/>"), "<?xml version='1.0'?><Room/>");
});

test("G-code parser honors G20 inches and G21 millimetres", () => {
  const inch = parseGcode("G20 G90\nG0 X1 Y1 Z0.6\nG1 Z-0.4 F80\nG1 X2\nM30\n", "a.TXT");
  assert.equal(inch.unit, "in");
  const cut = inch.episodes[0];
  assert.ok(cut, "inch cut episode");
  const xs = cut.pts.map((p) => p[0]);
  assert.ok(xs.some((x) => Math.abs(x - 25.4) < 0.2), `inch X scaled, got ${xs.join(",")}`);

  const mm = parseGcode("G21 G90\nG0 X10 Y10 Z15\nG1 Z-8 F800\nG1 X80\nM30\n", "b.nc");
  assert.equal(mm.unit, "mm");
  const mmCut = mm.episodes[0];
  assert.ok(mmCut, "mm cut episode");
  const mxs = mmCut.pts.map((p) => p[0]);
  assert.ok(mxs.some((x) => Math.abs(x - 80) < 0.2), `mm X unscaled, got ${mxs.join(",")}`);
});
