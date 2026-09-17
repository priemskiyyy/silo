import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dist = (file: string) =>
  fileURLToPath(new URL(`../../../../${file}`, import.meta.url));

// The fixture runs against the BUILT packages, not the sources: what these
// tests prove is how the published output behaves in a real engine.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  cacheDir: dist("node_modules/.vite/browser"),
  resolve: {
    alias: {
      "@priemskiyyy/silo-local-storage": dist(
        "packages/adapters/local-storage/dist/index.js",
      ),
      "@priemskiyyy/silo-session-storage": dist(
        "packages/adapters/session-storage/dist/index.js",
      ),
      "@priemskiyyy/silo-indexeddb": dist(
        "packages/adapters/indexeddb/dist/index.js",
      ),
      "@priemskiyyy/silo": dist("packages/core/dist/index.js"),
    },
  },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
