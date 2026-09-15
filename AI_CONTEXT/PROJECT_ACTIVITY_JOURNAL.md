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

- User objective: Get real fixtures and fix the parser risks (owner: "If it's
  something you can take care of please go ahead and complete the task").
- Work performed:
  - Located the real job data. It is NOT in
    `OneDrive - Unique WoodWorx\Job Files` (PDFs and drawings only) but in
    `C:\Mozaik\Jobs`, which holds six Mozaik sample jobs. Owner noted mid-session
    that Paperless Shop job folders live on a shared network drive; that path has
    not been supplied or examined yet.
  - Staged `Sample Face Frame` (`Room2.des`, three `.opt` files, JobParms,
    JobDat) into the analysis container.
  - Built a verification harness importing the repo's own `encoding.ts` and a
    verbatim extract of `geom.ts`'s matching helpers, with `linkedom` supplying
    `DOMParser`. Ran current vs. proposed behavior side by side.
- Result: One prior hypothesis withdrawn, two real bugs confirmed and fixed,
  one severity reassessment.
- Files created: none in repo beyond those listed below.
- Files modified: `src/viewer/parse/opt.ts`, `src/viewer/geom.ts`,
  `src/viewer/assembly.ts`, `src/viewer/viewer.test.ts`.
- Commands or tests run:
  - `node --experimental-strip-types verify.ts` — the comparison harness.
  - `node --experimental-strip-types --test assy.test.ts` — 6 tests, 6 pass,
    0 fail.
- Verification evidence:
  - WITHDRAWN: the suspected multi-material `.opt` bug. Each of
    `1-2 Plywood.opt`, `1-4 Plywood.opt` and `3-4 Prefinished UV Plywood.opt`
    contains exactly ONE `<OptimizeMaterial>`. Mozaik writes one material per
    file. The `querySelector` / `querySelectorAll` mismatch cannot misfire on
    this data. A warning is now emitted if a file ever carries more than one.
  - CONFIRMED (fixed): material name. `<OptimizeMaterial>` carries `Name`, not
    `DisplayName`. Harness output: CURRENT `"3-4 Prefinished UV Plywood.opt"`
    vs FIXED `"3/4 Prefinished UV Plywood"`, for all three files.
  - CONFIRMED (fixed): assembly-label cross-matching. Distinct AssyNo values in
    the job: R1C1–R1C13, R2C1–R2C3. Harness output over 246 optimizer parts:
    - Room1.des cab 1 — CURRENT matched 114 parts from R1C1, R1C10, R1C11,
      R1C12, R1C13, R2C1. FIXED matches 25 parts from R1C1 only.
    - Room2.des cab 1 — CURRENT matched the same 114 parts, i.e. the room was
      ignored entirely. FIXED matches 25 parts from R2C1 only.
    - Room1.des cab 2 — CURRENT 18 parts from R1C2 and R2C2. FIXED 10 from R1C2.
  - REASSESSED UPWARD: XML thickness. `<CabProdPart>` has no `Thickness`
    attribute. Its real attributes are L, W, DisplayL, DisplayW, SUPartD, Type,
    Quan, X/Y/Z, A1-A3, R1-R3, Layer, Name, ReportName, Color, Comment,
    UsageType, Radius, RadAxis, SUPartName. Only `SUPartD` is ever usable, on
    8 of 122 parts (6.6%) in Room2.des. So thickness on a printed cut sheet is
    almost always an optimizer match or a hardcoded type default, not job data.
    The fuzzy match is the PRIMARY thickness path, not a fallback.
  - CHECKED, NO BUG: optimizer `Length`/`Width` match `.des` `L`/`W`, not
    `DisplayL`/`DisplayW` (45 of 60 sampled matched L/W, 0 matched Display).
    The dimensional half of the match is correct as written.
  - NOTED: `<OptimizeMaterial>` has no `RunId`, so every file merges into run 0
    and the run selector carries no information. Behavior unchanged.
- Decisions made: exact numeric matching replaces substring matching. An
  unparseable AssyNo is treated as not-ours — a missing label on a sheet is
  recoverable, a wrong one is not.
- Corrections or contradictions found: the 2026-09-15 18:40 entry's
  multi-material concern is superseded and must not be reopened. It was a
  correct reading of the code and a wrong prediction about the data.
- Current status: fixes committed to `chore/companion-scope-and-ci` (`3d21435`,
  `bb85d23`, `bb7f1ac`, `862f7be`) in PR #1. Not merged. CI still absent.
- Open items:
  - Commit sanitized fixtures under `test/fixtures/` and add parser-level tests.
    Blocked on a DOM shim: `parseDes` and `parseOpt` call `DOMParser`, which does
    not exist in Node, so no parser test can run under the current `npm test`.
    `linkedom` was used in the throwaway harness and is the obvious devDependency.
  - Printed sheets still do not mark a thickness that came from a type default.
    Given the 6.6% figure above this is now the highest-value remaining fix.
  - Examine a real job from the shared network drive once the path is supplied.
  - `npm run build` / `npm test` have NOT been run against the full repo in this
    session — the repo is private and no credential was available to clone it,
    either in the container or on the owner's machine. The six new tests were
    executed against a verbatim extract, not against the repo tree.
- Recommended next step: install CI (owner action), then add `linkedom` plus
  `test/fixtures/` and mark defaulted thicknesses on printed sheets.
- Authority classification: executed and verified for the two fixes; the
  withdrawal of the multi-material hypothesis is governing.
- Source conversation: session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: High for the two fixes — reproduced with counts
  against real job files and covered by passing tests. The full repo has not
  been typechecked or built in this session; `assembly.ts` was edited to follow
  the `assyMatches` signature change and that edit is unverified by compilation.
  Findings come from one job (`Sample Face Frame`); other jobs may label
  differently.
