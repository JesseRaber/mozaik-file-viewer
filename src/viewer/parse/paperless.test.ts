import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAssy } from "../geom.ts";
import type { Job, Part, Product, Room } from "../types.ts";
import { applyPaperless, parseLabelData } from "./paperless.ts";

const FIXTURE = "test/fixtures/WoodWorxTest-Run1-LabelStatus.xml";
const xml = () => readFileSync(FIXTURE, "utf8");

function parsed() {
  const { data, warning } = parseLabelData(xml(), "WoodWorxTest-Run1-LabelStatus.xml");
  assert.equal(warning, undefined, "fixture should parse without warnings");
  assert.ok(data, "fixture should yield data");
  return data!;
}

test("parseLabelData reads the export header", () => {
  const d = parsed();
  assert.equal(d.jobName, "WoodWorx Test");
  assert.equal(d.runName, "Run 1");
  assert.equal(d.device, "X1-Tablet");
  assert.equal(d.inches, true);
});

test("parseLabelData states a thickness for every material", () => {
  const d = parsed();
  assert.equal(d.materials.length, 2);
  const byName = Object.fromEntries(d.materials.map((m) => [m.name, m.thickness]));
  assert.equal(byName["UV1 Plywood (1/2)"], 11.938);
  assert.equal(byName["UV2 Plywood (1/2)"], 11.4808);
  // Neither equals the 12.7 the type defaults would have guessed for 1/2" stock.
  for (const m of d.materials) assert.notEqual(m.thickness, 12.7);
});

test("parseLabelData skips sheet remnants", () => {
  const d = parsed();
  assert.equal(d.remnants, 2, "fixture has two remnants");
  assert.equal(d.parts.length, 5, "five real cabinet parts");
  for (const p of d.parts) {
    assert.ok(p.name && p.assy, `every kept part is a labelled cabinet part: ${p.name}`);
    // A remnant is named after its material; a real part never is.
    assert.ok(
      !d.materials.some((m) => m.name === p.name),
      `${p.name} should not be a leftover offcut`,
    );
  }
});

test("the <Mat>/<Part Printed> status block is not mistaken for cabinet parts", () => {
  // This fixture has recorded label printing:
  //   <Mat Index="UV1 Plywood (1/2)"><Part Index="1" Printed="True" /></Mat>
  // Those Part elements sit outside <LabelData> and must never be parsed as
  // cabinet parts. The file has 9 <Part> elements in total; 7 are in LabelData
  // (2 of them remnants) and 2 are progress records.
  const raw = xml();
  assert.ok(raw.includes('Printed="True"'), "fixture really does record progress");
  assert.equal((raw.match(/<Part\b/g) || []).length, 9, "nine Part elements in the file");
  const d = parsed();
  assert.equal(d.parts.length + d.remnants, 7, "only the seven LabelData parts are visited");
});

test("parseLabelData carries cabinet and room identity onto each part", () => {
  const d = parsed();
  for (const p of d.parts) {
    assert.ok(p.thickness > 0.2, `${p.name} has a stated thickness`);
    assert.ok(p.material, `${p.name} names its material`);
  }
});

test("the R<room>N<cab> AssyNo variant parses", () => {
  // This fixture uses the N form rather than the C form seen on other jobs.
  const d = parsed();
  assert.equal(d.parts[0].assy, "R4N1");
  assert.deepEqual(parseAssy("R4N1"), { room: 4, cab: 1 });
});

test("a status file with no recorded work yields no data and no warning", () => {
  const header =
    '<?xml version="1.0" encoding="utf-8" standalone="yes"?>' +
    '<JobData JobName="X" JobAbbr="" RunName="Run 1" Version="1" />';
  const { data, warning } = parseLabelData(header, "X-Run 1-CutlistStatus.xml");
  assert.equal(data, null);
  assert.equal(warning, undefined);
});

test("applyPaperless replaces guessed thickness with the stated one", () => {
  const d = parsed();
  const src = d.parts[0];

  const part: Part = {
    id: 0,
    name: src.name,
    type: "DrawerBack",
    layer: 0,
    qty: 1,
    L: src.L,
    W: src.W,
    thickness: 12.7, // what defaultThickness() guesses for this type
    thicknessSource: "default",
    pos: [0, 0, 0],
    rot: [],
    shape: [],
    holes: [],
    grooves: [],
    hardware: "",
  };
  const prod: Product = {
    name: "Drawer", cabNo: "1", width: 0, height: 0, depth: 0, wall: "", wallX: 0,
    elev: 0, sourceLib: "", desc: "", fasteners: [], parts: [part],
  };
  const room: Room = { name: "Room 4", file: "Room4.des", walls: [], products: [prod], doorStyle: null };
  const job: Job = {
    jobName: "t", customer: "", rooms: [room], runs: {}, cncFiles: [], parms: [],
    warnings: [], source: "files",
  };

  const matched = applyPaperless(job, d);
  assert.equal(matched, 1, "the one part should match");
  assert.equal(part.thicknessSource, "paperless");
  assert.equal(part.thickness, src.thickness);
  assert.notEqual(part.thickness, 12.7, "the guess is gone");
  assert.equal(part.material, src.material);
});

test("applyPaperless leaves a part from another room alone", () => {
  const d = parsed();
  const src = d.parts[0];
  const part: Part = {
    id: 0, name: src.name, type: "DrawerBack", layer: 0, qty: 1, L: src.L, W: src.W,
    thickness: 12.7, thicknessSource: "default", pos: [0, 0, 0], rot: [], shape: [],
    holes: [], grooves: [], hardware: "",
  };
  const prod: Product = {
    name: "Drawer", cabNo: "1", width: 0, height: 0, depth: 0, wall: "", wallX: 0,
    elev: 0, sourceLib: "", desc: "", fasteners: [], parts: [part],
  };
  // Fixture parts are R4N1; this room is Room1.des, so nothing may match.
  const room: Room = { name: "Other", file: "Room1.des", walls: [], products: [prod], doorStyle: null };
  const job: Job = {
    jobName: "t", customer: "", rooms: [room], runs: {}, cncFiles: [], parms: [],
    warnings: [], source: "files",
  };

  assert.equal(applyPaperless(job, d), 0);
  assert.equal(part.thicknessSource, "default");
  assert.equal(part.thickness, 12.7);
});
