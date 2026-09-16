# Paperless Shop export format

Evidence file. Observed 2026-09-16 from `U:\Paperless Shop` on the shop's
network drive. Not an authority document; not a specification from Mozaik.
Everything here was read off two real exports — `Krebs (Victoria) Run 1` and
`WoodWorx Test Run 1` — and may not generalize.

Produced by "export to apps" in Mozaik Software.

## Layout of `U:\Paperless Shop`

Per job, per run, **per target device**:

| File | Consumer |
| --- | --- |
| `<Job>-<Run>-<Device>.mzkcut` | Cutlist App |
| `<Job>-<Run>-<Device>.mzkasy` | Assembly App |
| `<Job> - <Run>-<Device>.mzklbl` | Label App (note the spaces around the dash) |
| `<Job>-<Run>-CutlistStatus.xml` | progress write-back |
| `<Job>-<Run>-AssemblyStatus.xml` | progress write-back |
| `<Job>-<Run>-LabelStatus.xml` | progress write-back |

Device names seen: `X1-Tablet`, `UW-P52Laptop`, `Tiny-Spare`. The export names
both ends — `TargetCpuDisplayName` and `GeneratorCpuCpuName` — so a job is
built for a specific tablet.

Subfolders `Assembly and Cutlist Apps\` and `Label App\` each hold `Jobs\`,
`Templates\` and `LabelSettings.xml`.

## The `.mzk*` files are ZIP archives

All three start with `PK\x03\x04`. The viewer already depends on JSZip, so no
new dependency is needed to read them.

### `.mzklbl` — Label App
```
Images/
LabelData.xml
```

### `.mzkcut` — Cutlist App
```
AppData.xml            (~7.6 MB on Krebs)
ManifestData.xml
Images/DXFImages/DXFImage<N>.jpg
Images/Pictures/3D <N>.png
```

### `.mzkasy` — Assembly App
```
AppData.xml            (~7.8 MB on Krebs)
ManifestData.xml
Images/Attachments/
Images/CabGeo/<CabName>(<n>)(<cab>)Face.dat
Images/CabGeo/<CabName>(<n>)(<cab>)Wire.dat
Images/DXFImages/..., Images/Pictures/...
```

`ManifestData.xml` carries the authoritative room and cabinet index:

```xml
<AssemblyCutlistData JobName="…" RunName="Run 1" HasCutlistData="False"
                     HasAssemblyData="True" Inches="True" UseFractions="True">
  <Room RoomNumber="1" RoomName="Order Entry" />
  <Room RoomNumber="2" RoomName="Living Room">
    <ProductSpace Name="Wall #1" Number="1_1">
      <Cabinet UniqueID="13956211_1" CabNumber="1" CabNumbered="True" Name="Base FH Door" />
      …
```

`AppData.xml` holds `CasePartsListItem`, `FrameListItem`, `HardwareListItem`,
`JobParameter` / `JobParameterCategory`, `Setting`, `JobNotesField`, and the
shop drawings as `Line` / `Text` / `Circle` primitives.

## Status files — how progress is tracked

Plain XML on the share. With no progress recorded, a status file is just its
header:

```xml
<JobData JobName="Krebs (Victoria)" JobAbbr="" RunName="Run 1"
         JobCreationDate="6/10/2025 5:28:41 AM" Version="1" />
```

Once work happens, per-part state is written into it:

```xml
<Mat Index="UV1 Plywood (1/2)">
  <Part Index="1" Printed="True" />
</Mat>
```

**The sync substrate is a shared folder, not a server.** This matters for any
future decision about progress tracking in this viewer.

## `LabelData` — richer than the raw job files

`<Job>-<Run>-LabelStatus.xml` embeds the full nested-sheet data:

```xml
<LabelData Inches="True" UseFractions="True" …>
  <Material Name="Cherry Plywood (1/2)" Abbr="" Thickness="11.938">
    <Sheet ID="1" W="1231.9" L="2451.1" Rot="0" Area="3019510.09" Quan="1"
           PatternNum="1" GcodeFilename="…TAP" DxfFilename="">
      <Part Name="UBack" ID="1" W="891.218" L="2363.787" X="3.2" Y="337.5"
            Rot="0" Comment="Unfinished Back" EdgeBand="None" Color="None"
            AssyNo="R1C2" CabName="Open Bookcase" RoomName="Living Room"
            PartNo="1" ShorthandName="UB" BandTempSymbol="A" IsRemnant="False">
```

This supplies, already resolved, four things the viewer currently infers from
`.des` and `.opt`:

1. **`Thickness` per material** — the viewer finds a usable thickness on only
   6.6% of `<CabProdPart>` elements and guesses the rest.
2. **`CabName` and `RoomName` on every part** — no AssyNo parsing needed.
3. **Sheet nesting positions** (`X`, `Y`, `Rot`) and `GcodeFilename`, linking a
   sheet to its `.TAP`.
4. **Edge banding** (`EdgeBand`, `BandTempSymbol`), which the viewer ignores.

## AssyNo numbering — verified

`AssyNo` is `R<n>C<m>` where **`<n>` is the `.des` file number, not the
manifest `RoomNumber`.**

Krebs (Victoria), cross-checked between the job folder and the label export:

| `.des` file | Room name | Manifest `RoomNumber` | AssyNo prefix |
| --- | --- | --- | --- |
| `Room0.des` | Order Entry (no cabinets) | 1 | — |
| `Room1.des` | Living Room | 2 | `R1` |
| `Room2.des` | Door Test | 3 | — |

So the manifest is 1-based over all rooms including empty ones, while AssyNo
follows the file name. `roomNumber()` in `src/viewer/geom.ts` parses the file
name and therefore agrees with AssyNo. Confirmed on a production job, not only
on Mozaik's samples.

## Known hazard: duplicate cabinet numbers within one room

`Krebs (Victoria)\Room1.des` has `CabNo` values
`1, 5, 2, 4, 3, 7, 6, 1, 2` — cabinets **1 and 2 appear twice in the same
room**. Exact `R<room>C<cab>` matching cannot tell those two apart, so both
products will claim the same labels.

`ManifestData.xml` disambiguates them with `ProductSpace` (`Wall #1`,
`Number="1_1"`) and `Cabinet UniqueID`. The `.des` files carry a
`Product UniqueID` too. Resolving this properly means keying on UniqueID rather
than on `CabNo`. **Open, not fixed.**
