// @vitest-environment node

import { expect, test } from "vitest";
import { sessionStorage } from "src/sessionStorage";

// This file runs with no DOM at all, which is the render this adapter has to
// survive before the client ever mounts.
test("a server render costs nothing and reads as empty", () => {
  const adapter = sessionStorage();

  expect(adapter.native).toBeNull();
  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(adapter.keys?.()).toEqual([]);
  expect(adapter.mode).toBe("sync");
  adapter.dispose();
});

test("a write on the server names what is missing", () => {
  const adapter = sessionStorage();

  expect(() => adapter.set("silo:theme", "dark")).toThrow(
    'Cannot write "silo:theme" through the session-storage adapter: this environment has no sessionStorage, so nothing was persisted.',
  );
  expect(() => adapter.remove("silo:theme")).toThrow(
    'Cannot remove "silo:theme" through the session-storage adapter: this environment has no sessionStorage, so nothing was persisted.',
  );
  adapter.dispose();
});

test("observing on the server is a no-op", () => {
  const adapter = sessionStorage();

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must expose observe on every platform");
  }

  const stop = adapter.observe(() => {
    throw new Error("a server has nothing to observe");
  });

  expect(() => stop()).not.toThrow();
  adapter.dispose();
});
