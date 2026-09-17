import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { searchParams } from "src/searchParams";

// Another script, or the router, rewrites the URL and back or forward lands
// on it: the URL is replaced from outside and `popstate` announces it.
const navigate =
  (hash: boolean) => (change: { key: string | null; value?: unknown }) => {
    const url = new URL(location.href);
    const parameters = new URLSearchParams(
      hash ? url.hash.slice(1) : url.search,
    );
    const updated = (() => {
      if (change.key === null) {
        return "";
      }

      parameters.set(change.key, JSON.stringify(change.value));
      return parameters.toString();
    })();

    url[hash ? "hash" : "search"] = updated;

    history.replaceState(null, "", url);
    globalThis.dispatchEvent(
      hash ? new HashChangeEvent("hashchange") : new PopStateEvent("popstate"),
    );
  };

testStorageAdapter({
  name: "searchParams",
  createAdapter: () => searchParams(),
  externalWrite: (_adapter, change) => navigate(false)(change),
});

testStorageAdapter({
  name: "searchParams in the fragment",
  createAdapter: () => searchParams({ hash: true }),
  externalWrite: (_adapter, change) => navigate(true)(change),
});
