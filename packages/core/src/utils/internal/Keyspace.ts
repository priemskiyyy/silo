import type { StorageAdapter } from "src/types/StorageAdapter";
import type { Storages } from "src/types/Storages";
import {
  DEFAULT_NAMESPACE,
  KEY_SEPARATOR,
  PATH_SEPARATOR,
} from "src/utils/constants/keyspace";

/**
 * Composes logical addresses, then translates them through the storage's key mapping.
 * An empty namespace omits the prefix and its separator.
 */
export class Keyspace {
  namespace;
  version;
  #prefix;
  #keys;

  constructor({
    namespace,
    keys,
  }: {
    namespace: string;
    keys?: Storages[string]["keys"];
  }) {
    if (namespace.includes(KEY_SEPARATOR)) {
      throw new Error(
        `A Silo namespace must not contain "${KEY_SEPARATOR}", received "${namespace}".`,
      );
    }

    this.namespace = namespace;
    this.#keys = keys;
    this.#prefix = namespace === "" ? "" : `${namespace}${KEY_SEPARATOR}`;
    this.version = this.#encode(
      `${namespace}${KEY_SEPARATOR}${KEY_SEPARATOR}version`,
    );
  }

  physical(segments: string[], key: string) {
    const physical = this.#encode(`${this.#prefixFor(segments)}${key}`);
    if (physical === this.version) {
      throw new Error(`The key "${physical}" is reserved for Silo migrations.`);
    }
    return physical;
  }

  /** Strips the prefix; excludes other namespaces and the version record. */
  relative(physical: string) {
    if (physical === this.version) {
      return null;
    }

    const logical =
      this.#keys === undefined ? physical : this.#keys.decode(physical);
    if (logical === undefined || !logical.startsWith(this.#prefix)) {
      return null;
    }

    if (this.#keys !== undefined && this.#keys.encode(logical) !== physical) {
      return null;
    }
    return logical.slice(this.#prefix.length);
  }

  #prefixFor(segments: string[]) {
    if (segments.length === 0) {
      return this.#prefix;
    }
    return `${this.#prefix}${segments.join(KEY_SEPARATOR)}${KEY_SEPARATOR}`;
  }

  #encode(logical: string) {
    if (this.#keys === undefined) {
      return logical;
    }
    const physical = this.#keys.encode(logical);
    if (typeof physical !== "string" || physical === "") {
      throw new Error("A Silo key mapping must produce a non-empty string.");
    }
    if (this.#keys.decode(physical) !== logical) {
      throw new Error(
        `Silo cannot map "${logical}": keys.decode must reverse keys.encode.`,
      );
    }
    return physical;
  }

  static assertKey = (key: string) => {
    if (key === "") {
      throw new Error("A Silo schema key must not be empty.");
    }

    if (key.includes(KEY_SEPARATOR) || key.includes(PATH_SEPARATOR)) {
      throw new Error(
        `A Silo schema key must not contain "${KEY_SEPARATOR}" or "${PATH_SEPARATOR}", received "${key}".`,
      );
    }
  };

  // Colons are legal: scope("users:7") equals scope("users").scope("7").
  static assertSegment = (segment: string) => {
    if (segment === "") {
      throw new Error("A Silo scope segment must not be empty.");
    }
  };
}

/** Resolves each storage's namespace after adapter selection. */
export const createKeyspaces = ({
  storages,
  adapters,
  namespace = DEFAULT_NAMESPACE,
}: {
  storages: Storages;
  adapters: Record<string, { adapter: StorageAdapter }>;
  namespace?: string | undefined;
}) => {
  const keyspaces = new Map<string, Keyspace>();

  for (const [name, storage] of Object.entries(storages)) {
    if (name === "" || name.includes(PATH_SEPARATOR)) {
      throw new Error(
        `A Silo storage name must be non-empty and must not contain "${PATH_SEPARATOR}", received "${name}".`,
      );
    }
    const chosen = adapters[name];

    if (chosen === undefined) {
      throw new Error(`Silo chose no adapter for the storage "${name}".`);
    }

    const resolvedNamespace =
      storage.namespace ??
      (chosen.adapter.keyspace?.namespace === "hidden" ? "" : namespace);
    keyspaces.set(
      name,
      new Keyspace({ namespace: resolvedNamespace, keys: storage.keys }),
    );
    for (const key of Object.keys(storage.schema)) {
      Keyspace.assertKey(key);
    }
  }

  const primary = keyspaces.get("default");

  if (primary === undefined) {
    throw new Error("A Silo needs a default storage.");
  }

  return Object.assign(Object.fromEntries(keyspaces), { default: primary });
};
