import { beforeEach, expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { cookie } from "src/cookie";

const KEY = "silo:theme";

// One spy on the setter only, calling through to jsdom's jar: spying the
// getter as well leaves a mocked setter behind once the two restore in order,
// and every later write in the file vanishes.
const recordWrites = () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie",
  );
  const write = descriptor?.set;

  if (write === undefined) {
    throw new Error("jsdom must define the cookie setter on Document");
  }

  const written: string[] = [];
  vi.spyOn(Document.prototype, "cookie", "set").mockImplementation(function (
    this: Document,
    header: string,
  ) {
    written.push(header);
    write.call(this, header);
  });

  return written;
};

const clearCookies = () => {
  for (const entry of document.cookie.split(";")) {
    // A nameless cookie serializes as its bare value, and expires by name.
    const name = entry.includes("=")
      ? entry.slice(0, entry.indexOf("=")).trim()
      : "";
    document.cookie = `${name}=; path=/; max-age=0`;
  }
};

beforeEach(clearCookies);

test("the factory reads the platform on first use and never again", () => {
  const platform = vi.spyOn(globalThis, "document", "get");
  const adapter = cookie();

  expect(
    platform,
    "resolving the platform in the factory call is what breaks a server render",
  ).not.toHaveBeenCalled();
  expect(adapter.name).toBe("cookie");
  expect(adapter.mode).toBe("sync");

  adapter.get(KEY);
  adapter.get(KEY);

  expect(platform).toHaveBeenCalledOnce();
  expect(adapter.native).toBe(document);
  expect(adapter.available()).toBe(true);
  adapter.dispose();
});

test("a value is stored as URI encoded JSON under the URI encoded key", () => {
  const adapter = cookie();
  const stored = { nested: [1, "two", null], text: "a; b=c" };

  adapter.set(KEY, stored);

  expect(document.cookie).toBe(
    `${encodeURIComponent(KEY)}=${encodeURIComponent(JSON.stringify(stored))}`,
  );
  expect(adapter.get(KEY)).toEqual(stored);
  adapter.dispose();
});

test("every write carries path=/ and no lifetime by default, and a removal the same attributes", () => {
  const written = recordWrites();
  const adapter = cookie({ domain: "localhost", sameSite: "lax" });

  adapter.set(KEY, 1);
  adapter.remove(KEY);

  expect(written).toEqual([
    `${encodeURIComponent(KEY)}=1; path=/; domain=localhost; samesite=lax`,
    `${encodeURIComponent(KEY)}=; path=/; domain=localhost; samesite=lax; max-age=0`,
  ]);
  expect(document.cookie).toBe("");
  adapter.dispose();
});

test("maxAge is written in seconds and secure as a bare attribute", () => {
  const written = recordWrites();
  const adapter = cookie({ secure: true, maxAge: 3_600 });

  adapter.set(KEY, 1);

  expect(written).toEqual([
    `${encodeURIComponent(KEY)}=1; path=/; secure; max-age=3600`,
  ]);
  adapter.dispose();
});

test("available and format are the application's when given", () => {
  const adapter = cookie({
    available: () => false,
    format: {
      stringify: (stored: unknown) => `!${JSON.stringify(stored)}`,
      parse: (text: string) => JSON.parse(text.slice(1)),
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(decodeURIComponent(document.cookie.split("=")[1] ?? "")).toBe(
    '!"dark"',
  );
  expect(adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("a cookie this adapter did not write throws on read and leaves the cookie alone", () => {
  const adapter = cookie();
  document.cookie = `${encodeURIComponent(KEY)}=not-json; path=/`;

  expect(() => adapter.get(KEY)).toThrow();
  expect(document.cookie).toBe(`${encodeURIComponent(KEY)}=not-json`);
  adapter.dispose();
});

test("a third party's cookie that will not decode hides nothing", () => {
  const adapter = cookie();
  document.cookie = "%E0%A4%A=broken; path=/";
  document.cookie = "bare";
  adapter.set(KEY, "dark");

  expect(adapter.get(KEY)).toBe("dark");
  expect(adapter.keys?.()).toEqual([KEY]);
  adapter.dispose();
});

test("a cookie the page cannot read back is a refused write, not a phantom value", () => {
  // jsdom keeps a `secure` cookie over plain HTTP, so the one refusal it can
  // play is a path this page is not under, which a browser drops the same way
  // it drops a cookie over the size limit.
  const adapter = cookie({ path: "/elsewhere" });

  expect(() => adapter.set(KEY, "dark")).toThrow(
    `The browser refused to store the cookie "${KEY}"`,
  );
  expect(adapter.get(KEY)).toBeUndefined();
  adapter.dispose();
});

test("a silo persists through this adapter and rehydrates from it", () => {
  const schema = { theme: value<string>({ fallback: "light" }) };
  const silo = new Silo({
    storages: { default: { adapters: [cookie()], schema } },
  });

  silo.value("theme").set("dark");

  expect(document.cookie).toBe(`${encodeURIComponent(KEY)}=%22dark%22`);

  const reloaded = new Silo({
    storages: { default: { adapters: [cookie()], schema } },
  });

  expect(reloaded.value("theme").get()).toBe("dark");
  silo.dispose();
  reloaded.dispose();
});

test("the jar is shared, so the namespace is visible unless told otherwise", () => {
  expect(cookie().keyspace).toEqual({ namespace: "visible" });
  expect(cookie({ namespace: "hidden" }).keyspace).toEqual({
    namespace: "hidden",
  });
});

test("an old cookie does not hide a refused overwrite", () => {
  const adapter = cookie();
  adapter.set(KEY, "old");
  vi.spyOn(Document.prototype, "cookie", "set").mockImplementation(() => {});

  expect(() => adapter.set(KEY, "new")).toThrow("refused to store");
  expect(adapter.get(KEY)).toBe("old");
  adapter.dispose();
});
