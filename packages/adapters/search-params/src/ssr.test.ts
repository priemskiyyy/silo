// @vitest-environment node

import { expect, test } from "vitest";
import { searchParams } from "src/searchParams";

// No DOM at all, which is the render this adapter has to survive before the
// client ever mounts.
test("a server render costs nothing and reads as empty", () => {
  const adapter = searchParams();

  expect(adapter.native).toBeNull();
  expect(adapter.available()).toBe(false);
  expect(adapter.get("silo:filter")).toBeUndefined();
  expect(adapter.keys?.()).toEqual([]);
  expect(adapter.observe?.(() => undefined)).toBeTypeOf("function");
  adapter.dispose();
});

test("a write on the server names what is missing", () => {
  const adapter = searchParams();

  expect(() => adapter.set("silo:filter", "open")).toThrow(
    'Cannot write "silo:filter" through the search-params adapter: this environment has no location, so nothing was persisted.',
  );
  expect(() => adapter.remove("silo:filter")).toThrow(
    'Cannot remove "silo:filter" through the search-params adapter: this environment has no location, so nothing was persisted.',
  );
  adapter.dispose();
});
