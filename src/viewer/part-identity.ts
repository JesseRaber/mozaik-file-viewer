import type { Part } from "./types";
import { normName } from "./geom";
export function partRowKey(p: Part): string {
  return JSON.stringify([normName(p.name),p.type,p.L,p.W,p.thickness,p.thicknessSource,
    p.material || "",p.edgeBand || "",p.shape,p.holes,p.grooves,p.hardware]);
}
export function sourceQuantity(p: Part): number {
  if (!Number.isSafeInteger(p.qty) || p.qty < 0) throw new Error("Invalid part quantity");
  return p.qty;
}
