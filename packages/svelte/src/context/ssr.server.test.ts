import { render } from "svelte/server";
import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import Harness from "../utilities/IdentityHarness.fixture.svelte";

test("SSR renders stable fallbacks without subscriptions, writes, or disposal", () => {
  expect(typeof window).toBe("undefined");
  const mock = createMockAdapter();
  const fallback = { label: "fallback" };
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { theme: value({ fallback }) },
      },
    },
  });
  const handle = silo.value("theme");
  const subscribe = vi.spyOn(handle, "subscribe");
  expect(
    render(Harness, { props: { silo, expected: fallback } }).body,
  ).toContain("true");
  expect(subscribe).not.toHaveBeenCalled();
  expect(mock.calls.map((call) => call.operation)).toEqual(["get"]);
  expect(mock.disposeCount()).toBe(0);
  silo.dispose();
});
