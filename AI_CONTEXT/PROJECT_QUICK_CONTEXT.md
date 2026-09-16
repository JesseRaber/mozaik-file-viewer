# Project Quick Context

Last updated: 2026-09-16.

## Project purpose

Local, read-only companion viewer for Mozaik cabinet job folders. Companion to
Mozaik Paperless Shop, not a replacement. Scope fixed by owner 2026-09-15 —
see `PROJECT_ROADMAP_STATUS.md`.

## Current owner direction

Ship the companion viewer. The repo app is the only product line. The
single-file beta HTML is retired and its code must not be copied in.

Owner decision 2026-09-16: read BOTH sources — the job folder as before, plus a
Paperless Shop export path that supersedes the guesses when one is present.
Owner wording: "Both — job folder as now, plus a 'load Paperless Shop export'
path that supersedes the guesses when present."

## Verified installed state

- Repo is PUBLIC. `main` HEAD `b6f1cb16`. All work is on branch
  `chore/companion-scope-and-ci` (PR #1), HEAD `8cf7d3d`.
- Vanilla TypeScript + Three.js 0.186 + JSZip, built with Vite 6.
- VERIFIED by execution against a clean checkout of the pushed branch,
  2026-09-16: `npm run typecheck` exit 0, `npm run build` exit 0, `npm test`
  19 tests / 19 pass / 0 fail.
- Parsers are testable for the first time. `test/ts-resolve.mjs` resolves the
  codebase's extensionless imports under Node; `test/setup.mjs` supplies
  `DOMParser` via `linkedom`.
- First real fixture committed: `test/fixtures/WoodWorxTest-Run1-LabelStatus.xml`
  (sanitized, provenance in `test/fixtures/README.md`).
- CI: still NOT installed. `.github/workflows/ci.yml` cannot be committed by the
  GitHub connector (no `workflows` permission). File is with the owner.

## Current configuration

Browser app, local-only. Reads job folders via the File System Access API on
Chromium, with a `webkitdirectory` fallback elsewhere. Also reads Mozaik
"export to apps" files — `.mzklbl`, `.mzkcut`, `.mzkasy` (ZIPs, via the bundled
JSZip) and the `*Status.xml` files on the share. IndexedDB holds directory
handles and recent jobs; localStorage holds unit, title block, part colors. No
network egress.

Thickness precedence, highest first: Paperless Shop export, XML attribute,
optimizer match, type default. A `default` thickness is now flagged on the
assembly sheet and on the printed copy.

Job data locations on the owner's machine:
- `U:\Jobs` — production Mozaik jobs (81 jobs).
- `U:\Paperless Shop` — exports and status files. Format documented in
  `AI_CONTEXT/PAPERLESS_SHOP_EXPORT_FORMAT.md`.
- `C:\Mozaik\Jobs` — six Mozaik sample jobs.
- `OneDrive\Job Files` — PDFs and drawings only, no job data.

## Current safety and authorization boundary

Read-only against job folders and Paperless Shop exports. Nothing is written
back — the status files are read, never updated.

## Recently completed

- 2026-09-15: readiness assessment; companion scope decided; governance added;
  two parser bugs found against real files and fixed.
- 2026-09-16: typecheck/build repaired (broken since the first commit);
  Paperless Shop export reading added; guessed thicknesses flagged on sheets;
  parser test infrastructure and the first real fixture.

## Current open items

- CI not installed (owner action, one file).
- No `package-lock.json` committed, so CI uses `npm install`, not `npm ci`.
- **Duplicate `CabNo` within one room.** `Krebs (Victoria)\Room1.des` has two
  cabinet 1s and two cabinet 2s. Exact `R<room>C<cab>` matching cannot separate
  them, so both claim the same labels. Needs keying on `Product UniqueID`.
  Not fixed.
- The face-frame sheet does not flag defaulted thickness; only the assembly
  sheet does.
- `.mzkasy` / `.mzkcut` `AppData.xml` is not read. It holds hardware and
  accessory lists, which the assembly sheet still omits entirely.
- `ManifestData.xml` (authoritative room/cabinet index, with UniqueID) is not
  read.
- Face-frame sheet hidden unless a part of type `Frame` exists.
- Recent-jobs persistence is Chromium-only.
- Two live WebGL contexts and no `webglcontextlost` handler.
- Bundle 727 kB raw / 198 kB gzipped in one chunk.

## Known stale or conflicting records

- The claude.ai Project description still reads "replace Mozaik Paperless Shop."
  Superseded by `PROJECT_ROADMAP_STATUS.md`.
- The suspected multi-material `.opt` bug is WITHDRAWN — Mozaik writes one
  material per file. Do not reopen.

## Immediate next step

Install CI. Then read `ManifestData.xml` for the UniqueID-based cabinet index,
which resolves the duplicate-`CabNo` hazard and unlocks the hardware lists.

## Current authority files

- `PROJECT_ROADMAP_STATUS.md`
- `AI_CONTEXT/README_FIRST.md`

## Recent journal entries

- `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md` — 2026-09-16, Paperless Shop overlay.
- `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md` — 2026-09-16, build repair.

## Limitations

The overlay was measured on two jobs (`Krebs (Victoria)`, `WoodWorx Test`) and
the parsers on Mozaik's `Sample Face Frame`. 79 other production jobs in
`U:\Jobs` are unexamined. No shop-floor pilot has been run.
