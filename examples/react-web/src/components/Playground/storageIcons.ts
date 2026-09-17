import {
  ArrowsLeftRight,
  Browser,
  CloudArrowUp,
  Cookie,
  Cpu,
  Database,
  HardDrive,
  Link,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { PlaygroundStorage } from "src/silo/playground";

export const STORAGE_ICONS: Record<PlaygroundStorage, Icon> = {
  memory: Cpu,
  default: HardDrive,
  session: Browser,
  journal: Database,
  preferences: Cookie,
  url: Link,
  shared: ArrowsLeftRight,
  remote: CloudArrowUp,
};
