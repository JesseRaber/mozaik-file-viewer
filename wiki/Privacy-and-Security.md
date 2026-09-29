# Privacy and Security

Mozaik File Viewer is a **local, read-only companion** for Mozaik cabinet jobs. Job files are parsed in the browser. They are not posted to a server.

This page restates the published [SECURITY.md](https://github.com/JesseRaber/mozaik-file-viewer/blob/main/SECURITY.md). Back to [[Home]].

## Data that stays on the machine

- **Job bytes** — `.des`, `.sbk`, `.opt`, JobParms, G-code. Read, never uploaded, never written back.
- **IndexedDB `mfv-fs`** — Chromium File System Access *handles* so **Recent jobs** can reopen a folder you already granted. Handles are not copies of the job.
- **localStorage**
  - `mfv_unit` — inch or mm
  - `mfv_title` — title-block fields
  - `mfv_colors` — layer colors

No credentials belong in this app. Do not paste customer files, API keys, or shop notes into cloud tools from the viewer session.

## Rendering and print

- Job strings go into the DOM with `textContent` / attributes.
- Job XML is not assigned to `innerHTML`.
- Print clones already-built DOM (or a canvas data URL) into a hidden iframe.

## Unknown geometry

Unknown part types render as generic extruded solids. They are not omitted. Warnings stay visible in the sidebar.

## Threat model (shop-sized)

| Risk | Mitigation in this design |
| --- | --- |
| Job leaves the building through the viewer | No upload path; local parse only |
| XSS from hostile job XML | No `innerHTML` of job text |
| Stale WebGL meshes after switching cabinets | Geometry disposed on cabinet change |
| Accidental edit of the Mozaik job | Read-only; no `.des` writer |

This is not a formal audit report. Source of truth is the repo on `main`.

## Affiliation

Not affiliated with, endorsed by, or a product of Mozaik Software or Cyncly. Mozaik® remains their mark.
