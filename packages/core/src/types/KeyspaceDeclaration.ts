/**
 * What an adapter says about the medium it writes to: whether the store's
 * namespace belongs in its keys. A shared medium such as localStorage or a
 * cookie jar wants it `visible`, a query string the page owns wants it
 * `hidden`. The store composes keys accordingly for the candidate that won,
 * unless the storage sets its own `namespace`.
 *
 * @example
 * ```ts
 * const adapter = createStorageAdapter({ ..., keyspace: { namespace: "hidden" } });
 * ```
 */
export type KeyspaceDeclaration = { namespace: "visible" | "hidden" };
