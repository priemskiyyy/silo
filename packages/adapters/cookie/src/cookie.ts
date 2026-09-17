import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { CookieAdapterOptions } from "src/types/CookieAdapterOptions";

const parse = (header: string) => {
  const cookies = new Map<string, string>();

  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");

    if (separator === -1) {
      continue;
    }

    try {
      cookies.set(
        decodeURIComponent(entry.slice(0, separator).trim()),
        entry.slice(separator + 1).trim(),
      );
    } catch {
      // Ignore malformed cookie names written by other code.
    }
  }

  return cookies;
};

/**
 * Stores URI-encoded JSON in document.cookie and verifies writes by reading them back.
 *
 * @example
 * ```ts
 * const adapter = cookie({ maxAge: 31_536_000, sameSite: "lax" });
 * ```
 */
export const cookie = ({
  path = "/",
  domain,
  secure = false,
  sameSite,
  maxAge,
  namespace = "visible",
  available,
  format,
}: CookieAdapterOptions = {}) => {
  let page: Document | null | undefined;

  const resolve = () => {
    try {
      const document = globalThis.document;

      if (document === undefined) {
        return null;
      }

      if (typeof document.cookie !== "string") {
        return null;
      }

      if (globalThis.navigator.cookieEnabled === false) {
        return null;
      }

      return document;
    } catch {
      return null;
    }
  };

  const native = () => {
    if (page !== undefined) {
      return page;
    }

    page = resolve();

    return page;
  };

  const writable = (operation: string, key: string) => {
    const platform = native();

    if (platform === null) {
      throw new Error(
        `Cannot ${operation} "${key}" through the cookie adapter: this environment has no document.cookie, so nothing was persisted.`,
      );
    }

    return platform;
  };

  const attributes = [
    `path=${path}`,
    ...(domain === undefined ? [] : [`domain=${domain}`]),
    ...(secure ? ["secure"] : []),
    ...(sameSite === undefined ? [] : [`samesite=${sameSite}`]),
  ].join("; ");

  const writeHeader = (
    document: Document,
    key: string,
    value: string,
    age: number | undefined,
  ) => {
    const lifetime = age === undefined ? "" : `; max-age=${age}`;

    document.cookie = `${encodeURIComponent(key)}=${value}; ${attributes}${lifetime}`;
  };

  return createTextStorageAdapter<Document | null>({
    mode: "sync",
    name: "cookie",
    get native() {
      return native();
    },
    format,
    keyspace: { namespace },
    read: (key) => {
      const platform = native();

      if (platform === null) {
        return undefined;
      }

      const encoded = parse(platform.cookie).get(key);

      return encoded === undefined ? undefined : decodeURIComponent(encoded);
    },
    write: (key, text) => {
      const platform = writable("write", key);
      const encoded = encodeURIComponent(text);

      writeHeader(platform, key, encoded, maxAge);

      // Cookie setters can silently refuse a write, so verify the stored value.
      if (parse(platform.cookie).get(key) !== encoded) {
        throw new Error(
          `The browser refused to store the cookie "${key}": it is over the size limit, or its attributes do not fit this page.`,
        );
      }
    },
    remove: (key) => writeHeader(writable("remove", key), key, "", 0),
    available: available ?? (() => native() !== null),
    keys: () => {
      const platform = native();

      return platform === null ? [] : [...parse(platform.cookie).keys()];
    },
    dispose: () => {},
  });
};
