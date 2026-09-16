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
  - Branch `chore/companion-scope-and-ci` from `b6f1cb16`; commits `6ceca71`,
    `0c13ee1`, `1f8fbb9`, `5799429`, `1154cff`. PR #1 opened.
  - Listing after the move shows `_to_delete/Cabinet_Job_Viewer_Beta_1.0(12).html`
    and `_to_delete/beta-duplicates/` with the two nested copies.
- Decisions made (owner, approved): companion-viewer scope; repo app is the only
  product line; beta HTML retired, its code excluded.
- Failed:
  - `.github/workflows/ci.yml` — GitHub connector returned `403 Resource not
    accessible by integration`. It has contents write but not the `workflows`
    permission. CI is NOT installed.
  - Outright deletion of the beta HTML — session delete permission denied by the
    auto-mode classifier. Files were moved to `_to_delete/` and still exist.
- Current status: scope and governance in PR #1, not merged. CI absent.
- Authority classification: owner decision — approved, governing for scope.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: the beta quarantine is a move, not a delete.

---

## 2026-09-15 19:35 - Real-file verification; two bugs confirmed and fixed, one hypothesis withdrawn

- User objective: Get real fixtures and fix the parser risks.
- Work performed:
  - Located the real job data in `C:\Mozaik\Jobs` (six Mozaik sample jobs). It
    is NOT in `OneDrive - Unique WoodWorx\Job Files`, which holds PDFs only.
  - Staged `Sample Face Frame` into the analysis container and ran a harness
    comparing current vs. proposed behavior, with `linkedom` supplying
    `DOMParser`.
- Result: One hypothesis withdrawn, two bugs confirmed and fixed, one severity
  reassessment.
- Files modified: `src/viewer/parse/opt.ts`, `src/viewer/geom.ts`,
  `src/viewer/assembly.ts`, `src/viewer/viewer.test.ts`.
- Commands or tests run: `node --experimental-strip-types verify.ts`;
  `node --experimental-strip-types --test assy.test.ts` — 6 pass, 0 fail.
- Verification evidence:
  - WITHDRAWN: the suspected multi-material `.opt` bug. Each of the three `.opt`
    files contains exactly ONE `<OptimizeMaterial>`. Mozaik writes one material
    per file. A warning is now emitted if a file ever carries more than one.
  - CONFIRMED (fixed): `<OptimizeMaterial>` carries `Name`, not `DisplayName`.
    CURRENT `"3-4 Prefinished UV Plywood.opt"` vs FIXED
    `"3/4 Prefinished UV Plywood"`, for all three files.
  - CONFIRMED (fixed): assembly-label cross-matching. AssyNo values in the job:
    R1C1–R1C13, R2C1–R2C3. Over 246 optimizer parts:
    - Room1.des cab 1 — CURRENT 114 parts from R1C1, R1C10–13, R2C1. FIXED 25
      from R1C1 only.
    - Room2.des cab 1 — CURRENT the same 114, i.e. the room was ignored
      entirely. FIXED 25 from R2C1 only.
    - Room1.des cab 2 — CURRENT 18 from R1C2 and R2C2. FIXED 10 from R1C2.
  - REASSESSED UPWARD: `<CabProdPart>` has no `Thickness` attribute. Only
    `SUPartD` is ever usable, on 8 of 122 parts (6.6%) in Room2.des. Thickness on
    a printed cut sheet is almost always an optimizer match or a hardcoded type
    default, not job data.
  - CHECKED, NO BUG: optimizer `Length`/`Width` match `.des` `L`/`W`, not
    `DisplayL`/`DisplayW` (45 of 60 sampled matched L/W, 0 matched Display).
  - NOTED: `<OptimizeMaterial>` has no `RunId`; every file merges into run 0.
- Decisions made: exact numeric matching replaces substring matching. An
  unparseable AssyNo is treated as not-ours.
- Corrections or contradictions found: the 18:40 entry's multi-material concern
  is superseded and must not be reopened.
- Current status: fixes in PR #1 (`3d21435`, `bb85d23`, `bb7f1ac`, `862f7be`).
- Open items: fixtures blocked on a DOM shim; printed sheets do not mark
  defaulted thickness; CI absent.
- Authority classification: executed and verified for the two fixes.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: the full repo was NOT typechecked or built in this
  session — it was private and no credential was available. `assembly.ts` was
  edited to follow the signature change and that edit was unverified by
  compilation. Findings come from one job.

---

## 2026-09-16 00:05 - Repo made public; build repaired; suite verified green

- User objective: Owner made the repository public — "you should be able to do
  whatever you need in there now" — and supplied the network job paths.
- Work performed: Cloned the repo into the analysis container, installed
  dependencies, and ran the real typecheck, test and build. Repaired the
  typecheck. Recorded the network paths.
- Result: The previous entry's stated limitation is RESOLVED. A new, older
  defect was found and fixed.
- Files modified: `tsconfig.json`, `package.json`,
  `AI_CONTEXT/PROJECT_QUICK_CONTEXT.md`.
- Commands or tests run (all in the container, on the PR branch):
  - `git clone` + `npm install` — 36 packages.
  - `npx tsc --noEmit` — BEFORE: exit 2, six errors. AFTER: exit 0.
  - `npm test` — 10 tests, 10 pass, 0 fail.
  - `npm run build` — exit 0.
  - `git checkout main && npx tsc --noEmit` — same six errors on `main`.
- Verification evidence:
  - NEW DEFECT, pre-existing since commit `e5d722f`: `npm run typecheck` and
    therefore `npm run build` have never passed. Six `viewer.test.ts` errors —
    TS2307 for `node:assert/strict` and `node:test`, TS5097 for the four `.ts`
    import specifiers. Reproduced on unmodified `main`, so it is not a
    regression from this session's changes.
  - `npx vite build` alone exits 0, which is why the break stayed invisible.
  - Fix: `allowImportingTsExtensions: true` and `"types": ["vite/client",
    "node"]` in tsconfig, plus `@types/node` devDependency.
  - RESOLVES the prior entry's open limitation: the `assembly.ts` edit
    following the `assyMatches` signature change compiles clean.
  - Bundle is 727.22 kB raw / 197.75 kB gzipped in one chunk; Vite emits a
    chunk-size warning. Not addressed.
  - NO `package-lock.json` is committed. `npm ci` would fail, so the CI file
    handed to the owner uses `npm install`. The lock file generated in the
    container carries no integrity hashes (proxy artifact) and was deliberately
    NOT committed.
  - Owner-supplied paths, recorded not examined: `U:\Jobs` (production Mozaik
    jobs) and `U:\Paperless Shop` (created by "export to apps" in Mozaik).
- Decisions made: do not commit a container-generated lock file; CI uses
  `npm install` until the owner commits a proper one.
- Failed: `device_request_folder_access` on `U:\Jobs` and `U:\Paperless Shop` —
  refused, mapped network drives cannot be granted that way. The owner must add
  them with the desktop app's "Add folder" picker.
- Current status: PR #1 is green by local execution — typecheck, test and build
  all pass. CI still not installed. No production job or Paperless Shop export
  has been examined.
- Open items: CI install; commit a lock file; mark defaulted thickness on
  printed sheets; `test/fixtures/` plus a DOM shim; examine `U:\Paperless Shop`
  and a production job from `U:\Jobs`; bundle size.
- Recommended next step: install CI, then examine the Paperless Shop export
  format — until that is done the project does not know what it is a companion to.
- Authority classification: executed and verified.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: High — every claim above is backed by a command
  exit code or test count from this session. Still only one job examined
  (`Sample Face Frame`); the `R<room>C<cab>` AssyNo assumption is unconfirmed
  outside Mozaik's sample data.
