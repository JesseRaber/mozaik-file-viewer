# Test fixtures

Real files from a real shop, not hand-written samples. Anything added here must
be sanitized first — job folders and exports carry customer names and machine
identifiers.

## `WoodWorxTest-Run1-LabelStatus.xml`

Provenance: `U:\Paperless Shop\WoodWorx Test-Run 1-LabelStatus.xml`, produced by
"export to apps" in Mozaik Software on 2024-08-27. An internal test job, so it
names no customer.

Changed from the original:

- `TargetCpuId` → `SCRUBBED-TARGET-ID`
- `GeneratorCpuId` → `SCRUBBED-GENERATOR-ID`
- `CreatedBy` → `Fixture`
- Every `<Shape>` and `<Operations>` subtree removed. Nothing in the viewer
  reads per-part geometry or toolpaths today, and they were roughly 90% of the
  file (38,441 → 3,374 bytes).

Everything the parser reads is byte-for-byte as Mozaik wrote it: the
`<LabelData>` header, both `<Material>` elements with their stated thicknesses,
the sheets, and all nine `<Part>` elements.

What makes it a useful fixture:

- **Stated thicknesses that no default would produce** — 11.938 and 11.4808 mm,
  where the type defaults guess 12.7 mm for ½" stock.
- **Two sheet remnants** (`IsRemnant="True"`), which must never reach a cut list.
- **Recorded progress** — `<Mat Index="…"><Part Index="1" Printed="True" /></Mat>`
  blocks sitting outside `<LabelData>`. These are how Paperless Shop tracks
  which labels have been printed, and they must never be parsed as cabinet parts.
  The file has nine `<Part>` elements: seven inside `<LabelData>` (two of them
  remnants) and two progress records.
- **The `R<room>N<cab>` AssyNo variant** (`R4N1`) rather than the `R<room>C<cab>`
  form seen on other jobs.
