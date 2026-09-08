import { filesToItems, loadItems, walkHandle } from "./parse/load";
import { setJob } from "./store";
import type { FileItem } from "./types";

type Recent = { name: string; handle: FileSystemDirectoryHandle; ts: number };

type DirPickerOpts = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle;
};

const db = {
  open() {
    return new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("mfv-fs", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get<T>(k: string): Promise<T | undefined> {
    const d = await this.open();
    return new Promise((res) => {
      const t = d.transaction("kv").objectStore("kv").get(k);
      t.onsuccess = () => res(t.result as T);
      t.onerror = () => res(undefined);
    });
  },
  async set(k: string, v: unknown) {
    const d = await this.open();
    return new Promise<void>((res) => {
      const t = d.transaction("kv", "readwrite");
      t.objectStore("kv").put(v, k);
      t.oncomplete = () => res();
      t.onerror = () => res();
    });
  },
};

async function perm(h: FileSystemDirectoryHandle) {
  try {
    const handle = h as FileSystemDirectoryHandle & {
      queryPermission?: (d: { mode: "read" }) => Promise<PermissionState>;
      requestPermission?: (d: { mode: "read" }) => Promise<PermissionState>;
    };
    if (typeof handle.queryPermission === "function") {
      const q = await handle.queryPermission({ mode: "read" });
      if (q === "granted") return true;
      if (typeof handle.requestPermission === "function") {
        return (await handle.requestPermission({ mode: "read" })) === "granted";
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadFromHandle(dir: FileSystemDirectoryHandle) {
  const items: FileItem[] = [];
  await walkHandle(dir, `${dir.name}/`, items);
  const job = await loadItems(items);
  setJob(job);
  try {
    let rec = (await db.get<Recent[]>("recent")) || [];
    rec = rec.filter((r) => r.name !== dir.name);
    rec.unshift({ name: dir.name, handle: dir, ts: Date.now() });
    await db.set("recent", rec.slice(0, 6));
  } catch {
    /* ignore */
  }
  return job;
}

export async function openJobFolder(): Promise<void> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts?: DirPickerOpts) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (picker) {
    try {
      const root = await db.get<FileSystemDirectoryHandle>("jobsRoot");
      const opts: DirPickerOpts = { id: "mfvJobs", mode: "read" };
      if (root) opts.startIn = root;
      const dir = await picker(opts);
      await loadFromHandle(dir);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.setAttribute("webkitdirectory", "");
  input.onchange = async () => {
    if (!input.files?.length) return;
    const job = await loadItems(await filesToItems([...input.files]));
    setJob(job);
  };
  input.click();
}

export async function openFiles() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".des,.sbk,.zip,.dat,.opt,.txt,.nc,.tap,.gcode,.ngc,.cnc";
  input.onchange = async () => {
    if (!input.files?.length) return;
    const job = await loadItems(await filesToItems([...input.files]));
    setJob(job);
  };
  input.click();
}

export async function setJobsRoot() {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts?: DirPickerOpts) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) return;
  try {
    const dir = await picker({ id: "mfvJobsRoot", mode: "read" });
    await db.set("jobsRoot", dir);
  } catch {
    /* cancel */
  }
}

export async function recentJobs(): Promise<Recent[]> {
  try {
    return (await db.get<Recent[]>("recent")) || [];
  } catch {
    return [];
  }
}

export async function openRecent(r: Recent) {
  if (await perm(r.handle)) await loadFromHandle(r.handle);
}

export { db };
