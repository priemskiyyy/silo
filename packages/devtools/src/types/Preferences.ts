import type { PanelPosition } from "src/types/PanelPosition";

/** What survives a reload, in `localStorage` under the package name. */
export type Preferences = {
  isOpen?: boolean;
  position?: PanelPosition;
  height?: number;
  width?: number;
};
