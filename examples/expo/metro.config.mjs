import { getDefaultConfig } from "expo/metro-config.js";
import { withUniwindConfig } from "uniwind/metro";

export default withUniwindConfig(getDefaultConfig(import.meta.dirname), {
  cssEntryFile: "./src/global.css",
  dtsFile: "./.expo/uniwind-types.d.ts",
});
