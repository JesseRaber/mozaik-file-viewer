import type { Unit } from "./types";

export let unit: Unit = "in";

export function setUnit(next: Unit) {
  unit = next;
  try {
    localStorage.setItem("mfv_unit", next);
  } catch {
    /* private mode */
  }
}

export function loadUnit(): Unit {
  try {
    const v = localStorage.getItem("mfv_unit");
    if (v === "mm" || v === "in") unit = v;
  } catch {
    /* ignore */
  }
  return unit;
}

export function fmt(v: number, dp?: number): string {
  if (!Number.isFinite(v)) return "—";
  if (unit === "mm") return v.toFixed(dp === undefined ? 1 : dp);
  return (v / 25.4).toFixed(dp === undefined ? 3 : dp);
}

export function unitLabel(): string {
  return unit === "mm" ? "mm" : "in";
}

/** Nearest 1/16" for drawings and hover. */
export function frac(vMm: number): string {
  const inches = vMm / 25.4;
  const whole = Math.floor(inches + 1e-9);
  let n = Math.round((inches - whole) * 16);
  let d = 16;
  if (n === 16) return `${whole + 1}"`;
  while (n && n % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  return n ? `${whole ? `${whole} ` : ""}${n}/${d}"` : `${whole}"`;
}

export function dim(vMm: number): string {
  if (!Number.isFinite(vMm)) return "—";
  if (unit === "mm") return `${vMm.toFixed(1)} mm`;
  return frac(vMm);
}

export function hoverDim(vMm: number): string {
  if (!Number.isFinite(vMm)) return "—";
  if (unit === "mm") return `${vMm.toFixed(1)} mm`;
  return `${(vMm / 25.4).toFixed(3)}" (${frac(vMm)})`;
}
