# Project Activity Journal — Mozaik File Viewer

Append-only. Chronological. Newest at the bottom.

---

## 2026-09-15 18:40 - Production-readiness scan of repo and project folder

- User objective: Determine whether this app is ready to replace Mozaik
  Paperless Shop in production.
- Work performed: Read repo source via the GitHub connector. Listed branches,
  releases, commits. Scanned `Downloads\Mozaik File Viewer`. Researched
  Paperless Shop's feature set from vendor press coverage.
- Result: Not production-ready as a replacement. Category gap, not a polish gap.
- Files created: none. Files modified: none.
- Commands or tests run: none.
- Verification evidence: HEAD `b6f1cb16`, 3 commits all 2026-09-08, no releases,
  no `.github/`. `viewer.test.ts` 4 tests, all synthetic. `store.ts` has no
  completion field. `assembly.ts` `rows()` skips Hardware/Doors/Face frame.
  README says "Not a Mozaik replacement" verbatim.
- Decisions made: none this turn.
- Corrections or contradictions found: the Project description claimed a
  Paperless Shop replacement; README and code contradict it.
- Current status: assessment complete.
- Open items: fixtures, opt.ts verification, part-matching, CI, scope decision.
- Recommended next step: owner decides companion vs. replacement.
- Authority classification: research finding, non-governing.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: parser risks were read from source, not executed.

---

## 2026-09-15 19:10 - Owner scope decision; governance files added

- User objective: Proceed as a companion viewer; repo app only; retire the beta
  HTML; carry out the fixture, parser, and CI work.
- Work performed: Recorded scope in `PROJECT_ROADMAP_STATUS.md`. Created the
  `AI_CONTEXT/` files. Quarantined the beta HTML on the owner's machine.
- Result: Scope recorded in-repo. CI could not be added — see Failed.
- Files created: `PROJECT_ROADMAP_STATUS.md`, `AI_CONTEXT/README_FIRST.md`,
  `AI_CONTEXT/PROJECT_QUICK_CONTEXT.md`, `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md`.
- Files modified: `README.md`.
- Commands or tests run: `mkdir` and `mv -n` on the owner's machine.
- Verification evidence:
  - Owner wording, verbatim: "Companion Viewer"; "We are using the repo app";
    "I don't want any code from the HTML app copied to the new repo app";
    "you can kill the html beta app."
  - Branch `chore/companion-scope-and-ci` from `b6f1cb16`. PR #1 opened.
  - Listing after the move shows `_to_delete/Cabinet_Job_Viewer_Beta_1.0(12).html`
    and `_to_delete/beta-duplicates/` with the two nested copies.
- Decisions made (owner, approved): companion-viewer scope; repo app is the only
  product line; beta HTML retired, its code excluded.
- Failed:
  - `.github/workflows/ci.yml` — connector returned `403 Resource not accessible
    by integration`; no `workflows` permission. CI is NOT installed.
  - Outright deletion of the beta HTML — session delete permission denied. Files
    were moved to `_to_delete/` and still exist.
- Current status: scope and governance in PR #1, not merged.
- Authority classification: owner decision — approved, governing for scope.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: the beta quarantine is a move, not a delete.

---

## 2026-09-15 19:35 - Real-file verification; two bugs confirmed and fixed, one hypothesis withdrawn

- User objective: Get real fixtures and fix the parser risks.
- Work performed: Located the real job data in `C:\Mozaik\Jobs`. Staged
  `Sample Face Frame` and ran a harness comparing current vs. proposed
  behavior, with `linkedom` supplying `DOMParser`.
- Result: One hypothesis withdrawn, two bugs confirmed and fixed.
- Files modified: `src/viewer/parse/opt.ts`, `src/viewer/geom.ts`,
  `src/viewer/assembly.ts`, `src/viewer/viewer.test.ts`.
- Commands or tests run: the comparison harness; 6 new tests, 6 pass, 0 fail.
- Verification evidence:
  - WITHDRAWN: the suspected multi-material `.opt` bug. Each `.opt` file
    contains exactly ONE `<OptimizeMaterial>`. A warning now fires if one ever
    carries more.
  - CONFIRMED (fixed): `<OptimizeMaterial>` carries `Name`, not `DisplayName`.
  - CONFIRMED (fixed): assembly-label cross-matching. Over 246 optimizer parts,
    Kitchen cab 1 matched 114 parts (R1C1, R1C10–13, R2C1) where it owns 25;
    Master Bath cab 1 returned the identical 114, i.e. the room was ignored.
  - REASSESSED UPWARD: `<CabProdPart>` has no `Thickness` attribute; only
    `SUPartD` is ever usable, on 8 of 122 parts (6.6%).
  - CHECKED, NO BUG: optimizer `Length`/`Width` match `.des` `L`/`W`.
- Decisions made: exact numeric matching replaces substring matching.
- Corrections or contradictions found: the 18:40 multi-material concern is
  superseded and must not be reopened.
- Authority classification: executed and verified for the two fixes.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: the full repo was NOT typechecked or built — it
  was private and no credential was available.

---

## 2026-09-16 00:05 - Repo made public; build repaired; suite verified green

- User objective: Owner made the repository public and supplied the network job
  paths.
- Work performed: Cloned the repo, installed dependencies, ran the real
  typecheck, test and build. Repaired the typecheck.
- Files modified: `tsconfig.json`, `package.json`.
- Commands or tests run: `npx tsc --noEmit` BEFORE exit 2 / AFTER exit 0;
  `npm test` 10 pass; `npm run build` exit 0; same six errors reproduced on
  unmodified `main`.
- Verification evidence:
  - NEW DEFECT, pre-existing since `e5d722f`: `npm run typecheck` and therefore
    `npm run build` had never passed. Six `viewer.test.ts` errors — TS2307 for
    `node:assert/strict` and `node:test`, TS5097 for the `.ts` import
    specifiers. `npx vite build` alone exits 0, which is why it stayed invisible.
  - Fix: `allowImportingTsExtensions: true`, `"types": ["vite/client", "node"]`,
    `@types/node` devDependency.
  - RESOLVES the prior entry's limitation: the `assembly.ts` edit compiles clean.
  - NO `package-lock.json` is committed; the container-generated one had no
    integrity hashes and was deliberately NOT committed.
- Failed: `device_request_folder_access` on `U:\Jobs` and `U:\Paperless Shop` —
  mapped network drives cannot be granted that way. Owner connected `U:\` via
  the desktop folder picker instead.
- Authority classification: executed and verified.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.

---

## 2026-09-16 00:40 - Paperless Shop export reading; parser tests possible for the first time

- User objective: Owner chose the "both" option, verbatim: "Both — job folder as
  now, plus a 'load Paperless Shop export' path that supersedes the guesses when
  present."
- Work performed:
  - Examined `U:\Paperless Shop`. Documented the format in
    `AI_CONTEXT/PAPERLESS_SHOP_EXPORT_FORMAT.md`.
  - Built `src/viewer/parse/paperless.ts` and wired it into `loadItems`.
  - Built test infrastructure that makes the parsers loadable under Node.
  - Committed the first sanitized real-job fixture.
  - Flagged defaulted thicknesses on the assembly sheet and its printed copy.
- Files created: `src/viewer/parse/paperless.ts`,
  `src/viewer/parse/paperless.test.ts`, `test/ts-resolve.mjs`,
  `test/setup.mjs`, `test/fixtures/WoodWorxTest-Run1-LabelStatus.xml`,
  `test/fixtures/README.md`, `AI_CONTEXT/PAPERLESS_SHOP_EXPORT_FORMAT.md`.
- Files modified: `src/viewer/types.ts`, `src/viewer/parse/load.ts`,
  `src/viewer/assembly.ts`, `package.json`,
  `AI_CONTEXT/PROJECT_QUICK_CONTEXT.md`.
- Commands or tests run, against a clean checkout of the PUSHED branch
  (`git reset --hard origin/chore/companion-scope-and-ci`, HEAD `8cf7d3d`):
  - `npx tsc --noEmit` — exit 0.
  - `npm test` — 19 tests, 19 pass, 0 fail.
  - `npm run build` — exit 0.
  - Working tree clean afterwards.
- Verification evidence:
  - `.mzklbl`, `.mzkcut`, `.mzkasy` all begin `PK\x03\x04` — ZIPs, readable with
    the JSZip already bundled. No new runtime dependency.
  - Overlay measured on `Krebs (Victoria)` Room1 (139 parts): BEFORE, all 139
    carried `thicknessSource: "default"` — not one came from the job XML. AFTER,
    64 carry `"paperless"`. **All 64 differ from the guess by more than 0.3 mm.**
    Defaults say 19.05 / 12.7; the real stock is 17.78, 18.5928, 11.938, 12.065.
  - AssyNo numbering confirmed on a production job: `Room1.des` = "Living Room"
    = AssyNo prefix `R1`, while `ManifestData.xml` numbers that same room `2`.
    `roomNumber()` parses the file name and so agrees with AssyNo.
  - The `R<room>N<cab>` AssyNo variant exists in the wild (`R4N1` in
    `WoodWorx Test`) and `parseAssy` already handles it. Now covered by a test.
  - Paperless Shop tracks progress as plain XML on the share:
    `<Mat Index="…"><Part Index="1" Printed="True" /></Mat>`. The sync substrate
    is a shared folder, not a server.
  - Parser tests were previously impossible: the codebase imports relative
    modules without an extension, which Node will not resolve, and the parsers
    call `DOMParser`. `test/ts-resolve.mjs` and `test/setup.mjs` fix both.
- Decisions made: Paperless Shop data outranks the optimizer match and the XML
  attribute. Sheet remnants (`IsRemnant="True"`) are never treated as parts. A
  `<Mat>` progress record is never treated as a part. Status files are read only
  — nothing is written back.
- Corrections or contradictions found: none new. An earlier estimate in
  conversation that multi-tablet sync would be a large undertaking was too
  pessimistic about the mechanism — the substrate already exists. That is an
  observation, not an approved scope change.
- Current status: PR #1 green by execution against the pushed branch. CI still
  absent.
- Open items:
  - CI install (owner, one file).
  - Duplicate `CabNo` within one room — `Krebs\Room1.des` has two cabinet 1s and
    two cabinet 2s. Exact matching cannot separate them. Needs `UniqueID`.
  - `ManifestData.xml` and `AppData.xml` are not read; hardware and accessory
    lists are still missing from the assembly sheet.
  - The face-frame sheet does not flag defaulted thickness.
  - This journal is approaching 14 KB; consider splitting by month.
- Recommended next step: install CI, then read `ManifestData.xml` for the
  UniqueID-based cabinet index — it resolves the duplicate-`CabNo` hazard and
  opens the hardware lists.
- Authority classification: owner decision (approved, governing for scope);
  implementation executed and verified.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: High — every claim is backed by a command exit
  code, a test count, or a measured part count from this session. The overlay
  was measured on two jobs; 79 other production jobs in `U:\Jobs` are
  unexamined. The UI was NOT opened in a browser this session: the assembly
  sheet's new highlight and note are verified by typecheck and build only, not
  by looking at a rendered sheet.
