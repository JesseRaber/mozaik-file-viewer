# Project Quick Context

Last updated: 2026-09-16.

## Project purpose

Local, read-only companion viewer for Mozaik cabinet job folders. Companion to
Mozaik Paperless Shop, not a replacement. Scope fixed by owner 2026-09-15 —
see `PROJECT_ROADMAP_STATUS.md`.

## Current owner direction

Ship the companion viewer. The repo app is the only product line. The
single-file beta HTML is retired and its code must not be copied in.

## Verified installed state

- Repo is PUBLIC as of 2026-09-16 (owner action). `main` HEAD `b6f1cb16`.
- Branch `chore/companion-scope-and-ci` (PR #1) carries all current work.
- Vanilla TypeScript + Three.js 0.186 + JSZip, built with Vite 6. No React,
  no CDN.
- On the PR branch, VERIFIED by execution on 2026-09-16:
  - `npm run typecheck` exits 0.
  - `npm run build` exits 0.
  - `npm test` — 10 tests, 10 pass, 0 fail.
- CI: still NOT installed. `.github/workflows/ci.yml` cannot be committed by the
  GitHub connector (no `workflows` permission). File content is with the owner.

## Current configuration

Browser app, local-only. Reads job folders via the File System Access API on
Chromium, with a `webkitdirectory` fallback elsewhere. IndexedDB store `mfv-fs`
holds directory handles and recent jobs. localStorage holds unit, title block,
and part colors. No network egress.

Job data locations on the owner's machine:
- `C:\Mozaik\Jobs` — six Mozaik sample jobs (local, connected, analyzed).
- `U:\Jobs` — production Mozaik jobs on a shared network drive. NOT yet examined.
- `U:\Paperless Shop` — Paperless Shop job folders, produced by "export to apps"
  in Mozaik. NOT yet examined. Format unknown to this project.
- `OneDrive - Unique WoodWorx\Job Files` holds PDFs and drawings only, no job data.

## Current safety and authorization boundary

Read-only against job folders. No write path to `.des` files. No Mozaik license
interaction.

## Recently completed

- 2026-09-15: readiness assessment; companion scope decided; governance added.
- 2026-09-15: two parser bugs found against real files and fixed (optimizer
  material name; assembly-label cross-matching) with 6 regression tests.
- 2026-09-16: typecheck/build repaired — broken since the first commit.

## Current open items

- CI not installed (owner action).
- No `package-lock.json` is committed, so CI must use `npm install`, not
  `npm ci`. Owner should run `npm install` locally and commit the lock file.
- Printed sheets do not mark a thickness that came from a type default. Given
  that only 6.6% of parts carry any usable XML thickness, this is the highest
  -value remaining correctness fix.
- No `test/fixtures/` yet. Parser-level tests are blocked on a DOM shim:
  `parseDes` and `parseOpt` call `DOMParser`, absent in Node. `linkedom` is the
  obvious devDependency.
- `U:\Paperless Shop` export format has never been examined. Until it is, the
  project does not actually know what Paperless Shop consumes.
- Face-frame sheet is hidden unless a part of type `Frame` exists; frameless
  jobs get no cut sheet.
- Recent-jobs persistence is Chromium-only (`showDirectoryPicker`).
- Two live WebGL contexts and no `webglcontextlost` handler.
- Bundle is 727 kB (198 kB gzipped) in one chunk; Vite warns. Not addressed.

## Known stale or conflicting records

- The claude.ai Project description still reads "replace Mozaik Paperless Shop."
  Superseded by the owner scope decision recorded in `PROJECT_ROADMAP_STATUS.md`.
- The 2026-09-15 18:40 journal entry's suspected multi-material `.opt` bug is
  WITHDRAWN. Mozaik writes one material per file. Do not reopen.

## Immediate next step

Install CI, then examine `U:\Paperless Shop` and a production job from `U:\Jobs`
to confirm the AssyNo format assumption holds outside the sample jobs.

## Current authority files

- `PROJECT_ROADMAP_STATUS.md`
- `AI_CONTEXT/README_FIRST.md`

## Recent journal entries

- `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md` — 2026-09-16, build repair and
  execution-verified state.
- `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md` — 2026-09-15 19:35, real-file
  verification and the two parser fixes.

## Limitations

All findings so far come from ONE job, Mozaik's `Sample Face Frame`. No
production job and no Paperless Shop export has been examined. No shop-floor
pilot has been run.
