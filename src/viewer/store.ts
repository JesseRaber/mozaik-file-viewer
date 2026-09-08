import type {
  ChipKey,
  ColorPrefs,
  Job,
  RenderMode,
  TitleBlock,
  Unit,
} from "./types";
import { loadUnit, setUnit, unit } from "./units";

export type Overlay = "none" | "ff" | "asm" | "parms" | "gcode" | "pref" | "room";

type Listener = () => void;

export type AppState = {
  job: Job | null;
  roomIndex: number;
  cabIndex: number;
  explode: number;
  mode: RenderMode;
  selected: number | null;
  chips: Record<ChipKey, boolean>;
  overlay: Overlay;
  query: string;
  title: TitleBlock;
  colors: ColorPrefs;
  grid: boolean;
  dims: boolean;
};

const DEFAULT_CHIPS: Record<ChipKey, boolean> = {
  Case: true,
  "Face frame": true,
  "Doors & fronts": true,
  "Drawer boxes": true,
  Shelves: true,
  Hardware: true,
  Machining: true,
};

const DEFAULT_TITLE: TitleBlock = {
  company: "",
  drawn: "",
  job: "",
  customer: "",
  rev: "",
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export const state: AppState = {
  job: null,
  roomIndex: 0,
  cabIndex: 0,
  explode: 0,
  mode: "solid",
  selected: null,
  chips: { ...DEFAULT_CHIPS },
  overlay: "none",
  query: "",
  title: loadJson("mfv_title", DEFAULT_TITLE),
  colors: loadJson("mfv_colors", {}),
  grid: false,
  dims: false,
};

const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn();
}

export function saveTitle() {
  try {
    localStorage.setItem("mfv_title", JSON.stringify(state.title));
  } catch {
    /* ignore */
  }
}

export function saveColors() {
  try {
    localStorage.setItem("mfv_colors", JSON.stringify(state.colors));
  } catch {
    /* ignore */
  }
}

export function setJob(job: Job | null) {
  state.job = job;
  state.roomIndex = 0;
  state.cabIndex = 0;
  state.selected = null;
  state.explode = 0;
  state.chips = { ...DEFAULT_CHIPS };
  if (job) {
    if (!state.title.job) state.title.job = job.jobName;
    if (!state.title.customer) state.title.customer = job.customer;
    saveTitle();
  }
  emit();
}

export function currentRoom() {
  return state.job?.rooms[state.roomIndex] ?? null;
}

export function currentProduct() {
  const room = currentRoom();
  return room?.products[state.cabIndex] ?? null;
}

export function initPrefs() {
  loadUnit();
}

export function toggleUnit(): Unit {
  setUnit(unit === "in" ? "mm" : "in");
  emit();
  return unit;
}

export { unit };
