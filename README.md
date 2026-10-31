# Mozaik File Viewer

Local, read-only viewer for Mozaik cabinet job folders. **Independent of Mozaik Software** — not affiliated with, endorsed by, or a product of Mozaik. Job files never leave the machine.

Open a Jobs folder (or drop a `.zip`) and you get:

- **3D cabinet** — orbit, pan, explode, isolate layers, pick parts
- **Face-frame reference sheet** — source members, printable title block and visibly estimated thickness; no invented pocket operations
- **Box assembly reference** — source quantities and dimensions; optimizer associations require room/cabinet/name/size compatibility and ambiguous identities are withheld
- **Construction parameters** from `*-JobParms.dat`
- **G-code reference preview** — millimetres, honors `G20` / `G21`

A procedural 24" face-frame demo loads without any shop files.

## Wiki

Shop-oriented documentation (getting started, job files, privacy, FAQ):

- Source in this repo: [wiki/Home.md](wiki/Home.md)
- GitHub Wiki tab (after the first page is saved there): https://github.com/JesseRaber/mozaik-file-viewer/wiki

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
| `*.mzkcut` (added from **Cutlist check**) | Mozaik cutlist export (`AppData.xml`), compared with the loaded job |

## Thickness

1. XML attributes on the part (`Thickness`, `Thick`, `T`, `MatThick`, …)
2. Matching optimizer material
3. Type defaults (¾" case, ½" back, …)

Shaker door panels are drawn only when the room actually stores door-style rails **and** they leave a real opening. Hardware (`Metal`) is rendered. Part geometry is disposed when you change cabinets.

## Run

Vanilla TypeScript viewer (`src/viewer`) with Three.js and JSZip from npm — no CDN, no React in the viewer.

```
npm ci
npm run dev
```

## Not a Mozaik replacement

This tool does not write `.des` files, does not nest, and does not talk to a Mozaik license. It is a shop-floor companion for looking at a job you already have.


## Companion preview limits

This is a read-only companion viewer. Full Paperless Shop replacement belongs in the separate WoodWorx Paperless Shop project. This candidate requires shop acceptance before production use.

- Open one job folder at a time. Duplicate cabinet identifiers, ambiguous material matches and conflicting measurements are reported rather than guessed.
- Include only the intended matching Paperless export. Multiple exports are not ranked by size or presumed current. Original stated thickness survives conflicts.
- **Cutlist check** compares a Mozaik cutlist export (`.mzkcut`) with the loaded job per cabinet, matching Mozaik cabinet ID, report name and size (0.1 mm tolerance). Known export behaviour (export-only toe skins and counter tops, door members exported as one door, the 1.5875 mm narrower frameless adjustable shelf, `UEnd`→`End` + `Panelized End`) is labelled expected; other differences are flagged. Cabinets in only one side are listed and not compared. Labels and edge banding are not checked. Adding or failing to add an export never changes the loaded job.
- Parameter numbering is recognized only when its range establishes zero- or one-based categories; otherwise all parameters are shown until the user selects a numbering convention.
- G-code previews support explicit G20/G21, G90/G91, XY-plane G0/G1/G2/G3, incremental I/J or signed R arcs, and standard spindle/tool blocks. Macros, canned cycles, offsets/compensation and unsupported commands withhold the preview. G54 is treated as a single work coordinate frame; the preview does not model machine/tool offsets. A preview is not machining approval.
- Frame drawings are illustrations of source parts. Pocket operations are not inferred. Default thicknesses need verification.
- G-code feed heights do not establish stock thickness. Z values are programmed coordinates; controller offsets, tool macros and the physical datum are not verified. Shop posts that omit units or use unsupported machine-coordinate/multi-drill commands remain refused, even when a saved post template is known.

### Local validation and recovery

Sheets request Letter landscape with upright content. For Microsoft Print to PDF, select Letter paper and Landscape in the print dialog; remembered printer settings can override the page request. Check the preview before saving. Assembly tables repeat their headers across pages. The print is a reference, not a scaled fabrication drawing.

Use Node 22.18+ or 24, `npm ci --ignore-scripts`, `npm test`, then `npm run build`. `npm run preview` serves the built assets on loopback. Keep the last accepted build/source revision; revert to it if a candidate fails acceptance. No job file write-back occurs. Offline operation requires the local server and already-installed assets; this is not a service-worker-installed application.

### Import bounds and source limits

Imports are bounded to 2,048 entries, 32 MiB per expanded file, 64 MiB per ZIP and 256 MiB expanded total. Unsafe archive paths and XML DTD/entity declarations are refused. Folder nesting is bounded. Unsupported/failed inputs report an error or warning; the previous job remains available after failed replacement.

The viewer preserves source room/cabinet UniqueIDs for traceability; it does not guess export mappings from duplicate display numbers. Source design dimensions and names can differ from cut/report values, and exported-only parts may be absent. A saved packet is a snapshot, not a live NAS monitor: reload the intended revision. Sheets carry those limitations.

## Local beta pilot

Version 0.4.0-beta.1 is a local Windows/Edge reference-viewer candidate, not a published or production-accepted release. The sidebar and built version.json identify the exact source. Package from a clean reviewed commit after npm checks/build using `python packaging/build_candidate.py <new-output-directory-outside-source>` (on any OS; it downloads the pinned python.org Windows embeddable runtime and checks its SHA-256, or use `--runtime-zip <file>`). A dirty or mismatched build is refused. The Windows x64 package bundles Python, so the receiving PC needs only Edge: extract, run Install (per-user, no administrator rights), then start from Start Menu > Mozaik File Viewer. See [package instructions](packaging/README-LOCAL.md). No Node/npm is required to run the package. Loopback only; not an installed PWA, and the package is not code-signed.

The pilot improves typography/contrast, dialog keyboard focus and source/build identity while preserving source/quantity warnings. Browser-profile checks are not clean-OS, real NAS, physical printing, operator or full-shift acceptance.
