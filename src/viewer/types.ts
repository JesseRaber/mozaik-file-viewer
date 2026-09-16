export type Axis = "X" | "Y" | "Z";

export type ShapePt = {
  x: number;
  y: number;
  type: number;
  data: number;
};

export type HoleOp = {
  x: number;
  y: number;
  dia: number;
  depth: number;
  flip: boolean;
};

export type GrooveOp = {
  x: number;
  y: number;
  w: number;
  len: number;
  ang: number;
  depth: number;
  flip: boolean;
};

export type Rot = { axis: Axis; deg: number };

export type Part = {
  id: number;
  name: string;
  type: string;
  layer: number;
  qty: number;
  W: number;
  L: number;
  thickness: number;
  thicknessSource: "xml" | "optimizer" | "default" | "paperless";
  pos: [number, number, number];
  rot: Rot[];
  shape: ShapePt[];
  holes: HoleOp[];
  grooves: GrooveOp[];
  hardware: string;
  material?: string;
  /** Edge-band name from a Paperless Shop export, when one was loaded. */
  edgeBand?: string;
  /** Optimizer label number from a Paperless Shop export, when one was loaded. */
  labelNo?: number;
};

export type Fastener = { name: string; count: number };

export type DoorStyle = {
  top: number;
  bot: number;
  stile: number;
  recess: number;
};

export type Wall = {
  len: number;
  height: number;
  x: number;
  y: number;
  ang: number;
  thickness: number;
};

export type Product = {
  name: string;
  cabNo: string;
  width: number;
  height: number;
  depth: number;
  wall: string;
  wallX: number;
  elev: number;
  sourceLib: string;
  desc: string;
  fasteners: Fastener[];
  parts: Part[];
};

export type Room = {
  name: string;
  file: string;
  walls: Wall[];
  products: Product[];
  doorStyle: DoorStyle | null;
};

export type OptPart = {
  id: number;
  name: string;
  L: number;
  W: number;
  assy: string;
};

export type OptMaterial = {
  name: string;
  thickness: number;
  parts: OptPart[];
};

export type OptRun = {
  runId: number;
  materials: OptMaterial[];
};

/** One nested part as stated by a Mozaik "export to apps" LabelData file. */
export type PaperlessPart = {
  name: string;
  L: number;
  W: number;
  assy: string;
  cabName: string;
  roomName: string;
  material: string;
  thickness: number;
  edgeBand: string;
  partNo: number;
  shorthand: string;
  comment: string;
  sheetId: number;
  patternNum: number;
  x: number;
  y: number;
  rot: number;
  gcodeFile: string;
};

export type PaperlessData = {
  file: string;
  jobName: string;
  runName: string;
  /** Paperless Shop exports are built for one named tablet. */
  device: string;
  generator: string;
  inches: boolean;
  materials: Array<{ name: string; abbr: string; thickness: number }>;
  parts: PaperlessPart[];
  remnants: number;
};

export type CncFile = {
  path: string;
  name: string;
  text: () => Promise<string>;
};

export type Parm = {
  code: string;
  desc: string;
  val: string;
  type: number;
  cat: number;
  opts: string[] | null;
};

export type ParmLib = {
  lib: string;
  tmpl: string;
  cats: string[];
  params: Parm[];
};

export type LoadWarning = { file: string; message: string };

export type Job = {
  jobName: string;
  customer: string;
  rooms: Room[];
  runs: Record<string, OptRun>;
  cncFiles: CncFile[];
  parms: ParmLib[];
  warnings: LoadWarning[];
  source: "demo" | "files";
  /** Present when a Mozaik "export to apps" file was loaded alongside the job. */
  paperless?: PaperlessData;
  /** How many parts the Paperless Shop overlay matched. */
  paperlessMatched?: number;
};

export type FileItem = {
  path: string;
  name: string;
  text: () => Promise<string>;
  raw: () => Promise<ArrayBuffer>;
};

export type ChipKey =
  | "Case"
  | "Face frame"
  | "Doors & fronts"
  | "Drawer boxes"
  | "Shelves"
  | "Hardware"
  | "Machining";

export type RenderMode = "solid" | "xray" | "line";
export type Unit = "in" | "mm";

export type TitleBlock = {
  company: string;
  drawn: string;
  job: string;
  customer: string;
  rev: string;
};

export type ColorPrefs = Record<string, string>;
