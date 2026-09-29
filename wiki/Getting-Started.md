# Getting Started with Mozaik File Viewer

This page is the shop-floor setup guide for **Mozaik File Viewer**, the local-only 3D cabinet job viewer for Mozaik Software jobs.

Back to [[Home]].

## Requirements

- A machine that already has the Mozaik **Jobs** folder (or a copy / zip of it)
- Node.js 18+ to run from source (Vite 6, TypeScript 5)
- A Chromium-based browser for folder picks and recent-job handles
- No Mozaik license seat is required to *view*

## Install and run

```bash
git clone https://github.com/JesseRaber/mozaik-file-viewer.git
cd mozaik-file-viewer
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

Production-style build:

```bash
npm run build
npm run preview
```

## First launch without shop files

1. Click **Load demo cabinet**.
2. Confirm a 24″ face-frame box appears.
3. Drag to orbit, Shift-drag to pan, scroll to zoom.
4. Use **Front / Iso / Back**, **Solid / X-ray / Line**, **Grid**, **Dims**, and the **Explode** slider.
5. Double-click a layer chip (Case, Face frame, …) to isolate it.

If the demo fails, the problem is the local build — not your `.des` files.

## Open a real Mozaik job folder

1. In Mozaik, note the job directory (the folder that holds `Room1.des` / `Room1.sbk`, `*.opt`, and `*-JobParms.dat`).
2. In the viewer click **Open job folder** and select that directory.
3. Or click **Files / zip** and pick individual files or a `.zip`.
4. Or drag the folder / zip onto the stage.
5. Pick **Room**, then **Cabinet**. Use the search box to filter by cabinet name, number, or room.
6. Warnings (encoding, empty rooms, optimizer parse issues) appear in the sidebar. They are not swallowed.

Optional: **Set Jobs folder** so Chromium can remember the root and list **Recent jobs** on the landing card.

## Shop-floor buttons

| Button | Opens |
| --- | --- |
| Face frame sheet | Cut list of frame members with pocket-screw marks and title block |
| Box assembly sheet | Case parts with optimizer labels matched by name and size |
| Construction parameters | Libraries parsed from `*-JobParms.dat` |
| G-code visualizer | Nested-sheet toolpaths; units follow `G20` / `G21` |
| Preferences | Layer colors and title-block fields |

Face-frame sheet is hidden when the selected product has no `Frame` parts.

## Units

Toggle **in** / **mm** in the cabinet row. The choice is stored in `localStorage` key `mfv_unit`.

## Controls

- Drag — orbit
- Shift-drag — pan
- Scroll — zoom
- Click a part row — select
- Double-click a layer chip — isolate / restore
- Eye icon on a group — hide / show that layer

## If a job will not load

- Confirm the folder contains at least one `.des` or `.sbk` with cabinets. The loader throws if no rooms survive parse.
- `.sbk` is skipped when a `.des` of the same base name is present.
- UTF-16 room files are supported (BOM optional). See [[Job-Files]].
- Optimizer and JobParms failures become sidebar warnings; they do not block a room that parsed.

## Next

- [[Job-Files]] — exact extensions and thickness rules
- [[Privacy-and-Security]] — what is stored on the machine
- [[FAQ]]
- [[Home]]
