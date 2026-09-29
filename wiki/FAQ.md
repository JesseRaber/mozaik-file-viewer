# Mozaik File Viewer FAQ

Short answers for shops evaluating a **local 3D cabinet job viewer** next to Mozaik Software.

[[Home]] · [[Getting-Started]] · [[Job-Files]] · [[Privacy-and-Security]]

## Product

**What is Mozaik File Viewer?**  
A browser app that opens a Mozaik Jobs folder on the same PC and shows 3D cabinets, face-frame sheets, box assembly sheets, construction parameters, and nested G-code. Files never leave the machine.

**Is it Mozaik Paperless Shop?**  
No. It is an independent MIT-licensed companion. It does not replace Mozaik, the optimizer, or a licensed Paperless Shop seat.

**Is it affiliated with Mozaik / Cyncly?**  
No.

## Files and formats

**Which files do I point it at?**  
The job folder that contains `*.des` / `*.sbk`, optional `*.opt`, `*-JobParms.dat`, `JobDat.dat`, and nested G-code. See [[Job-Files]].

**Can I drop a zip from the office?**  
Yes.

**Does it understand UTF-16 room files?**  
Yes. UTF-8 and UTF-16, BOM optional.

**Why is an `.sbk` ignored?**  
If `Room1.des` exists, `Room1.sbk` is skipped on purpose.

## Shop use

**Do I need the internet?**  
Only to clone or install npm packages the first time. Viewing a job is local.

**Which browser?**  
Chromium for folder access and recent jobs. Zip / file pick is more portable.

**Will it change my job?**  
No writer for `.des`, `.opt`, or G-code.

**Can I print a face-frame sheet?**  
Yes — the face-frame overlay is built for a printable title block. Confirm output on the shop printer before you retire a paper process.

## Technical

**What stack is the viewer?**  
Vanilla TypeScript in `src/viewer`, Three.js and JSZip from npm, Vite. No CDN. No React in the viewer.

**How do I run tests?**  
`npm test` runs `src/viewer/viewer.test.ts`.

**Where do I report a bad cabinet?**  
Open an issue on [JesseRaber/mozaik-file-viewer](https://github.com/JesseRaber/mozaik-file-viewer/issues) with the symptom and the file *types* involved. Do not attach customer job files to a public issue.
