# Project Roadmap and Status

Authority file. Owner-approved scope lives here. Last updated 2026-09-15.

## Scope decision (owner, 2026-09-15)

This project is a **companion viewer** for Mozaik Paperless Shop, not a replacement.

The owner considered and declined a full Paperless Shop replacement on grounds of
timeline. A replacement would require persistent per-part completion state,
multi-tablet synchronization, and label printing with printed-state tracking —
none of which exist today and none of which are in scope.

## Product line

**The repo app is the only product line.**

The single-file `Cabinet_Job_Viewer_Beta_1.0(12).html` is retired. It was a
reference artifact only. No code from it is to be copied into this repo; the
repo app was rebuilt from scratch and stays that way.

## In scope

- Read-only viewing of Mozaik job folders: 3D cabinet, face-frame cut sheet,
  box assembly sheet, construction parameters, G-code preflight.
- Printing those sheets.
- Correctness of what is displayed and printed.

## Out of scope

- Writing `.des` files or any write-back to job data.
- Nesting or optimization.
- Mozaik license interaction.
- Per-part completion tracking, progress state, multi-device sync.
- Label printing and printed-state tracking.

## Current status

Pre-release. Version 0.1.0. Not yet piloted on a shop floor.

## Release gate

Before any shop-floor pilot, all of the following must hold:

1. Real-job fixtures (`.des`, `.opt`, `-JobParms.dat`) committed under
   `test/fixtures/` with tests asserting parsed dimensions, thickness, and
   optimizer label matching against known-good values.
2. CI green on typecheck, test, and build.
3. `src/viewer/parse/opt.ts` multi-material behavior verified against a real
   multi-material optimizer file.
4. Optimizer-to-part matching no longer able to place a wrong thickness
   silently on a printed cut sheet.
5. Printed sheets visibly mark any dimension or thickness that came from a
   default rather than from job data.

## Known open risks

See `AI_CONTEXT/PROJECT_QUICK_CONTEXT.md` for the current list with evidence.
