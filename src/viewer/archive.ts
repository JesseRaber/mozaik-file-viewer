import JSZip from "jszip";
export const IMPORT_LIMITS = { files: 2048, fileBytes: 32 * 1024 * 1024, totalBytes: 256 * 1024 * 1024, archiveBytes: 64 * 1024 * 1024 };
export function safeImportPath(path: string): void {
  const p = path.replace(/\\/g, "/");
  if (!p || p.startsWith("/") || /^[a-z]:/i.test(p) || p.split("/").some(x => x === "..") || /[\x00-\x1f]/.test(p))
    throw new Error("Unsafe import path; archive rejected");
}
export async function openArchive(raw: ArrayBuffer): Promise<JSZip> {
  if (raw.byteLength > IMPORT_LIMITS.archiveBytes) throw new Error("Archive exceeds 64 MiB limit");
  const zip = await JSZip.loadAsync(raw);
  const entries = Object.values(zip.files);
  if (entries.length > IMPORT_LIMITS.files) throw new Error("Archive exceeds file-count limit");
  let total = 0;
  for (const e of entries) {
    safeImportPath(e.name);
    safeImportPath((e as JSZip.JSZipObject & {unsafeOriginalName?: string}).unsafeOriginalName || e.name);
    // JSZip retains central-directory sizes. Check before inflation, then enforce actual streamed bytes too.
    const size = (e as unknown as {_data?: {uncompressedSize?: number}})._data?.uncompressedSize || 0;
    total += size;
    if (size > IMPORT_LIMITS.fileBytes || total > IMPORT_LIMITS.totalBytes) throw new Error("Archive expansion exceeds size limit");
  }
  return zip;
}
export function readArchiveEntry(e: JSZip.JSZipObject): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []; let bytes = 0; let failed = false;
    const stream = (e as unknown as {internalStream(type: "uint8array"): {
      on(event: "data", callback: (chunk: Uint8Array) => void): any;
      on(event: "error" | "end", callback: (...args: any[]) => void): any;
      pause(): void; resume(): void;
    }}).internalStream("uint8array");
    stream.on("data", chunk => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > IMPORT_LIMITS.fileBytes) { failed = true; stream.pause(); reject(new Error("Expanded file exceeds 32 MiB limit")); return; }
      chunks.push(chunk);
    }).on("error", reject).on("end", () => {
      if (failed) return;
      const out = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) {out.set(chunk, offset); offset += chunk.length;}
      resolve(out.buffer);
    }).resume();
  });
}
