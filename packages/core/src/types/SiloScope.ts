import type { Storages } from "src/types/Storages";
import type { Silo } from "src/utils/Silo";

/**
 * The same storages under a key prefix. A scope handle carries the parent
 * store's keys, and the store itself is the root scope.
 *
 * `clear` is schema driven: it removes every declared key of every storage at
 * this scope, so keys written by an older schema survive it. `release()` waits
 * for writes and frees cached records in this scope and its descendants without
 * deleting storage. Existing value handles become inactive.
 *
 * @example
 * ```ts
 * const account = silo.scope(`users:${userId}`);
 * account.value("secure.token").set(token);
 * await account.clear();
 * ```
 */
export type SiloScope<TStorages extends Storages> = Pick<
  Silo<TStorages>,
  "value" | "scope" | "clear" | "release"
>;
