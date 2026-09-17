import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  // The node platform defaults to `.mjs`, and the package exports name `.js`.
  fixedExtension: false,
  dts: true,
  clean: true,
  sourcemap: true,
});
