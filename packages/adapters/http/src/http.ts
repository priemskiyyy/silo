import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { HttpAdapterOptions } from "src/types/HttpAdapterOptions";
import type { HttpHandle } from "src/types/HttpHandle";

type Method = "GET" | "PUT" | "DELETE";

const isString = (item: unknown): item is string => typeof item === "string";

const refused = (method: Method, resource: string, status: number) =>
  new Error(
    `The http storage adapter cannot ${method} ${resource}: the server answered ${status}.`,
  );

/**
 * Maps GET, PUT and DELETE requests to a key-value endpoint. GET on the base URL lists keys.
 *
 * @example
 * ```ts
 * const adapter = http({ url: "https://api.example.com/kv" });
 * ```
 */
export const http = ({
  url,
  headers,
  fetch: configured,
  keys = true,
  available,
  format,
}: HttpAdapterOptions) => {
  const base = url.replace(/\/+$/u, "");
  const native: HttpHandle = { url: base };
  const resource = (key: string) => `${base}/${encodeURIComponent(key)}`;
  const fetcher = () => configured ?? globalThis.fetch;

  const request = async (method: Method, target: string, body?: string) => {
    const send = fetcher();

    if (typeof send !== "function") {
      throw new Error(
        `The http storage adapter cannot ${method} ${target}: this environment has no fetch.`,
      );
    }

    const sent = new Headers(
      typeof headers === "function" ? await headers() : headers,
    );

    if (body !== undefined) {
      sent.set("content-type", "application/json");
    }

    return send(target, {
      method,
      headers: sent,
      ...(body === undefined ? {} : { body }),
    });
  };

  return createTextStorageAdapter({
    mode: "async",
    name: "http",
    native,
    format,
    read: async (key) => {
      const response = await request("GET", resource(key));

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw refused("GET", resource(key), response.status);
      }

      return await response.text();
    },
    write: async (key, text) => {
      const response = await request("PUT", resource(key), text);

      if (!response.ok) {
        throw refused("PUT", resource(key), response.status);
      }
    },
    remove: async (key) => {
      const response = await request("DELETE", resource(key));

      if (response.ok) {
        return;
      }

      if (response.status === 404) {
        return;
      }

      throw refused("DELETE", resource(key), response.status);
    },
    available: available ?? (() => typeof fetcher() === "function"),
    dispose: () => {},
    ...(keys
      ? {
          keys: async () => {
            const response = await request("GET", base);

            if (!response.ok) {
              throw refused("GET", base, response.status);
            }

            const listed: unknown = await response.json();

            if (!Array.isArray(listed) || !listed.every(isString)) {
              throw new Error(
                `The http storage adapter cannot list keys: ${base} must answer a JSON array of strings.`,
              );
            }

            return listed;
          },
        }
      : {}),
  });
};
