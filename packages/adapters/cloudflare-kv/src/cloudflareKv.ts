import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { CloudflareKvAdapterOptions } from "src/types/CloudflareKvAdapterOptions";

/**
 * Stores JSON text in a Workers KV namespace. Reads are eventually consistent.
 *
 * @example
 * ```ts
 * const adapter = cloudflareKv({ namespace: env.SETTINGS });
 * ```
 */
export const cloudflareKv = ({
  namespace,
  available = () => true,
  format,
}: CloudflareKvAdapterOptions) =>
  createTextStorageAdapter({
    mode: "async",
    name: "cloudflare-kv",
    native: namespace,
    format,
    read: (key) => namespace.get(key, "text"),
    write: (key, text) => namespace.put(key, text),
    remove: (key) => namespace.delete(key),
    keys: async () => {
      const names: string[] = [];
      let cursor: string | undefined;

      do {
        const page = await namespace.list(
          cursor === undefined ? {} : { cursor },
        );
        names.push(...page.keys.map((entry) => entry.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor !== undefined);

      return names;
    },
    available,
    dispose: () => {},
  });
