import type { SiloStatus } from "src/types/SiloStatus";
import type { ValueStatus } from "src/types/ValueStatus";

// Interned: ValueStore dedupes with Object.is, so a fresh { state: "ready" }
// on every write would notify every status listener on every write.
export const HYDRATING_VALUE_STATUS = {
  state: "hydrating",
} satisfies ValueStatus;

export const READY_VALUE_STATUS = { state: "ready" } satisfies ValueStatus;

export const MIGRATING_SILO_STATUS = {
  state: "migrating",
} satisfies SiloStatus;

export const READY_SILO_STATUS = { state: "ready" } satisfies SiloStatus;
