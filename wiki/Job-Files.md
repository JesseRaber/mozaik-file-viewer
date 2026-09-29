# Mozaik Job Files the Viewer Reads

Mozaik File Viewer is a **local 3D cabinet job viewer**. It reads the files a shop already has on disk after designing the job in Mozaik Software. It does not write those files.

Back to [[Home]] · [[Getting-Started]]

## File map

| File | Role in the viewer |
| --- | --- |
| `*.des` | Primary room XML |
| `*.sbk` | Room XML used when no matching `.des` exists |
| `*.opt` | Optimizer labels and material thickness |
| `*-JobParms.dat` | Construction parameter libraries |
| `JobDat.dat` | `<CustomerName>` for the title block / job header |
| `.nc` `.tap` `.gcode` `.gc` `.cnc` `.mmg` `.bpp` `.anc` `.xxl` `.ngc` | Nested G-code |
| `.txt` | Treated as G-code only when the head looks like Mozaik / Fanuc output |

Room XML may be UTF-8 or UTF-16. A BOM is optional.

## Load order (what the parser actually does)

1. Walk the picked folder, the dropped files, or the unzipped `.zip`.
2. Read `JobDat.dat` for customer name.
3. Parse every `.opt` into optimizer runs; merge materials.
4. Parse `.des` rooms. Add `.sbk` rooms only when the same base name is not already present as `.des`.
5. Sniff `.txt` heads for `Mozaik Output`, `G20`/`G21`/`G90`, and motion words; promote matches to CNC.
6. Parse `*-JobParms.dat`.
7. Sort rooms by file name (numeric aware).
8. If zero rooms remain, throw. Warnings from other files are included in the error text.
9. Apply optimizer thickness to parts that did not already take thickness from XML.

## Thickness resolution

1. XML attributes on the part (`Thickness`, `Thick`, `T`, `MatThick`, and related names in the parser)
2. Optimizer material whose parts match **name and size** (not only `RoomN.des`)
3. Type defaults — ¾″ case, ½″ back, and similar built-in fallbacks

Parts that already have `thicknessSource === "xml"` are not overwritten by the optimizer pass.

## 3D drawing rules worth knowing

- Shaker / door panels draw only when the room stores door-style rails **and** those rails leave a real opening.
- Hardware typed `Metal` is rendered.
- Unknown part types become generic extruded solids. They are not dropped.
- Load warnings stay in the sidebar.
- Part meshes are disposed when you change cabinets so WebGL memory does not leak across a room.

## What is not read

The viewer does not need a live Mozaik install, a license file, or the product library editor. Library geometry that was never written into the room XML cannot be invented at view time.

## Related

- Repo README file table: [README.md](https://github.com/JesseRaber/mozaik-file-viewer/blob/main/README.md)
- [[Privacy-and-Security]]
- [[FAQ]]
