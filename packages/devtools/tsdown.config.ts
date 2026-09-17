import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

// Vite builds the core bundle first; tsdown adds its declarations and builds the wrapper.
const wrapper: UserConfig = {
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  clean: false,
  sourcemap: true,
  external: ["@priemskiyyy/silo-devtools"],
};

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    platform: "neutral",
    dts: { emitDtsOnly: true },
    clean: false,
  },
  // Amendment A8: a top-level `banner` reaches the declarations too, where a
  // directive is TS1036 for every consumer without skipLibCheck.
  {
    ...wrapper,
    entry: { react: "src/react.ts" },
    outputOptions: { banner: '"use client";' },
  },
]);
