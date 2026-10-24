import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
const identity = { version, revision, dirty };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __SOURCE_REVISION__: JSON.stringify(revision + (dirty ? "-dirty" : "")) },
  plugins: [{ name: "candidate-identity", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify(identity, null, 2) + "\n" }); } }],
  server: { host: "127.0.0.1", port: 5173 },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"], archives: ["jszip"] } } } },
  preview: { host: "127.0.0.1", port: 4173 },
});
