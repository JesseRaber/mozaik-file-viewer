import type { Job, Part, Product, Room, Rot } from "./types";

const MM = (inch: number) => inch * 25.4;

function part(
  p: Omit<Part, "id" | "qty" | "layer" | "holes" | "grooves" | "hardware" | "thicknessSource"> &
    Partial<Part>,
): Part {
  return {
    id: 0,
    qty: 1,
    layer: 0,
    holes: [],
    grooves: [],
    hardware: "",
    thicknessSource: "xml",
    ...p,
  };
}

function rect(L: number, W: number) {
  return [
    { x: 0, y: 0, type: 0, data: 0 },
    { x: L, y: 0, type: 0, data: 0 },
    { x: L, y: W, type: 0, data: 0 },
    { x: 0, y: W, type: 0, data: 0 },
  ];
}

/**
 * Local blank: X = L, Y = W, Z = thickness.
 * World: X = cabinet width, Y = depth (back +), Z = up.
 *
 * rotY(-90) stands an end: L → +Z, W stays +Y, thickness → −X.
 * rotX(90) stands a front/back: L stays +X, W → +Z, thickness → −Y.
 * rotZ(90)+rotX(90) stands a height-along-L door: L → +Z, W → −X, thickness → −Y.
 */
const rotY = (deg: number): Rot[] => [{ axis: "Y", deg }];
const rotX = (deg: number): Rot[] => [{ axis: "X", deg }];
const faceFromHeightBlank = (): Rot[] => [
  { axis: "Z", deg: 90 },
  { axis: "X", deg: 90 },
];

/** Procedural 24" face-frame base — generated in code, not copied from a shop job. */
export function buildDemoJob(): Job {
  const W = MM(24);
  const H = MM(34.5);
  const D = MM(24);
  const T = MM(0.75);
  const TB = MM(0.5);
  const rail = MM(2.5);
  const stile = MM(2.5);
  const drawerOpen = MM(6);
  const gap = 2;

  const holesOn = (xs: number[], ys: number[], dia = 5, depth = 12) =>
    xs.flatMap((x) => ys.map((y) => ({ x, y, dia, depth, flip: false })));

  const left: Part = part({
    name: "FEnd",
    type: "FEnd",
    L: H,
    W: D,
    thickness: T,
    pos: [T, 0, 0],
    rot: rotY(-90),
    shape: rect(H, D),
    grooves: [
      { x: T, y: T / 2, w: T + 0.4, len: D - T, ang: 90, depth: 6, flip: false },
      { x: H - T, y: T / 2, w: T + 0.4, len: D - T, ang: 90, depth: 6, flip: false },
    ],
    holes: holesOn([H * 0.28, H * 0.5, H * 0.72], [MM(2), D - MM(2)]),
  });

  const right: Part = part({
    name: "UEnd",
    type: "UEnd",
    L: H,
    W: D,
    thickness: T,
    pos: [W, 0, 0],
    rot: rotY(-90),
    shape: rect(H, D),
    grooves: [
      { x: T, y: T / 2, w: T + 0.4, len: D - T, ang: 90, depth: 6, flip: true },
      { x: H - T, y: T / 2, w: T + 0.4, len: D - T, ang: 90, depth: 6, flip: true },
    ],
    holes: holesOn([H * 0.28, H * 0.5, H * 0.72], [MM(2), D - MM(2)]),
  });

  const bottom: Part = part({
    name: "Bottom",
    type: "Bottom",
    L: W - 2 * T,
    W: D,
    thickness: T,
    pos: [T, 0, 0],
    rot: [],
    shape: rect(W - 2 * T, D),
    holes: holesOn([MM(2), W - 2 * T - MM(2)], [MM(2), D - MM(2)]),
  });

  const back: Part = part({
    name: "UBack",
    type: "UBack",
    L: W - 2 * T,
    W: H - T,
    thickness: TB,
    pos: [T, D, T],
    rot: rotX(90),
    shape: rect(W - 2 * T, H - T),
  });

  const stretch: Part = part({
    name: "Stretcher",
    type: "Stretcher",
    L: W - 2 * T,
    W: MM(4),
    thickness: T,
    pos: [T, 0, H - T],
    rot: [],
    shape: rect(W - 2 * T, MM(4)),
  });

  const shelf: Part = part({
    name: "AdjustableShelf",
    type: "AdjustableShelf",
    L: W - 2 * T - 2,
    W: D - TB - MM(1),
    thickness: T,
    pos: [T + 1, MM(0.5), MM(18)],
    rot: [],
    shape: rect(W - 2 * T - 2, D - TB - MM(1)),
  });

  const topRail: Part = part({
    name: "Top rail",
    type: "Frame",
    L: W,
    W: rail,
    thickness: T,
    pos: [0, 0, H - rail],
    rot: rotX(90),
    shape: rect(W, rail),
  });
  const botRail: Part = part({
    name: "Bottom rail",
    type: "Frame",
    L: W,
    W: rail,
    thickness: T,
    pos: [0, 0, 0],
    rot: rotX(90),
    shape: rect(W, rail),
  });
  const midZ0 = H - rail - drawerOpen - rail;
  const midRail: Part = part({
    name: "Drawer rail",
    type: "Frame",
    L: W,
    W: rail,
    thickness: T,
    pos: [0, 0, midZ0],
    rot: rotX(90),
    shape: rect(W, rail),
  });
  const leftStile: Part = part({
    name: "Left stile",
    type: "Frame",
    L: stile,
    W: H - 2 * rail,
    thickness: T,
    pos: [0, 0, rail],
    rot: rotX(90),
    shape: rect(stile, H - 2 * rail),
  });
  const rightStile: Part = part({
    name: "Right stile",
    type: "Frame",
    L: stile,
    W: H - 2 * rail,
    thickness: T,
    pos: [W - stile, 0, rail],
    rot: rotX(90),
    shape: rect(stile, H - 2 * rail),
  });
  const midStile: Part = part({
    name: "Mullion",
    type: "Frame",
    L: stile,
    W: midZ0 - rail,
    thickness: T,
    pos: [W / 2 - stile / 2, 0, rail],
    rot: rotX(90),
    shape: rect(stile, midZ0 - rail),
  });

  const doorH = midZ0 - rail - 2 * gap;
  const doorW = (W - 3 * stile) / 2 - 2 * gap;
  const doorL: Part = part({
    name: "Door(L)",
    type: "Door",
    L: doorH,
    W: doorW,
    thickness: T,
    pos: [stile + gap + doorW, -T - 2, rail + gap],
    rot: faceFromHeightBlank(),
    shape: rect(doorH, doorW),
  });
  const doorR: Part = part({
    name: "Door(R)",
    type: "Door",
    L: doorH,
    W: doorW,
    thickness: T,
    pos: [W / 2 + stile / 2 + gap + doorW, -T - 2, rail + gap],
    rot: faceFromHeightBlank(),
    shape: rect(doorH, doorW),
  });

  const dFrontW = W - 2 * stile - 2 * gap;
  const dFrontH = drawerOpen - 2 * gap;
  const dwFront: Part = part({
    name: "Drawer",
    type: "Drawer",
    L: dFrontH,
    W: dFrontW,
    thickness: T,
    pos: [stile + gap + dFrontW, -T - 2, midZ0 + rail + gap],
    rot: faceFromHeightBlank(),
    shape: rect(dFrontH, dFrontW),
  });

  const dW = MM(21);
  const dH = MM(5);
  const dD = MM(20);
  const dT = MM(0.5);
  const boxX = (W - dW) / 2;
  const boxY = MM(0.75);
  const boxZ = midZ0 + rail + gap;

  const dwSideL: Part = part({
    name: "DrawerSide",
    type: "DrawerSide",
    L: dH,
    W: dD,
    thickness: dT,
    pos: [boxX + dT, boxY, boxZ],
    rot: rotY(-90),
    shape: rect(dH, dD),
  });
  const dwSideR: Part = part({
    name: "DrawerSide",
    type: "DrawerSide",
    L: dH,
    W: dD,
    thickness: dT,
    pos: [boxX + dW, boxY, boxZ],
    rot: rotY(-90),
    shape: rect(dH, dD),
  });
  const dwBack: Part = part({
    name: "DrawerBack",
    type: "DrawerBack",
    L: dW - 2 * dT,
    W: dH,
    thickness: dT,
    pos: [boxX + dT, boxY + dD, boxZ],
    rot: rotX(90),
    shape: rect(dW - 2 * dT, dH),
  });
  const dwBot: Part = part({
    name: "DrawerBottom",
    type: "DrawerBottom",
    L: dW - 2 * dT,
    W: dD - dT,
    thickness: MM(0.25),
    pos: [boxX + dT, boxY, boxZ],
    rot: [],
    shape: rect(dW - 2 * dT, dD - dT),
  });

  const knob = (x: number, z: number): Part =>
    part({
      name: "Knob",
      type: "Metal",
      L: 32,
      W: 32,
      thickness: 22,
      pos: [x - 16, -T - 2, z - 16],
      rot: rotX(90),
      shape: rect(32, 32),
      hardware: "Knob",
    });

  const leftDoorInnerX = stile + gap + doorW;
  const rightDoorInnerX = W / 2 + stile / 2 + gap;
  const doorPullZ = rail + gap + doorH * 0.5;

  const parts = [
    left,
    right,
    bottom,
    back,
    stretch,
    shelf,
    topRail,
    botRail,
    midRail,
    leftStile,
    rightStile,
    midStile,
    doorL,
    doorR,
    dwFront,
    dwSideL,
    dwSideR,
    dwBack,
    dwBot,
    knob(leftDoorInnerX - MM(1.25), doorPullZ),
    knob(rightDoorInnerX + MM(1.25), doorPullZ),
  ];
  parts.forEach((p, i) => {
    p.id = i;
  });

  const product: Product = {
    name: "Base 24",
    cabNo: "1",
    width: W,
    height: H,
    depth: D,
    wall: "1",
    wallX: 0,
    elev: 0,
    sourceLib: "Demo Face Frame",
    desc: "Procedural demo cabinet",
    fasteners: [{ name: "Confirmat", count: 18 }],
    parts,
  };

  const room: Room = {
    name: "Kitchen",
    file: "Kitchen.des",
    walls: [
      { len: MM(96), height: MM(96), x: 0, y: D + MM(4), ang: 0, thickness: MM(4.5) },
      { len: MM(48), height: MM(96), x: 0, y: D + MM(4), ang: 90, thickness: MM(4.5) },
    ],
    products: [product],
    doorStyle: { top: rail, bot: rail, stile, recess: MM(5 / 16) },
  };

  const gcode = `( Mozaik Output for Mach3 in Inch)
( Demo sheet S01R01.TXT )
( Material Size)
( X= 48.5, Y= 96.5)
G20 G90
T1 M6
( 3/8 compression )
G0 Z0.6
G0 X2 Y2
G1 Z-0.4 F80
G1 X14 F180
G1 Y16
G1 X2
G1 Y2
G0 Z0.6
T2 M6
( 5mm drill )
G0 X6 Y6
G1 Z-0.5 F40
G0 Z0.6
G0 X10 Y6
G1 Z-0.5 F40
G0 Z0.6
M30
`;

  return {
    jobName: "Demo shop job",
    customer: "Walk-in",
    rooms: [room],
    runs: {
      "1": {
        runId: 1,
        materials: [
          {
            name: "3/4 Maple Plywood",
            thickness: T,
            parts: [
              { id: 12, name: "FEnd", L: H, W: D, assy: "KITCHEN-C1" },
              { id: 13, name: "UEnd", L: H, W: D, assy: "KITCHEN-C1" },
              { id: 14, name: "Bottom", L: W - 2 * T, W: D, assy: "KITCHEN-C1" },
              { id: 15, name: "Stretcher", L: W - 2 * T, W: MM(4), assy: "KITCHEN-C1" },
              { id: 16, name: "AdjustableShelf", L: W - 2 * T - 2, W: D - TB - MM(1), assy: "KITCHEN-C1" },
            ],
          },
          {
            name: "1/2 Maple Plywood",
            thickness: TB,
            parts: [{ id: 21, name: "UBack", L: W - 2 * T, W: H - T, assy: "KITCHEN-C1" }],
          },
        ],
      },
    },
    cncFiles: [
      {
        path: "Demo 3-4 Maple S01R01.TXT",
        name: "Demo 3-4 Maple S01R01.TXT",
        text: async () => gcode,
      },
    ],
    parms: [
      {
        lib: "Demo Face Frame",
        tmpl: "Demo Face Frame",
        cats: ["Doors", "Dados", "Fasteners"],
        params: [
          { code: "DoorOL", desc: "Frame Door Overlay (Sides)", val: "12.7", type: 0, cat: 1, opts: null },
          { code: "DadoD", desc: "Dado Depth", val: "6.35", type: 0, cat: 2, opts: null },
          { code: "UseConf", desc: "Use Confirmat Screws", val: "1", type: 1, cat: 3, opts: null },
          { code: "BackT", desc: "Unfinished Back Thickness", val: "12.7", type: 0, cat: 2, opts: null },
        ],
      },
    ],
    warnings: [],
    source: "demo",
  };
}
