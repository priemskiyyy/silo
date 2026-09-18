import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { fakeServer } from "src/fakeServer.fixture";
import { http } from "src/http";

const KEY = "silo:users:7?draft=1";

const list = (adapter: ReturnType<typeof http>) => {
  if (typeof adapter.keys !== "function") {
    throw new Error("the adapter must list its keys");
  }

  return adapter.keys();
};

const setup = (options: Partial<Parameters<typeof http>[0]> = {}) => {
  const server = fakeServer();

  return {
    server,
    adapter: http({ url: server.base, fetch: server.fetch, ...options }),
  };
};

test("each operation is one request on the key's resource, and the key list one on the base", async () => {
  const { server, adapter } = setup({ headers: { "x-app": "silo" } });
  const resource = `${server.base}/${encodeURIComponent(KEY)}`;

  await adapter.set(KEY, { draft: true });
  await adapter.get(KEY);
  await list(adapter);
  await adapter.remove(KEY);

  expect(server.requests).toEqual([
    {
      method: "PUT",
      url: resource,
      headers: { "content-type": "application/json", "x-app": "silo" },
      body: '{"draft":true}',
    },
    {
      method: "GET",
      url: resource,
      headers: { "x-app": "silo" },
      body: undefined,
    },
    {
      method: "GET",
      url: server.base,
      headers: { "x-app": "silo" },
      body: undefined,
    },
    {
      method: "DELETE",
      url: resource,
      headers: { "x-app": "silo" },
      body: undefined,
    },
  ]);
  adapter.dispose();
});

test("404 reads as absent", async () => {
  const { adapter } = setup();

  expect(await adapter.get(KEY)).toBeUndefined();
  adapter.dispose();
});

test("available and format are the application's when given", async () => {
  const { server, adapter } = setup({
    available: () => false,
    format: {
      stringify: (stored: unknown) => `!${JSON.stringify(stored)}`,
      parse: (text: string) => JSON.parse(text.slice(1)),
    },
  });

  await adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(server.store.get(KEY)).toBe('!"dark"');
  expect(await adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("setting undefined deletes, and removing an absent key is not a failure", async () => {
  const { server, adapter } = setup();

  await adapter.set(KEY, "value");
  await adapter.set(KEY, undefined);

  expect(server.store.has(KEY)).toBe(false);
  expect(server.requests.at(-1)?.method).toBe("DELETE");

  // The server answers 404 for a key it never had.
  await expect(adapter.remove(KEY)).resolves.toBeUndefined();
  adapter.dispose();
});

test("any other status is an error naming the adapter, the method, the resource and the status", async () => {
  const { server, adapter } = setup();
  const resource = `${server.base}/${encodeURIComponent(KEY)}`;

  server.failNext(500);
  await expect(adapter.get(KEY)).rejects.toThrow(
    `The http storage adapter cannot GET ${resource}: the server answered 500.`,
  );

  server.failNext(403);
  await expect(adapter.set(KEY, 1)).rejects.toThrow(
    `The http storage adapter cannot PUT ${resource}: the server answered 403.`,
  );

  server.failNext(409);
  await expect(adapter.remove(KEY)).rejects.toThrow(
    `The http storage adapter cannot DELETE ${resource}: the server answered 409.`,
  );

  server.failNext(500);
  await expect(list(adapter)).rejects.toThrow(
    `The http storage adapter cannot GET ${server.base}: the server answered 500.`,
  );
  adapter.dispose();
});

test("a key list that is not an array of strings is refused by name", async () => {
  const { server, adapter } = setup();
  const fetch: typeof globalThis.fetch = async () =>
    new Response('{"keys":[]}', { status: 200 });
  const broken = http({ url: server.base, fetch });

  await expect(list(broken)).rejects.toThrow(
    "must answer a JSON array of strings",
  );
  adapter.dispose();
  broken.dispose();
});

test("a headers function is awaited on every request", async () => {
  const { server, adapter } = setup({
    headers: vi
      .fn<() => Promise<HeadersInit>>()
      .mockResolvedValueOnce({ authorization: "Bearer first" })
      .mockResolvedValueOnce({ authorization: "Bearer second" }),
  });

  await adapter.get(KEY);
  await adapter.get(KEY);

  expect(
    server.requests.map((request) => request.headers.authorization),
  ).toEqual(["Bearer first", "Bearer second"]);
  adapter.dispose();
});

test("keys: false leaves the adapter without a keys member", () => {
  const { adapter } = setup({ keys: false });

  expect("keys" in adapter).toBe(false);
  adapter.dispose();
});

test("a trailing slash on the url is dropped, and native carries the base", async () => {
  const server = fakeServer();
  const adapter = http({ url: `${server.base}///`, fetch: server.fetch });

  await adapter.get(KEY);

  expect(adapter.native).toEqual({ url: server.base });
  expect(server.requests[0]?.url).toBe(
    `${server.base}/${encodeURIComponent(KEY)}`,
  );
  adapter.dispose();
});

test("fetch is read when a request is made, and available says whether one exists", async () => {
  const server = fakeServer();
  const adapter = http({ url: server.base });

  vi.stubGlobal("fetch", undefined);

  try {
    expect(adapter.available()).toBe(false);
    await expect(adapter.get(KEY)).rejects.toThrow(
      "this environment has no fetch",
    );

    // Installed after the factory ran, and still the one used.
    vi.stubGlobal("fetch", server.fetch);

    expect(adapter.available()).toBe(true);
    await adapter.set(KEY, "late");
    expect(server.store.get(KEY)).toBe('"late"');
  } finally {
    vi.unstubAllGlobals();
    adapter.dispose();
  }
});

test("a silo persists through a scope and rehydrates from the server", async () => {
  const server = fakeServer();
  const Schema = { theme: value<"light" | "dark">({ fallback: "light" }) };
  const storages = () => ({
    default: {
      adapters: [http({ url: server.base, fetch: server.fetch })],
      schema: Schema,
    },
  });
  const first = new Silo({ storages: storages() });

  first.scope("users:7").value("theme").set("dark");
  await first.flush();
  first.dispose();

  // The physical key reaches the server percent encoded and comes back whole.
  expect(server.store.get("silo:users:7:theme")).toBe('"dark"');
  expect(server.requests[0]?.url).toBe(
    `${server.base}/${encodeURIComponent("silo:users:7:theme")}`,
  );

  const second = new Silo({ storages: storages() });
  const theme = second.scope("users:7").value("theme");

  await theme.hydrated();

  expect(theme.get()).toBe("dark");
  second.dispose();
});
