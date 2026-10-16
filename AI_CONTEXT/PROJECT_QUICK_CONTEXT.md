# Companion viewer — current source status

Updated 2026-10-16. Owner confirmed companion-only scope; replacement development belongs in WoodWorx Paperless Shop.

The integration candidate includes both earlier PRs on clean main ancestry. It adds source-quantity grouping, exact/ambiguity-aware optimizer matching, guarded Paperless association, multi-material parsing, invalid-input rejection, documented G-code support and explicit rejection, folder drop, parameter category selection, sign-correct fractions, print preparation, locked dependencies and CI.

XML/stated thickness is retained when another source conflicts. Paperless overlays require matching job identity and one selected export; ambiguous/duplicate cabinet IDs are withheld. Default thicknesses remain visibly unverified. No machining is inferred from frame intersections. G-code shows one program with actual Z; unsupported commands withhold its preview.

Automated and browser checks are recorded in the coordinating project session. Source-only real-job smoke checks do not certify fabrication outputs. Complete known-good comparison, physical printing, NAS interruption/recovery and shop-device acceptance remain open. No production deployment is claimed.

Application CI is present at .github/workflows/ci.yml and installs with npm ci. Earlier journal statements that CI was not installed are historical and superseded. Dependency lockfile is committed with this candidate. Local job paths and customer data must not be added to commits.
