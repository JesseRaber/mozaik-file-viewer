import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5173 },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"], archives: ["jszip"] } } } },
  preview: { host: "127.0.0.1", port: 4173 },
});
