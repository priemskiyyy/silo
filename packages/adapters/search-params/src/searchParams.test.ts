import { beforeEach, expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import type { StorageChange } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { searchParams } from "src/searchParams";

const KEY = "silo:theme";

const observe = (adapter: ReturnType<typeof searchParams>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe navigation");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

beforeEach(() => {
  history.replaceState(null, "", "/");
});

test("the factory describes the page and resolves it on first use", () => {
  const adapter = searchParams();

  expect(adapter.name).toBe("search-params");
  expect(adapter.mode).toBe("sync");
  expect(adapter.native).toBe(location);
  expect(adapter.available()).toBe(true);
  adapter.dispose();
});

test("a value is one JSON parameter, and every other parameter and the fragment stay", () => {
  history.replaceState(null, "", "/page?foreign=1#keep");
  const adapter = searchParams();

  adapter.set(KEY, "dark");

  expect(location.search).toBe("?foreign=1&silo%3Atheme=%22dark%22");
  expect(location.hash).toBe("#keep");
  expect(location.pathname).toBe("/page");
  expect(adapter.get(KEY)).toBe("dark");
  expect(adapter.keys?.()).toEqual(["foreign", KEY]);

  adapter.set(KEY, undefined);

  expect(location.search).toBe("?foreign=1");
  expect(adapter.get(KEY)).toBeUndefined();
  adapter.dispose();
});

test("with hash the parameters live in the fragment and the query stays", () => {
  history.replaceState(null, "", "/?foreign=1");
  const adapter = searchParams({ hash: true });

  adapter.set(KEY, { open: true });

  expect(location.hash).toBe("#silo%3Atheme=%7B%22open%22%3Atrue%7D");
  expect(location.search).toBe("?foreign=1");
  expect(adapter.get(KEY)).toEqual({ open: true });

  adapter.remove(KEY);

  expect(location.hash).toBe("");
  expect(location.href.endsWith("#")).toBe(false);
  adapter.dispose();
});

test("a write replaces the entry, keeping its state and adding none", () => {
  history.pushState({ marker: 1 }, "", "/");
  const entries = history.length;
  const adapter = searchParams();

  adapter.set(KEY, "dark");
  adapter.remove(KEY);

  expect(history.length).toBe(entries);
  expect(history.state).toEqual({ marker: 1 });
  adapter.dispose();
});

test("available and format are the application's when given", () => {
  const adapter = searchParams({
    available: () => false,
    format: {
      stringify: (stored: unknown) => `!${JSON.stringify(stored)}`,
      parse: (text: string) => JSON.parse(text.slice(1)),
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(new URLSearchParams(location.search).get(KEY)).toBe('!"dark"');
  expect(adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("navigation reports { key: null }, a stopped observer is silent, and dispose releases the rest", () => {
  const adapter = searchParams();
  const first = observe(adapter);
  const second = observe(adapter);

  globalThis.dispatchEvent(new PopStateEvent("popstate"));

  expect(first.changes).toEqual([{ key: null }]);
  expect(second.changes).toEqual([{ key: null }]);

  first.stop();
  adapter.dispose();
  globalThis.dispatchEvent(new PopStateEvent("popstate"));

  expect(first.changes).toHaveLength(1);
  expect(second.changes).toHaveLength(1);
});

// Node's BroadcastChannel delivers on a later turn, like a browser's.
const delivered = () => new Promise((resolve) => setTimeout(resolve, 0));

const channelFor = (pathname: string, part = "search") =>
  new BroadcastChannel(`silo:search-params:${part}:${pathname}`);

test("cross-tab sharing announces every write and removal to the other tabs on this path", async () => {
  const adapter = searchParams({ sharing: "cross-tab" });
  const otherTab = channelFor(location.pathname);
  const received: unknown[] = [];
  otherTab.addEventListener("message", ({ data }) => received.push(data));

  adapter.set(KEY, "dark");
  adapter.remove(KEY);
  await delivered();

  expect(received).toEqual([
    { key: KEY, text: '"dark"' },
    { key: KEY, text: null },
  ]);
  otherTab.close();
  adapter.dispose();
});

test("cross-tab sharing writes another tab's change into this URL before reporting it", async () => {
  const adapter = searchParams({ sharing: "cross-tab" });
  const { changes, stop } = observe(adapter);
  const otherTab = channelFor(location.pathname);

  otherTab.postMessage({ key: KEY, text: '"dark"' });
  otherTab.postMessage({ unrelated: true });
  await delivered();

  expect(location.search).toBe(`?${encodeURIComponent(KEY)}=%22dark%22`);
  expect(adapter.get(KEY)).toBe("dark");
  expect(changes).toEqual([{ key: KEY, value: "dark" }]);

  otherTab.postMessage({ key: KEY, text: null });
  await delivered();

  expect(location.search).toBe("");
  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: KEY, value: undefined },
  ]);

  stop();
  otherTab.postMessage({ key: KEY, text: '"light"' });
  await delivered();

  expect(changes).toHaveLength(2);
  otherTab.close();
  adapter.dispose();
});

test("cross-tab sharing keeps the fragment and the query on separate channels, and single-tab is the default", async () => {
  const fragment = searchParams({ hash: true, sharing: "cross-tab" });
  const query = searchParams({ sharing: "cross-tab" });
  const quiet = searchParams();
  const fragmentTab = channelFor(location.pathname, "hash");
  const queryTab = channelFor(location.pathname);
  const heard: string[] = [];
  fragmentTab.addEventListener("message", () => heard.push("fragment"));
  queryTab.addEventListener("message", () => heard.push("query"));

  fragment.set(KEY, 1);
  quiet.set("other", 2);
  await delivered();

  expect(heard).toEqual(["fragment"]);
  expect(query.observe).toBeTypeOf("function");
  fragmentTab.close();
  queryTab.close();
  fragment.dispose();
  query.dispose();
  quiet.dispose();
});

test("a silo keeps a named storage in the URL and rereads it from a link", () => {
  const storages = () => ({
    default: { adapters: [createMockAdapter().adapter], schema: {} },
    url: {
      adapters: [searchParams()],
      schema: { filter: value({ fallback: "all" }) },
    },
  });
  const silo = new Silo({ storages: storages() });

  silo.value("url.filter").set("open");

  // The adapter hides the namespace by default: a link belongs to the page.
  expect(location.search).toBe("?filter=%22open%22");
  silo.dispose();

  const shared = new Silo({ storages: storages() });

  expect(shared.value("url.filter").get()).toBe("open");
  shared.dispose();
});

test("namespace visible keeps the store's prefix in the parameter names", () => {
  const silo = new Silo({
    storages: {
      default: { adapters: [createMockAdapter().adapter], schema: {} },
      url: {
        adapters: [searchParams({ namespace: "visible" })],
        schema: { filter: value({ fallback: "all" }) },
      },
    },
  });

  silo.value("url.filter").set("open");

  expect(location.search).toBe("?silo%3Afilter=%22open%22");
  expect(searchParams().keyspace).toEqual({ namespace: "hidden" });
  silo.dispose();
});
