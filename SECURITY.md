# Security

Mozaik File Viewer is a **local, read-only** companion. It is not affiliated with Mozaik Software.

## Data

- Job files are parsed in the browser. They are not posted to a server.
- Chromium File System Access handles may be stored in IndexedDB (`mfv-fs`) so recent jobs can be reopened.
- Unit, title-block, and part-color preferences live in `localStorage` (`mfv_unit`, `mfv_title`, `mfv_colors`).
- No credentials, customer files, or shop data should be sent to cloud tools from this app.

## Rendering

- DOM nodes for job data use `textContent` / attributes. Job XML is not assigned to `innerHTML`.
- Print output clones already-built DOM (or a canvas data URL) into a hidden iframe.

## Unknown parts

Unknown part types render as generic extruded solids. They are not dropped silently. Load warnings are shown in the sidebar, not swallowed.
