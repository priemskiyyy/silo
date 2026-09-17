import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import Harness from "./Harness.fixture.svelte";
import CounterHarness from "./CounterHarness.fixture.svelte";
import StatusHarness from "./StatusHarness.fixture.svelte";
import IdentityHarness from "./IdentityHarness.fixture.svelte";
import View from "./Value.fixture.svelte";

const disposals: Array<() => void> = [];
afterEach(async () => {
  cleanup();
  await tick();
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
});
const createHarness = () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: {
          theme: value({ fallback: "light" }),
          other: value({ fallback: "other" }),
          count: value({ fallback: 0 }),
        },
      },
    },
  });
  disposals.push(silo.dispose);
  return { mock, silo };
};

test("persisted snapshots, writes, and external reports reach every consumer", async () => {
  const { silo, mock } = createHarness();
  mock.store.set("silo:theme", "stored");
  const changed = vi.fn();
  render(Harness, { silo, onChange: changed });
  flushSync();
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["stored/ready/ready", "stored/ready/ready"]);
  expect(changed).not.toHaveBeenCalled();
  await fireEvent.click(
    screen.getAllByRole("button")[0] ?? expect.fail("Missing button"),
  );
  expect(mock.store.get("silo:theme")).toBe("updated");
  expect(
    screen
      .getAllByRole("button")
      .every((button) => button.textContent === "updated/ready/ready"),
  ).toBe(true);
  expect(changed).toHaveBeenCalledExactlyOnceWith("updated");
  mock.emit({ key: "silo:theme", value: "outside" });
  await tick();
  expect(
    screen
      .getAllByRole("button")
      .every((button) => button.textContent === "outside/ready/ready"),
  ).toBe(true);
});

test("consecutive assignments read the latest value before rendering", async () => {
  const { silo, mock } = createHarness();
  render(CounterHarness, {
    silo,
    external: () => mock.emit({ key: "silo:count", value: 10 }),
  });
  flushSync();
  await fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button").textContent).toBe("11");
  expect(mock.store.get("silo:count")).toBe(11);
});

test("scope, key, and provider replacements retarget reads, setters, and native handles", async () => {
  const first = createHarness();
  const second = createHarness();
  first.mock.store.set("silo:a:theme", "A");
  first.mock.store.set("silo:b:other", "B");
  second.mock.store.set("silo:b:other", "C");
  const changed = vi.fn();
  const view = render(Harness, {
    silo: first.silo,
    scope: "a",
    name: "theme",
    onChange: changed,
  });
  flushSync();
  expect(screen.getAllByRole("button")[0]?.textContent).toBe("A/ready/ready");
  await view.rerender({ scope: "b", name: "other" });
  expect(screen.getAllByRole("button")[0]?.textContent).toBe("B/ready/ready");
  await view.rerender({ silo: second.silo });
  expect(screen.getAllByRole("button")[0]?.textContent).toBe("C/ready/ready");
  expect(screen.getAllByText("true")).toHaveLength(2);
  first.silo.scope("b").value("other").set("old");
  await tick();
  expect(changed).not.toHaveBeenCalled();
  await fireEvent.click(
    screen.getAllByRole("button")[0] ?? expect.fail("Missing button"),
  );
  expect(second.mock.store.get("silo:b:other")).toBe("updated");
  view.unmount();
  await tick();
  second.silo.scope("b").value("other").set("after unmount");
  expect(changed).toHaveBeenCalledTimes(1);
  expect(first.mock.disposeCount()).toBe(0);
  expect(second.mock.disposeCount()).toBe(0);
});

test("async hydration and failed writes keep the optimistic snapshot", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { theme: value({ fallback: "light" }) },
      },
    },
  });
  disposals.push(silo.dispose);
  mock.store.set("silo:theme", "stored");
  render(Harness, { silo });
  flushSync();
  expect(screen.getAllByRole("button")[0]?.textContent).toBe(
    "light/hydrating/ready",
  );
  mock.calls[0]?.settle();
  await silo.value("theme").hydrated();
  await tick();
  expect(screen.getAllByRole("button")[0]?.textContent).toBe(
    "stored/ready/ready",
  );
  await fireEvent.click(
    screen.getAllByRole("button")[0] ?? expect.fail("Missing button"),
  );
  mock.calls.at(-1)?.fail(new Error("quota"));
  await expect(silo.flush()).rejects.toThrow("quota");
  await tick();
  expect(screen.getAllByRole("button")[0]?.textContent).toBe(
    "updated/error/ready",
  );
});

test("status-only consumers never read the value snapshot", () => {
  const { silo } = createHarness();
  const get = vi.spyOn(silo.value("theme"), "get");
  render(StatusHarness, { silo });
  flushSync();
  expect(screen.getByText("ready")).toBeDefined();
  expect(get).not.toHaveBeenCalled();
});

test("object snapshots retain their identities", () => {
  const object = { nested: { count: 1 } };
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { theme: value({ fallback: object }) },
      },
    },
  });
  disposals.push(silo.dispose);
  render(IdentityHarness, { silo, expected: object });
  expect(screen.getByText("true")).toBeDefined();
});

test("missing providers fail with an actionable message", () => {
  expect(() => render(View)).toThrow("within a SiloProvider");
});

test("unmount releases every value and status subscription", async () => {
  const { silo } = createHarness();
  const value = silo.value("theme");
  const released = vi.fn();
  const subscribe = value.subscribe;
  const subscribeStatus = value.status.subscribe;
  vi.spyOn(value, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    return () => {
      stop();
      released();
    };
  });
  vi.spyOn(value.status, "subscribe").mockImplementation((listener) => {
    const stop = subscribeStatus(listener);
    return () => {
      stop();
      released();
    };
  });
  const view = render(Harness, { silo });
  flushSync();
  expect(released).not.toHaveBeenCalled();
  view.unmount();
  await tick();
  expect(released).toHaveBeenCalledTimes(6);
});
