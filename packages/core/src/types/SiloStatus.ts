import type { SiloError } from "src/types/SiloError";

/**
 * Progress of the store itself. `migrating` blocks value hydration; `error` means
 * a migration failed, and the next start resumes at that step.
 *
 * @example
 * ```ts
 * const status = silo.status.get();
 * if (status.state === "error") console.warn(status.error.cause);
 * ```
 */
export type SiloStatus =
  | { state: "migrating" }
  | { state: "ready" }
  | { state: "error"; error: SiloError & { phase: "migrate" } };
