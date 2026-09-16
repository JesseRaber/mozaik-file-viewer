# Mozaik File Viewer

Local, read-only viewer for Mozaik cabinet job folders. **Independent of Mozaik Software** — not affiliated with, endorsed by, or a product of Mozaik. Job files never leave the machine.

Open a Jobs folder (or drop a `.zip`) and you get:

- **3D cabinet** — orbit, pan, explode, isolate layers, pick parts
- **Face-frame cut sheet** — members, pocket-screw marks, printable title block, thickness on the cut list
- **Box assembly sheet** — optimizer labels matched by name and size, not only `RoomN.des`
- **Construction parameters** from `*-JobParms.dat`
- **G-code nested-sheet preflight** — millimetres, honors `G20` / `G21`

A procedural 24" face-frame demo loads without any shop files.

## Scope

This is a **companion to Mozaik Paperless Shop, not a replacement for it.**

It does not track progress, does not check parts off, does not sync between
tablets, and does not print labels — those are what Paperless Shop is for. This
tool shows you the job and prints sheets from it.

Approved scope, release gate, and current risks: [`PROJECT_ROADMAP_STATUS.md`](PROJECT_ROADMAP_STATUS.md).

> **Pre-release.** No real-job test fixtures exist yet, so parsed thicknesses and
> optimizer label matching are not verified against shipped jobs. Do not rely on
> a printed sheet from this tool without checking it against Mozaik.

## Privacy

Nothing is uploaded. IndexedDB stores File System Access handles on Chromium. localStorage stores unit, title-block, and part-color preferences.

## Files it reads

| File | Role |
| --- | --- |
| `*.des` / `*.sbk` | Room XML (UTF-8 or UTF-16, BOM optional) |
| `*.opt` | Optimizer labels and material thickness |
| `*-JobParms.dat` | Construction parameters |
| `JobDat.dat` | Customer name |
| `*.TXT` / `.nc` / `.gcode` | Nested G-code |

## Thickness

1. XML attributes on the part (`Thickness`, `Thick`, `T`, `MatThick`, …)
2. Matching optimizer material
3. Type defaults (¾" case, ½" back, …)

Shaker door panels are drawn only when the room actually stores door-style rails **and** they leave a real opening. Hardware (`Metal`) is rendered. Part geometry is disposed when you change cabinets.

## Run

Vanilla TypeScript viewer (`src/viewer`) with Three.js and JSZip from npm — no CDN, no React in the viewer.

```
npm install
npm run dev
```

```
npm run typecheck
npm test
npm run build
```

## Not a Mozaik replacement

This tool does not write `.des` files, does not nest, and does not talk to a Mozaik license. It is a shop-floor companion for looking at a job you already have.
