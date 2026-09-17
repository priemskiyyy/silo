import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { SearchParamsAdapterOptions } from "src/types/SearchParamsAdapterOptions";

type Announcement = { key: string; text: string | null };

const isAnnouncement = (data: unknown): data is Announcement => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("key" in data) || typeof data.key !== "string") {
    return false;
  }

  if (!("text" in data)) {
    return false;
  }

  return typeof data.text === "string" || data.text === null;
};

/**
 * Stores values in URL parameters using replaceState.
 * Optional cross-tab synchronization updates URLs on the same path.
 *
 * @example
 * ```ts
 * const adapter = searchParams({ hash: true, sharing: "cross-tab" });
 * ```
 */
export const searchParams = ({
  hash = false,
  sharing = "single-tab",
  namespace = "hidden",
  available,
  format,
}: SearchParamsAdapterOptions = {}) => {
  let page: Location | null | undefined;
  let channel: BroadcastChannel | null = null;
  const stops = new Set<() => void>();
  const event = hash ? "hashchange" : "popstate";

  const resolve = () => {
    try {
      const { location, history } = globalThis;

      if (location === undefined) {
        return null;
      }

      if (history === undefined) {
        return null;
      }

      return typeof history.replaceState === "function" ? location : null;
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
        `Cannot ${operation} "${key}" through the search-params adapter: this environment has no location, so nothing was persisted.`,
      );
    }

    return platform;
  };

  // The router and other scripts can change the URL without notifying this adapter.
  const parametersOf = (location: Location) =>
    new URLSearchParams(hash ? location.hash.slice(1) : location.search);

  const replace = (location: Location, parameters: URLSearchParams) => {
    const url = new URL(location.href);

    url[hash ? "hash" : "search"] = parameters.toString();

    globalThis.history.replaceState(globalThis.history.state, "", url);
  };

  // One channel both sends and receives, avoiding echoes of this adapter's writes.
  const openChannel = (location: Location) => {
    if (sharing === "single-tab") {
      return null;
    }

    const Channel = globalThis.BroadcastChannel;

    if (typeof Channel !== "function") {
      return null;
    }

    if (channel === null) {
      channel = new Channel(
        `silo:search-params:${hash ? "hash" : "search"}:${location.pathname}`,
      );
    }

    return channel;
  };

  const apply = (location: Location, { key, text }: Announcement) => {
    const parameters = parametersOf(location);

    if (text === null) {
      parameters.delete(key);
      replace(location, parameters);
      return;
    }

    parameters.set(key, text);
    replace(location, parameters);
  };

  return createTextStorageAdapter<Location | null>({
    mode: "sync",
    name: "search-params",
    get native() {
      return native();
    },
    format,
    keyspace: { namespace },
    read: (key) => {
      const platform = native();

      return platform === null ? undefined : parametersOf(platform).get(key);
    },
    write: (key, text) => {
      const platform = writable("write", key);
      const announcement = { key, text };

      apply(platform, announcement);
      openChannel(platform)?.postMessage(announcement);
    },
    remove: (key) => {
      const platform = writable("remove", key);
      const announcement = { key, text: null };

      apply(platform, announcement);
      openChannel(platform)?.postMessage(announcement);
    },
    available: available ?? (() => native() !== null),
    keys: () => {
      const platform = native();

      return platform === null
        ? []
        : [...new Set(parametersOf(platform).keys())];
    },
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }

      channel?.close();
      channel = null;
    },
    observe: (listener) => {
      const platform = native();

      if (platform === null) {
        return () => {};
      }

      const handleNavigation = () => listener({ key: null });
      const handleMessage = ({ data }: MessageEvent<unknown>) => {
        if (!isAnnouncement(data)) {
          return;
        }

        apply(platform, data);
        listener(data);
      };
      const target = openChannel(platform);
      const stop = () => {
        if (!stops.delete(stop)) {
          return;
        }

        globalThis.removeEventListener(event, handleNavigation);
        target?.removeEventListener("message", handleMessage);
      };

      globalThis.addEventListener(event, handleNavigation);
      target?.addEventListener("message", handleMessage);
      stops.add(stop);

      return stop;
    },
  });
};
