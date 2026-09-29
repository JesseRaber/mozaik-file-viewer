# Mozaik File Viewer

**Mozaik File Viewer** is a **local-only 3D cabinet job viewer** for custom cabinet shops that use [Mozaik Software](https://www.mozaiksoftware.com/). Open a Mozaik **Jobs folder** (or drop a `.zip`) in the browser and inspect the job on the shop floor: 3D cabinets, face-frame cut sheets, box assembly sheets, construction parameters, and nested G-code preflight.

Job files are parsed in the browser. **They never leave the machine.** Nothing is uploaded. Nothing is written back to `.des` files.

- Repository: [JesseRaber/mozaik-file-viewer](https://github.com/JesseRaber/mozaik-file-viewer)
- License: [MIT](https://github.com/JesseRaber/mozaik-file-viewer/blob/main/LICENSE)
- Status on `main`: version `0.1.0` companion viewer (not a Mozaik replacement)
- Independent of Mozaik Software — not affiliated with, endorsed by, or a product of Mozaik / Cyncly

[[Getting-Started|Get started]] · [[Job-Files|Job files it reads]] · [[Privacy-and-Security|Privacy and security]] · [[FAQ]]

## What Mozaik File Viewer is

Cabinet shops already have the job on disk. What they often lack is a **read-only shop-floor viewer** that does not require a Mozaik license seat, a Paperless Shop workstation, or a network upload.

Mozaik File Viewer is that companion:

- Reads **Mozaik job folders** the shop already exported (`*.des`, `*.sbk`, `*.opt`, `*-JobParms.dat`, `JobDat.dat`, nested G-code)
- Renders a **3D cabinet** you can orbit, pan, explode, and isolate by layer
- Builds a **face-frame cut sheet** (members, pocket-screw marks, printable title block, thickness on the cut list)
- Builds a **box assembly sheet** with optimizer labels matched by **name and size**, not only `RoomN.des`
- Shows **construction parameters** from `*-JobParms.dat`
- Preflights **nested G-code** in millimetres and honors `G20` / `G21`
- Ships a procedural **24" face-frame demo** so you can try the viewer with no shop files

It is **not** Mozaik Software. It does not nest parts, does not write `.des` files, and does not talk to a Mozaik license.

## Who it is for

- Custom cabinet shops running **Mozaik Software** who want a second screen on the saw, assembly bench, or CNC
- Owners who will not send customer jobs, cut lists, or G-code to a cloud viewer
- Shops comparing a **local companion** against a full Paperless Shop seat
- Developers inspecting how a Mozaik job folder is structured on disk

## Features

### 3D cabinet viewer

- Orbit, pan, and zoom a room
- Front / iso / back cameras
- Solid, x-ray, and line render modes
- Explode slider
- Optional grid and overall dimensions
- Layer chips: Case, Face frame, Doors & fronts, Drawer boxes, Shelves, Hardware, Machining
- Double-click a chip to isolate that layer
- Pick a part in the sidebar; unknown part types draw as generic extruded solids and are listed in load warnings instead of disappearing

### Shop sheets

- **Face-frame cut sheet** — members, pocket-screw marks, printable title block, thickness on the cut list
- **Box assembly sheet** — optimizer labels matched by part name and size
- **Construction parameters** — values from `*-JobParms.dat`
- **G-code visualizer** — nested-sheet preflight in millimetres; `G20` / `G21` detected

### Local file access

- **Open job folder** (Chromium File System Access API)
- **Files / zip** picker
- **Set Jobs folder** and reopen recent jobs from IndexedDB handles
- Drag-and-drop a Mozaik job folder or `.zip`

### Units and preferences

- Inch or millimetre display
- Title-block fields (company, drawn, job, customer, rev)
- Per-group part colors
- Preferences stored only in `localStorage` on that machine

## How to open a Mozaik job

1. Run the viewer locally (`npm install` then `npm run dev`) or load the built app from a trusted shop machine.
2. Click **Load demo cabinet** to confirm the 3D view with no shop files.
3. Click **Open job folder** and pick the job directory Mozaik wrote (the folder that contains `Room1.des`, optimizer `.opt` files, and `*-JobParms.dat`).
4. Or click **Files / zip** / drop a `.zip` of that folder.
5. Choose **Room** and **Cabinet**. Search filters the cabinet list.
6. Use **Face frame sheet**, **Box assembly sheet**, **Construction parameters**, or **G-code visualizer** as needed.

Full click path: [[Getting-Started]].

## Mozaik job files the viewer reads

| File | Role |
| --- | --- |
| `*.des` / `*.sbk` | Room XML (UTF-8 or UTF-16, BOM optional) |
| `*.opt` | Optimizer labels and material thickness |
| `*-JobParms.dat` | Construction parameters |
| `JobDat.dat` | Customer name |
| `*.TXT` / `.nc` / `.gcode` and related CNC extensions | Nested G-code |

G-code-like `.txt` files are sniffed for `Mozaik Output`, `G20`/`G21`/`G90`, and motion words before they are treated as CNC.

See [[Job-Files]] for the load order, thickness rules, and encoding notes.

## Thickness

Part thickness is resolved in this order:

1. XML attributes on the part (`Thickness`, `Thick`, `T`, `MatThick`, …)
2. Matching optimizer material (name + size)
3. Type defaults (¾″ case, ½″ back, and similar)

Shaker door panels are drawn only when the room actually stores door-style rails **and** those rails leave a real opening. Hardware (`Metal`) is rendered. Part geometry is disposed when you change cabinets.

## Privacy: files never leave the machine

This is the product constraint, not a marketing line.

- Job XML is parsed in the browser. There is no upload API.
- Chromium may store File System Access **handles** in IndexedDB (`mfv-fs`) so recent jobs can be reopened. The job bytes stay on disk.
- Unit, title-block, and part-color preferences live in `localStorage` (`mfv_unit`, `mfv_title`, `mfv_colors`).
- DOM nodes for job data use `textContent` / attributes. Job XML is not assigned to `innerHTML`.
- Print output clones already-built DOM (or a canvas data URL) into a hidden iframe.

Details: [[Privacy-and-Security]] and the repo [SECURITY.md](https://github.com/JesseRaber/mozaik-file-viewer/blob/main/SECURITY.md).

## Run it locally

Vanilla TypeScript viewer (`src/viewer`) with Three.js and JSZip from npm — no CDN, no React in the viewer.

```bash
git clone https://github.com/JesseRaber/mozaik-file-viewer.git
cd mozaik-file-viewer
npm install
npm run dev
```

Vite serves at `http://localhost:5173` (`--host 0.0.0.0 --port 5173`). Chromium-based browsers give the best folder-picker and recent-job experience.

```bash
npm test
npm run build
```

`npm test` runs `src/viewer/viewer.test.ts`. `npm run build` typechecks and builds with Vite.

## What this tool does not do

- Does not replace Mozaik Software, the Product Editor, or the optimizer
- Does not write `.des`, `.sbk`, `.opt`, or G-code
- Does not nest parts or post to a CNC
- Does not require or contact a Mozaik license server
- Is not a hosted “paperless shop” SaaS

Treat it as a **shop-floor companion** for a job you already have.

## FAQ

**Does this upload my cabinets?**  
No. Parsing stays in the browser. See [[Privacy-and-Security]].

**Do I need a Mozaik license to view a job?**  
No. You need the job folder on disk. Designing and nesting the job still happens in Mozaik.

**Which browser should the shop use?**  
A current Chromium browser (Chrome, Edge, etc.) for `Open job folder` and recent-job handles. File / zip drop works more widely.

**Can it open a zipped job from the office NAS?**  
Yes — drop the `.zip`, or copy the job folder onto the viewer PC and use **Open job folder**.

**Is it affiliated with Mozaik / Cyncly?**  
No. Mozaik® is a trademark of its owner. This project is an independent, MIT-licensed companion.

More questions: [[FAQ]].

## Source and topics

- Code: [github.com/JesseRaber/mozaik-file-viewer](https://github.com/JesseRaber/mozaik-file-viewer)
- Homepage listed on the repo: [jesseraber.net](https://jesseraber.net)
- Topics: `mozaik`, `mozaik-software`, `cabinetry`, `cabinetry-software`, `woodworking`

Related pages: [[Getting-Started]] · [[Job-Files]] · [[Privacy-and-Security]] · [[FAQ]]
