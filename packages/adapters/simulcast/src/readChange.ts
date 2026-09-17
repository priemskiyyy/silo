import type { StorageChange } from "@priemskiyyy/silo";

/**
 * The change a publication carries, or `null` for anything else travelling on
 * the channel. A removal arrives as `{ key }` alone, because JSON has no
 * spelling for `undefined`.
 *
 * @example
 * ```ts
 * readChange({ key: "silo:theme", value: "dark" }); // { key: "silo:theme", value: "dark" }
 * readChange({ key: "silo:theme" }); // { key: "silo:theme", value: undefined }
 * readChange("hello"); // null
 * ```
 */
export const readChange = (data: unknown): StorageChange | null => {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  if (!("key" in data)) {
    return null;
  }

  if (data.key === null) {
    return { key: null };
  }

  if (typeof data.key !== "string") {
    return null;
  }

  return { key: data.key, value: "value" in data ? data.value : undefined };
};
