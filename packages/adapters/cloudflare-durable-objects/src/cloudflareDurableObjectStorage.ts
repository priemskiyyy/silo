import { createStorageAdapter } from "@priemskiyyy/silo";
import type { CloudflareDurableObjectStorageAdapterOptions } from "src/types/CloudflareDurableObjectStorageAdapterOptions";

/**
 * Stores structured values in a Durable Object storage binding.
 *
 * @example
 * ```ts
 * const adapter = cloudflareDurableObjectStorage({ storage: this.ctx.storage });
 * ```
 */
export const cloudflareDurableObjectStorage = ({
  storage,
  available = () => true,
}: CloudflareDurableObjectStorageAdapterOptions) =>
  createStorageAdapter({
    mode: "async",
    name: "cloudflare-durable-object-storage",
    native: storage,
    get: (key) => storage.get(key),
    set: async (key, value) => {
      if (value === undefined) {
        await storage.delete(key);
        return;
      }

      await storage.put(key, value);
    },
    remove: async (key) => {
      await storage.delete(key);
    },
    keys: async () => [...(await storage.list()).keys()],
    available,
    dispose: () => {},
  });
