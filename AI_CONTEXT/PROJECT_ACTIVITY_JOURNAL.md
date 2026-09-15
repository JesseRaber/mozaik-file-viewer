# Project Activity Journal — Mozaik File Viewer

Append-only. Chronological. Newest at the bottom.

---

## 2026-09-15 18:40 - Production-readiness scan of repo and project folder

- User objective: Determine whether this app is ready to replace Mozaik
  Paperless Shop in production.
- Work performed: Read repo source via the GitHub connector (`README.md`,
  `package.json`, `src/viewer/fs.ts`, `store.ts`, `ui.ts`, `assembly.ts`,
  `geom.ts`, `parse/load.ts`, `parse/des.ts`, `parse/opt.ts`,
  `viewer.test.ts`). Listed branches, releases, commits. Scanned the local
  folder `Downloads\Mozaik File Viewer`. Researched Paperless Shop's feature
  set from vendor press coverage.
- Result: Not production-ready as a replacement. Category gap, not a polish gap.
- Files created: none. Files modified: none.
- Commands or tests run: none. The repo was read, not cloned; no build or test
  was executed.
- Verification evidence:
  - HEAD `b6f1cb16`, 3 commits all dated 2026-09-08, no releases, no `.github/`.
  - `viewer.test.ts` has 4 tests, all against `buildDemoJob()` or inline G-code.
  - `store.ts` `AppState` has no completion field; `setJob()` resets all state.
  - `assembly.ts` `rows()` skips `Hardware`, `Doors & fronts`, `Face frame`.
  - `parse/opt.ts` `querySelector("OptimizeMaterial")` vs
    `querySelectorAll("OptimizePart")`.
  - README states "Not a Mozaik replacement" verbatim.
- Decisions made: none this turn.
- Corrections or contradictions found: the Project description claimed a
  Paperless Shop replacement; the README and the code both contradict it. The
  strongest evidence is the code.
- Current status: assessment complete.
- Open items: fixtures, opt.ts verification, part-matching, CI, scope decision.
- Recommended next step: owner decides companion vs. replacement.
- Authority classification: research finding, non-governing.
- Source conversation: Claude Code session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: high on feature-gap and maturity findings (direct
  code and Git evidence); medium on parser-correctness risks, which were read
  from source and not executed against real job files.

---

## 2026-09-15 19:10 - Owner scope decision; governance files added

- User objective: Proceed as a companion viewer; use the repo app only; retire
  the beta HTML; carry out the fixture, parser, and CI work.
- Work performed: Recorded the scope decision in `PROJECT_ROADMAP_STATUS.md`.
  Created `AI_CONTEXT/README_FIRST.md`, `PROJECT_QUICK_CONTEXT.md`, and this
  journal on branch `chore/companion-scope-and-ci`. Quarantined the retired
  beta HTML on the owner's machine.
- Result: Scope and product line are now recorded in-repo. CI could NOT be
  added — see Failed below.
- Files created: `PROJECT_ROADMAP_STATUS.md`, `AI_CONTEXT/README_FIRST.md`,
  `AI_CONTEXT/PROJECT_QUICK_CONTEXT.md`, `AI_CONTEXT/PROJECT_ACTIVITY_JOURNAL.md`.
- Files modified: none.
- Commands or tests run: `mkdir` and `mv -n` on the owner's machine to
  quarantine the beta app. No build or test was run.
- Verification evidence:
  - Owner wording, verbatim: "Companion Viewer"; "We are using the repo app";
    "I don't want any code from the HTML app copied to the new repo app";
    "you can kill the html beta app."
  - Branch `chore/companion-scope-and-ci` created from `b6f1cb16`; commits
    `6ceca71`, `0c13ee1`, `1f8fbb9` and this one.
  - Post-move listing of `Downloads\Mozaik File Viewer` shows
    `_to_delete/Cabinet_Job_Viewer_Beta_1.0(12).html` and
    `_to_delete/beta-duplicates/` containing the two nested copies.
- Decisions made (owner, approved): companion-viewer scope; the repo app is the
  only product line; the beta HTML is retired and its code excluded from the repo.
- Failed:
  - Committing `.github/workflows/ci.yml` — the GitHub connector returned
    `403 Resource not accessible by integration`. It has contents write but not
    the `workflows` permission. CI is NOT installed. The owner must add the file.
  - Deleting the beta HTML outright — the session's delete permission was
    denied. The files were moved to `_to_delete/` instead and still exist.
- Corrections or contradictions found: none new.
- Current status: governance and scope in an open pull request, not merged. CI
  absent. Fixture and parser work blocked on real job files.
- Open items: real-job fixtures; `parse/opt.ts` multi-material verification;
  part-matching hardening; printed-sheet marking of defaulted values; CI install.
- Recommended next step: obtain one shipped job folder, sanitize it, commit it
  under `test/fixtures/`, then fix the parsers against it.
- Authority classification: owner decision — approved and governing for scope.
  Docs: executed, pending merge. CI: failed, not executed.
- Source conversation: Claude Code session `session_015mqEnJkzC2HJWaP4ya7BhB`.
- Confidence and limitations: High. The beta-app quarantine is a move, not a
  delete — the files still exist under `_to_delete/`. No CI run has been
  observed because CI does not exist yet.
