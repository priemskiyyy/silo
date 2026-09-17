import { expect, test, vi } from "vitest";
import { createFakeSecureStore } from "src/secureStore.fixture";
import { encodeKey } from "src/encodeKey";
import { secureStore } from "src/secureStore";

const KEY = "silo:users:7:token";

test("every key reaches the module as unpadded base64url, and options ride along", async () => {
  const fake = createFakeSecureStore();
  const getItemAsync = vi.spyOn(fake.module, "getItemAsync");
  const options = { keychainService: "acme", requireAuthentication: true };
  const adapter = secureStore({ store: fake.module, options });

  await adapter.set(KEY, { name: "Ada" });

  expect(adapter.name).toBe("expo-secure-store");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.module);
  expect([...fake.items]).toEqual([
    [Buffer.from(KEY).toString("base64url"), JSON.stringify({ name: "Ada" })],
  ]);
  expect(await adapter.get(KEY)).toEqual({ name: "Ada" });
  expect(getItemAsync).toHaveBeenCalledWith(encodeKey(KEY), options);
  adapter.dispose();
});

test("the encoding matches base64url for every shape a physical key takes", () => {
  for (const key of [
    "silo:theme",
    "silo:users:7:theme",
    "silo::version",
    "a b/c?d=1&e",
    "🙂 emoji",
    "__proto__",
    "",
  ]) {
    expect(encodeKey(key)).toBe(Buffer.from(key).toString("base64url"));
    expect(encodeKey(key)).toMatch(/^[A-Za-z0-9_-]*$/);
  }
});

test("available and format come from the options", async () => {
  const fake = createFakeSecureStore();
  const adapter = secureStore({
    store: fake.module,
    available: () => false,
    format: {
      stringify: (value) => `text:${String(value)}`,
      parse: (text) => text,
    },
  });

  await adapter.set(KEY, "secret");

  expect(adapter.available()).toBe(false);
  expect(fake.items.get(encodeKey(KEY))).toBe("text:secret");
  expect(await adapter.get(KEY)).toBe("text:secret");
  adapter.dispose();
});

test("dispose keeps what the keychain holds, and the adapter neither lists nor observes", async () => {
  const fake = createFakeSecureStore();
  const adapter = secureStore({ store: fake.module });

  await adapter.set(KEY, "secret");
  adapter.dispose();

  expect(fake.items.size).toBe(1);
  expect(adapter.available()).toBe(true);
  expect("keys" in adapter).toBe(false);
  expect("observe" in adapter).toBe(false);
});
