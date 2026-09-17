import type { RedisClient } from "src/types/RedisClient";

// The two glob characters KEYS understands, over a key that may hold anything.
const matches = (pattern: string) => {
  const source = pattern
    .split("")
    .map((character) => {
      if (character === "*") {
        return ".*";
      }

      if (character === "?") {
        return ".";
      }

      return character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("");

  return new RegExp(`^${source}$`, "u");
};

/** An in-process stand-in for a Redis client, for the tests: strings in a `Map`, answered a tick later. */
export const createFakeRedis = () => {
  const store = new Map<string, string>();
  const client: RedisClient = {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);

      return "OK";
    },
    del: async (key) => (store.delete(key) ? 1 : 0),
    keys: async (pattern) => {
      const glob = matches(pattern);

      return [...store.keys()].filter((key) => glob.test(key));
    },
  };

  return { store, client };
};
