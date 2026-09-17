import { expect, test, vi } from "vitest";
import { decodeKey } from "src/decodeKey";
import { encodeKey } from "src/encodeKey";
import { keychain } from "src/keychain";
import { createFakeKeychain } from "src/keychain.fixture";

const KEY = "silo:users:7:token";

test("every key becomes one service under the prefix, with the plain key as username and options forwarded", async () => {
  const fake = createFakeKeychain();
  const getGenericPassword = vi.spyOn(fake.module, "getGenericPassword");
  const options = { accessControl: "BiometryAny", accessible: "WhenUnlocked" };
  const adapter = keychain({ keychain: fake.module, options });

  await adapter.set(KEY, { name: "Ada" });

  expect(adapter.name).toBe("react-native-keychain");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.module);
  expect([...fake.entries]).toEqual([
    [
      `silo.${Buffer.from(KEY).toString("base64url")}`,
      { username: KEY, password: JSON.stringify({ name: "Ada" }) },
    ],
  ]);
  expect(await adapter.get(KEY)).toEqual({ name: "Ada" });
  expect(getGenericPassword).toHaveBeenCalledWith({
    ...options,
    service: `silo.${encodeKey(KEY)}`,
  });
  adapter.dispose();
});

test("a custom service prefix replaces the default", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({
    keychain: fake.module,
    service: { prefix: "acme." },
  });

  await adapter.set(KEY, 1);

  expect([...fake.entries.keys()]).toEqual([`acme.${encodeKey(KEY)}`]);
  adapter.dispose();
});

test("available and format come from the options", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({
    keychain: fake.module,
    available: () => false,
    format: {
      stringify: (value) => `text:${String(value)}`,
      parse: (text) => text,
    },
  });

  await adapter.set(KEY, "secret");

  expect(adapter.available()).toBe(false);
  expect(fake.entries.get(`silo.${encodeKey(KEY)}`)?.password).toBe(
    "text:secret",
  );
  expect(await adapter.get(KEY)).toBe("text:secret");
  adapter.dispose();
});

test("the encoding is unpadded base64url and decodes back, for every shape a physical key takes", () => {
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
    expect(decodeKey(encodeKey(key))).toBe(key);
  }

  expect(decodeKey("not+base64url")).toBeNull();
});

test("keys lists this adapter's services decoded and skips foreign ones", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({ keychain: fake.module });

  await adapter.set(KEY, 1);
  await adapter.set("silo:theme", "dark");
  fake.entries.set("com.example.app", { username: "u", password: "p" });
  fake.entries.set("silo.not+base64url", { username: "u", password: "p" });

  expect(await adapter.keys?.()).toEqual([KEY, "silo:theme"]);
  adapter.dispose();
});

test("an entry the keychain does not hold reads as absent, and a removal resets its service", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({ keychain: fake.module });

  expect(await adapter.get(KEY)).toBeUndefined();

  await adapter.set(KEY, "secret");
  await adapter.remove(KEY);

  expect(fake.entries.size).toBe(0);
  adapter.dispose();
});

test("a write the keychain refuses is a named error, not a persisted value", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({ keychain: fake.module });

  fake.refuse();

  await expect(adapter.set(KEY, "secret")).rejects.toThrow(
    `The react-native-keychain adapter could not store "${KEY}": the keychain refused the entry.`,
  );
  expect(fake.entries.size).toBe(0);
  adapter.dispose();
});

test("dispose keeps what the keychain holds, and the adapter does not observe", async () => {
  const fake = createFakeKeychain();
  const adapter = keychain({ keychain: fake.module });

  await adapter.set(KEY, "secret");
  adapter.dispose();

  expect(fake.entries.size).toBe(1);
  expect(adapter.available()).toBe(true);
  expect("observe" in adapter).toBe(false);
});
