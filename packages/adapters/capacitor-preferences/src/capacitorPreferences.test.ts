import { expect, test, vi } from "vitest";
import { capacitorPreferences } from "src/capacitorPreferences";
import { createFakePreferences } from "src/capacitorPreferences.fixture";

const KEY = "silo:users:7:theme";

test("every operation reaches the plugin through its option objects, and keys unwraps the plugin's answer", async () => {
  const fake = createFakePreferences();
  const set = vi.spyOn(fake.plugin, "set");
  const get = vi.spyOn(fake.plugin, "get");
  const remove = vi.spyOn(fake.plugin, "remove");
  const adapter = capacitorPreferences({ preferences: fake.plugin });

  await adapter.set(KEY, { dark: true });

  expect(adapter.name).toBe("capacitor-preferences");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.plugin);
  expect(set).toHaveBeenCalledWith({ key: KEY, value: '{"dark":true}' });
  expect(await adapter.get(KEY)).toEqual({ dark: true });
  expect(get).toHaveBeenCalledWith({ key: KEY });
  expect(await adapter.keys?.()).toEqual([KEY]);

  await adapter.remove(KEY);

  expect(remove).toHaveBeenCalledWith({ key: KEY });
  adapter.dispose();
});

test("the probe and the text format are the application's when given", async () => {
  const fake = createFakePreferences();
  const adapter = capacitorPreferences({
    preferences: fake.plugin,
    available: () => false,
    format: {
      stringify: (value) => `wrapped:${JSON.stringify(value)}`,
      parse: (text) => JSON.parse(text.replace(/^wrapped:/u, "")),
    },
  });

  await adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(fake.items.get(KEY)).toBe('wrapped:"dark"');
  expect(await adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("dispose keeps what the plugin holds, and the adapter does not observe", async () => {
  const fake = createFakePreferences();
  const adapter = capacitorPreferences({ preferences: fake.plugin });

  await adapter.set(KEY, "dark");
  adapter.dispose();

  expect(fake.items.size).toBe(1);
  expect(adapter.available()).toBe(true);
  expect("observe" in adapter).toBe(false);
});
