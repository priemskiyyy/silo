/** Every key a store composes starts with this, unless the store opts into the shared keyspace with `""`. */
export const DEFAULT_NAMESPACE = "silo";

/** The storage a bare key lives in, and the one that holds the version record. */
export const DEFAULT_STORAGE = "default";

/** Joins the namespace, the scope segments and the schema key into one physical key. */
export const KEY_SEPARATOR = ":";

/** Joins a storage name and a key into the path every other storage's keys are addressed by. */
export const PATH_SEPARATOR = ".";
