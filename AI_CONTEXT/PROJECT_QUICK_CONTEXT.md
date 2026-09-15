# Project Quick Context

Last updated: 2026-09-15.

## Project purpose

Local, read-only companion viewer for Mozaik cabinet job folders. Companion to
Mozaik Paperless Shop, not a replacement. Scope fixed by owner 2026-09-15 —
see `PROJECT_ROADMAP_STATUS.md`.

## Current owner direction

Ship the companion viewer. The repo app is the only product line. The
single-file beta HTML is retired and its code must not be copied in.

## Verified installed state

- HEAD of `main`: `b6f1cb16`. 3 commits, all 2026-09-08. No releases, no tags.
- `package.json` v0.1.0, private. Vanilla TypeScript + Three.js 0.186 + JSZip,
  built with Vite 6. No React, no CDN.
- Tests: `src/viewer/viewer.test.ts`, 4 tests, all against synthetic demo data.
  No real-job fixtures yet.
- CI: NOT yet installed. `.github/workflows/ci.yml` could not be committed by
  the GitHub connector in use (no `workflows` permission). The file content is
  ready and waiting on the owner to add it.

## Current configuration

Browser app, local-only. Reads job folders via the File System Access API on
Chromium, with a `webkitdirectory` fallback elsewhere. IndexedDB store `mfv-fs`
holds directory handles and recent jobs. localStorage holds unit, title block,
and part colors. No network egress.

## Current safety and authorization boundary

Read-only against job folders. No write path to `.des` files. No Mozaik license
interaction.

## Recently completed

- 2026-09-08: initial rewrite to vanilla TS/Three.js.
- 2026-09-15: production-readiness assessment; companion scope decided;
  governance files added.

## Current open items

- No real `.des` / `.opt` / `-JobParms.dat` fixtures. Blocks the release gate.
- `src/viewer/parse/opt.ts` reads the first `<OptimizeMaterial>` via
  `querySelector` but collects `OptimizePart` from the whole document via
  `querySelectorAll`. On a multi-material `.opt` every part would be attributed
  to material #1. UNVERIFIED — needs a real multi-material file.
- Optimizer-to-part matching in `parse/load.ts` `applyOptimizerThickness()` and
  `assembly.ts` `rows()` uses substring name match plus `dimClose(..., 1.2)`
  with first-hit `break`. A wrong thickness can land silently on a cut sheet.
- `thicknessSource` is shown only in a hover tooltip, not on printed sheets.
- Face-frame sheet is hidden unless a part of type `Frame` exists; frameless
  jobs get no cut sheet.
- Recent-jobs persistence is Chromium-only (`showDirectoryPicker`).
- Two live WebGL contexts (main engine + assembly overlay, the latter with
  `preserveDrawingBuffer: true`) and no `webglcontextlost` handler.

## Known stale or conflicting records

- The claude.ai Project description still reads "replace Mozaik Paperless Shop."
  Superseded by the owner scope decision of 2026-09-15 recorded in
  `PROJECT_ROADMAP_STATUS.md`.

## Immediate next step

Commit sanitized real-job fixtures, then verify and fix `parse/opt.ts` and the
part-matching logic against them.

## Current authority files

- `PROJECT_ROADMAP_STATUS.md`
- `AI_CONTEXT/README_FIRST.md`

## Recent journal entries

- `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md` — 2026-09-15, production-readiness
  scan and scope decision.

## Limitations

The parser-correctness risks above were identified by reading source, not by
running against real Mozaik job files. No build or test run has been executed
by an agent in this project. No shop-floor pilot has been run.
