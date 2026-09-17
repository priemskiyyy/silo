import type { SiloError } from "src/types/SiloError";

/**
 * Progress of one stored value. There is no `idle`: reaching a value creates its
 * record and starts hydration in the same call, and a synchronous adapter has
 * already finished by the time the handle is returned.
 *
 * `error.phase` says which side failed. A `hydrate` error leaves the raw value
 * untouched on the adapter, so `set` and `remove` are the recovery path.
 *
 * @example
 * ```ts
 * const status = silo.value("theme").status.get();
 * if (status.state === "error") console.warn(status.error.phase, status.error.cause);
 * ```
 */
export type ValueStatus =
  | { state: "hydrating" }
  | { state: "ready" }
  | { state: "error"; error: SiloError & { phase: "hydrate" | "write" } };
