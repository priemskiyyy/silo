// @vitest-environment node

import { expect, test } from "vitest";
import { cookie } from "src/cookie";

// No DOM at all, which is the render this adapter has to survive before the
// client ever mounts.
test("a server render costs nothing and reads as empty", () => {
  const adapter = cookie();

  expect(adapter.native).toBeNull();
  expect(adapter.available()).toBe(false);
  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(adapter.keys?.()).toEqual([]);
  adapter.dispose();
});

test("a write on the server names what is missing", () => {
  const adapter = cookie();

  expect(() => adapter.set("silo:theme", "dark")).toThrow(
    'Cannot write "silo:theme" through the cookie adapter: this environment has no document.cookie, so nothing was persisted.',
  );
  expect(() => adapter.remove("silo:theme")).toThrow(
    'Cannot remove "silo:theme" through the cookie adapter: this environment has no document.cookie, so nothing was persisted.',
  );
  adapter.dispose();
});
