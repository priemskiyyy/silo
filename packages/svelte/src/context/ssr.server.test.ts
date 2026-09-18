import { render } from "svelte/server";
import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import Harness from "../utilities/IdentityHarness.fixture.svelte";
import HandleView from "../utilities/Handle.fixture.svelte";

test("SSR accepts a scoped handle without a provider or subscriptions", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { count: value({ fallback: 3 }) },
      },
    },
  });
  const handle = silo.scope("workspaces:7").value("count");
  const subscribe = vi.spyOn(handle, "subscribe");
  const html = render(HandleView, {
    props: { root: handle, handle, onChange: () => {} },
  }).body;
  expect(html).toContain("3/3/ready");
  expect(subscribe).not.toHaveBeenCalled();
  expect(mock.calls.map((call) => [call.operation, call.key])).toEqual([
    ["get", "silo:workspaces:7:count"],
  ]);
  silo.dispose();
});

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
