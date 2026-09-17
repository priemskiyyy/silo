/**
 * What a failed phase reports: which side failed, and the error it failed with.
 *
 * `migrate` is a migration step, on the store's status. `hydrate` is a read or
 * a decode, and leaves the raw value untouched on the adapter. `write` is a
 * refused write, and leaves the optimistic snapshot in place.
 *
 * @example
 * ```ts
 * if (status.state === "error") console.warn(status.error.phase, status.error.cause);
 * ```
 */
export type SiloError = {
  phase: "migrate" | "hydrate" | "write";
  cause: unknown;
};
