# Mozaik File Viewer (Windows beta)

Local read-only reference viewer, independent of Mozaik Software. Not a verified cutlist or machining approval. No job files are uploaded or written back. This beta is not production/shop acceptance.

Works on Windows 10 or 11 (64-bit) with Microsoft Edge. Python is included in this package (`runtime/`), so nothing else needs to be installed, and no administrator rights are needed.

## Install

1. Right-click the ZIP and choose **Extract All**. Do not run anything from inside the ZIP.
2. In the extracted folder, double-click **Install**.
3. Start the viewer from **Start Menu > Mozaik File Viewer** (or the desktop shortcut). It opens in your browser at `http://127.0.0.1:4187/`.

Install copies this version to `%LOCALAPPDATA%\Programs\MozaikFileViewer\<version>\` and creates the Start Menu and desktop shortcuts. It is for the current Windows user only. It writes nothing to Program Files or the registry and changes no system setting. After installing, the extracted folder can be deleted.

To try it without installing, double-click **Start-Viewer** in the extracted folder.

## "Unknown publisher" and other warnings

This package is not code-signed. Windows may show "Windows protected your PC" (SmartScreen) or an "Unknown publisher" / "Open File - Security Warning" prompt when you run Install or Start-Viewer from a downloaded ZIP. That warning only means the files are not signed by a known publisher; it does not mean a virus was found. Continue only if the ZIP came from Unique WoodWorx and its SHA-256 matches the one you were given (in PowerShell: `Get-FileHash <zip>`). In SmartScreen, choose **More info**, then **Run anyway**. Install clears the "downloaded from the internet" mark on the files it installs, so the Start Menu shortcut does not prompt again.

## Using it

The viewer runs in a small window that starts minimized on the taskbar ("Mozaik File Viewer"). Keep it open while you use the viewer; close it to stop the viewer. Starting the viewer again while it is running just opens the browser to the running copy.

Open job folder, Files / zip, or Load demo cabinet. Room/cabinet controls select the source snapshot; use Box assembly sheet / Face frame sheet / Construction parameters for reference. Cutlist check adds Mozaik's cutlist export (.mzkcut) and shows, per cabinet, where it agrees or differs with the loaded job; labels and banding are not checked. Keyboard Tab/Shift+Tab navigate; Escape closes a sheet/menu. PDF export uses the browser print route with Letter landscape; inspect every page. Physical printing is not qualified here.

The sidebar reports version and source commit; site/version.json records the full identity. On every start the launcher checks every packaged file, including `runtime/`, against SHA256SUMS.txt and refuses to start if anything is missing, changed or added. SHA256SUMS.txt is not a digital signature or independent proof of publisher authenticity; use a trusted delivery/hash source.

The launcher serves only site/ on 127.0.0.1:4187 (this computer only). `Start-Viewer.cmd --port 4188` uses another port, but browser preferences and folder permissions are tied to the port, so keep 4187. `--no-browser` leaves browser launch to you. This is a loopback viewer, not a hosted service. Do not expose it to the LAN.

## Upgrade, rollback and uninstall

- **Upgrade:** extract the new version's ZIP and run its Install. Versions install side by side; the shortcuts move to the version you installed last. Browser preferences and folder permissions carry over because the address stays `127.0.0.1:4187`.
- **Rollback:** run Install from the older version's extracted folder (or from `%LOCALAPPDATA%\Programs\MozaikFileViewer\<older version>\`). The shortcuts point back to it. Close the viewer window first, then reload the browser and check the version in the sidebar.
- **Uninstall:** close the viewer window, then run **Uninstall** from the extracted folder or from the installed version's folder. It removes that version's folder and its shortcuts; if another version is still installed, the shortcuts switch to the newest one. It never touches browser data, preferences or job files.
- Package 0.3.0-beta.1 and earlier have no installer: run them with `py -3 Launch-Viewer.py` (Python 3.10+ required) from their extracted folder.

## Data and limits

Job data is parsed in the browser. IndexedDB stores permitted folder handles/recent names; localStorage stores unit/title/color preferences (job/customer title overrides are not persisted). Reopen the intended source revision; this is not a live NAS monitor or autosaved job database. File picker cancellation/errors preserve the prior job. A closed browser needs the same files/permission again. External internet is unnecessary after extraction. Preferences are browser/origin-local; clearing browser storage removes them. No source job migration occurs. Permission loss requires Open job folder again. On graphics failure check Edge/WebGL and reload; source files are unchanged.

Known scope limits: source geometry can differ from Mozaik exports (including appliance-adjacent conditions and export-only parts), thickness may be defaulted, labels/banding may be withheld, and ambiguous mappings are not guessed. Verify quantities and units. Actual shop G-code using unsupported macros/offsets remains refused. No CNC output, native job editing, controller action or fabrication approval. Phone/tablet, NAS/full-shift, novice/operator and physical printer acceptance remain unverified.

Third-party licenses, including the Python Software Foundation license for `runtime/`, are in THIRD-PARTY-NOTICES/.
