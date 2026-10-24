# Mozaik File Viewer local beta

Local read-only reference viewer, independent of Mozaik Software. Not a verified cutlist or machining approval. No job files are uploaded or written back. This beta is not production/shop acceptance.

Requires Windows, Edge with WebGL, and Python 3.10 or later installed by your normal trusted process. Python is not bundled. No Node/npm, account, administrator rights, pip packages or installation required to run this package. Extract the entire ZIP first; do not open site/index.html directly.

From the extracted folder run:

    py -3 Launch-Viewer.py

Or use your installed Python executable. The launcher checks every packaged file, serves only site/ on 127.0.0.1:4187, and opens the browser. Keep its console running. Stop with Ctrl+C. If the port is occupied, close your previous Viewer instance or choose --port 4188; another port has separate browser preferences/recent handles. --no-browser leaves browser launch to you. This is a loopback preview, not an installed PWA, Windows installer or hosted service. Do not expose it to the LAN.

Open job folder, Files / zip, or Load demo cabinet. Room/cabinet controls select the source snapshot; use Box assembly sheet / Face frame sheet / Construction parameters for reference. Keyboard Tab/Shift+Tab navigate; Escape closes a sheet/menu. PDF export uses the browser print route with Letter landscape; inspect every page. Physical printing is not qualified here.

The sidebar reports version and source commit; site/version.json records the full identity. SHA256SUMS.txt detects missing/changed files relative to this manifest; it is not a digital signature or independent proof of publisher authenticity. Use a trusted delivery/hash source.

Job data is parsed in the browser. IndexedDB stores permitted folder handles/recent names; localStorage stores unit/title/color preferences (job/customer title overrides are not persisted). Reopen the intended source revision; this is not a live NAS monitor or autosaved job database. File picker cancellation/errors preserve the prior job. A closed browser needs the same files/permission again. External internet is unnecessary after extraction, but the launcher must remain running.

For update/rollback, retain the old extracted package unchanged, stop its launcher, launch the new/old package at the same port, reload and verify version/commit, then reopen the same source. Preferences are browser/origin-local; clearing browser storage removes them. No source job migration occurs. Permission loss requires Open job folder again. On graphics failure check Edge/WebGL and reload; source files are unchanged.

Known scope limits: source geometry can differ from Mozaik exports (including appliance-adjacent conditions and export-only parts), thickness may be defaulted, labels/banding may be withheld, and ambiguous mappings are not guessed. Verify quantities and units. Actual shop G-code using unsupported macros/offsets remains refused. No CNC output, native job editing, controller action or fabrication approval. Phone/tablet, NAS/full-shift, novice/operator and physical printer acceptance remain unverified.
