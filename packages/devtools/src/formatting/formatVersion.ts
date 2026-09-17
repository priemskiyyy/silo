import type { SiloSnapshot } from "@priemskiyyy/silo";

export const formatVersion = (version: SiloSnapshot["version"]) => {
  if (version.declared === 0) {
    return "no migrations";
  }

  if (version.stored === null) {
    return `reading, ${version.declared} declared`;
  }

  return `v${version.stored} of ${version.declared}`;
};
