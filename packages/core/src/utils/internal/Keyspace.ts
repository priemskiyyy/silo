import type { StorageAdapter } from "src/types/StorageAdapter";
import type { Storages } from "src/types/Storages";
import {
  DEFAULT_NAMESPACE,
  KEY_SEPARATOR,
  PATH_SEPARATOR,
} from "src/utils/constants/keyspace";

export type Keyspaces = { default: Keyspace; [name: string]: Keyspace };

/**
 * Physical keys use `${namespace}:${...segments}:${key}`.
 * An empty namespace omits the prefix and its separator.
 */
export class Keyspace {
  namespace;
  version;
  #prefix;

  constructor(namespace: string) {
    if (namespace.includes(KEY_SEPARATOR)) {
      throw new Error(
        `A Silo namespace must not contain "${KEY_SEPARATOR}", received "${namespace}".`,
      );
    }

    this.namespace = namespace;
    this.#prefix = namespace === "" ? "" : `${namespace}${KEY_SEPARATOR}`;
    this.version = `${namespace}${KEY_SEPARATOR}${KEY_SEPARATOR}version`;
  }

  physical = (segments: string[], key: string) => {
    const physical = `${this.#prefix}${[...segments, key].join(KEY_SEPARATOR)}`;
    if (physical === this.version) {
      throw new Error(`The key "${physical}" is reserved for Silo migrations.`);
    }
    return physical;
  };

  /** Strips the prefix; excludes other namespaces and the version record. */
  relative = (physical: string) => {
    if (physical === this.version) {
      return null;
    }

    if (!physical.startsWith(this.#prefix)) {
      return null;
    }

    return physical.slice(this.#prefix.length);
  };

  contains(segments: string[], physical: string) {
    const relative = this.relative(physical);
    if (relative === null) {
      return false;
    }
    if (segments.length === 0) {
      return true;
    }
    return relative.startsWith(
      `${segments.join(KEY_SEPARATOR)}${KEY_SEPARATOR}`,
    );
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
}): Keyspaces => {
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

    keyspaces.set(
      name,
      new Keyspace(resolveNamespace(storage, chosen.adapter, namespace)),
    );
    for (const key of Object.keys(storage.schema)) {
      Keyspace.assertKey(key);
    }
  }

  const primary = keyspaces.get("default");

  if (primary === undefined) {
    throw new Error("A Silo needs a default storage.");
  }

  return { ...Object.fromEntries(keyspaces), default: primary };
};

const resolveNamespace = (
  storage: Storages[string],
  adapter: StorageAdapter,
  namespace: string,
) => {
  if (storage.namespace !== undefined) {
    return storage.namespace;
  }

  if (adapter.keyspace?.namespace === "hidden") {
    return "";
  }

  return namespace;
};
