// @vitest-environment node

import { expect, test } from "vitest";
import { localStorage } from "src/localStorage";

// This file runs with no DOM at all, which is the render this adapter has to
// survive before the client ever mounts.
test("a server render costs nothing and reads as empty", () => {
  const adapter = localStorage();

  expect(adapter.native).toBeNull();
  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(adapter.keys?.()).toEqual([]);
  expect(adapter.mode).toBe("sync");
  adapter.dispose();
});

test("a write on the server names what is missing", () => {
  const adapter = localStorage();

  expect(() => adapter.set("silo:theme", "dark")).toThrow(
    'Cannot write "silo:theme" through the local-storage adapter: this environment has no localStorage, so nothing was persisted.',
  );
  expect(() => adapter.remove("silo:theme")).toThrow(
    'Cannot remove "silo:theme" through the local-storage adapter: this environment has no localStorage, so nothing was persisted.',
  );
  adapter.dispose();
});

test("observing on the server is a no-op", () => {
  const adapter = localStorage();

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must expose observe on every platform");
  }

  const stop = adapter.observe(() => {
    throw new Error("a server has nothing to observe");
  });

  expect(() => stop()).not.toThrow();
  adapter.dispose();
});
