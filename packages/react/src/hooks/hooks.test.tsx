// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SiloProvider } from "src/context/SiloProvider";
import { useNativeStorage } from "src/hooks/useNativeStorage";
import { useScope } from "src/hooks/useScope";
import { useSilo } from "src/hooks/useSilo";
import { useSiloStatus } from "src/hooks/useSiloStatus";
import { useValue } from "src/hooks/useValue";
import { useValueStatus } from "src/hooks/useValueStatus";

type Theme = "light" | "dark";
type User = { id: string };

const schema = {
  theme: value<Theme>({ fallback: "light" }),
  user: value<User>(),
  count: value({ fallback: 0 }),
  callback: value<() => string>(),
};

// `scope` is read on every render, so a test re-points the provider by
// changing it and rerendering, the way a signed-in user changing would.
const wrapperFor = (silo: Silo, scope: { current?: string } = {}) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <SiloProvider silo={silo} scope={scope.current}>
      {children}
    </SiloProvider>
  );

  return wrapper;
};

const syncHarness = (stored: Record<string, unknown> = {}) => {
  const mock = createMockAdapter();
  Object.entries(stored).forEach(([key, stored]) =>
    mock.store.set(key, stored),
  );
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: schema } },
  });

  return { mock, silo, wrapper: wrapperFor(silo) };
};

const asyncHarness = (stored: Record<string, unknown> = {}) => {
  const mock = createMockAdapter({ mode: "async" });
  Object.entries(stored).forEach(([key, stored]) =>
    mock.store.set(key, stored),
  );
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: schema } },
  });

  return { mock, silo, wrapper: wrapperFor(silo) };
};

const reads = (mock: {
  calls: ReadonlyArray<{ operation: string; key: string }>;
}) => mock.calls.filter((call) => call.operation === "get");

afterEach(cleanup);

describe("provider", () => {
  test("requires an explicit provider", () => {
    expect(() => renderHook(() => useValue("theme"))).toThrow(
      "within a SiloProvider",
    );
  });

  test("exposes the store, the root scope and the adapter's native storage", () => {
    const { mock, silo, wrapper } = syncHarness();
    const { result } = renderHook(
      () => ({
        silo: useSilo(),
        scope: useScope(),
        native: useNativeStorage(),
      }),
      { wrapper },
    );

    expect(result.current.silo).toBe(silo);
    // The store is its own root scope, so nothing is built for the default.
    expect(result.current.scope).toBe(silo);
    expect(result.current.native.default).toBe(mock.adapter.native);
  });

  test("a scope prop re-points every value hook, and changing it swaps the keyspace", () => {
    const { mock, silo } = syncHarness({
      "silo:users:a:theme": "dark",
      "silo:users:b:theme": "light",
    });
    const scope = { current: "users:a" };
    const { result, rerender } = renderHook(
      () => ({ scope: useScope(), theme: useValue("theme") }),
      { wrapper: wrapperFor(silo, scope) },
    );

    expect(result.current.theme[0]).toBe("dark");
    expect(result.current.scope).not.toBe(silo);
    // The scope handle is the provider's, so `clear()` from a hook reaches the
    // right keys without restating the segment.
    expect(result.current.scope.value("theme")).toBe(
      silo.scope("users:a").value("theme"),
    );

    act(() => result.current.theme[1]("light"));
    expect(mock.store.get("silo:users:a:theme")).toBe("light");
    expect(silo.value("theme").get()).toBe("light");

    scope.current = "users:b";
    rerender();
    expect(result.current.theme[0]).toBe("light");
    act(() => result.current.theme[1]("dark"));
    expect(mock.store.get("silo:users:b:theme")).toBe("dark");
    expect(mock.store.get("silo:users:a:theme")).toBe("light");
  });
});

describe("useValue", () => {
  test("renders the persisted value on the first render of a synchronous adapter", () => {
    const { wrapper } = syncHarness({ "silo:theme": "dark" });

    const rendered: unknown[] = [];

    // No act, no await, and no correcting second render: the payoff of a
    // synchronous adapter is that the first paint already carries what is on
    // disk.
    renderHook(
      () => {
        const [theme] = useValue("theme");
        rendered.push(theme);

        return theme;
      },
      { wrapper },
    );

    expect(rendered).toEqual(["dark"]);
  });

  test("rerenders once per accepted change and not at all for an unchanged value", () => {
    const { wrapper } = syncHarness();
    const render = vi.fn();
    const { result } = renderHook(
      () => {
        render();

        return useValue("theme");
      },
      { wrapper },
    );

    expect(render).toHaveBeenCalledTimes(1);
    act(() => result.current[1]("dark"));
    expect(result.current[0]).toBe("dark");
    expect(render).toHaveBeenCalledTimes(2);
    act(() => result.current[1]("dark"));
    expect(render).toHaveBeenCalledTimes(2);
  });

  test("keeps the snapshot and the setter referentially stable across renders", () => {
    const { wrapper } = syncHarness({ "silo:user": { id: "first" } });
    const { result, rerender } = renderHook(() => useValue("user"), {
      wrapper,
    });
    const [snapshot, setUser] = result.current;

    expect(snapshot).toEqual({ id: "first" });
    rerender();
    // A fresh identity per render is what makes useSyncExternalStore loop.
    expect(result.current[0]).toBe(snapshot);
    expect(result.current[1]).toBe(setUser);
    act(() => setUser({ id: "second" }));
    expect(result.current[0]).toEqual({ id: "second" });
    expect(result.current[1]).toBe(setUser);
  });

  test("updaters read consecutive and external writes before React rerenders", () => {
    const { mock, wrapper } = syncHarness();
    const { result } = renderHook(() => useValue("count"), { wrapper });
    const update = vi.fn((previous: unknown) => Number(previous) + 1);
    const setCount = result.current[1];

    act(() => {
      setCount(update);
      setCount(update);
      mock.emit({ key: "silo:count", value: 10 });
      setCount(update);
    });

    expect(update.mock.calls).toEqual([[0], [1], [10]]);
    expect(result.current[0]).toBe(11);
    expect(result.current[1]).toBe(setCount);
    expect(mock.store.get("silo:count")).toBe(11);
  });

  test("updates use the new key, scope, and provider after replacement", () => {
    const first = syncHarness();
    const second = syncHarness({ "silo:b:count": 10 });
    const selected = { silo: first.silo, scope: "a" };
    const Wrapper = ({ children }: PropsWithChildren) => (
      <SiloProvider silo={selected.silo} scope={selected.scope}>
        {children}
      </SiloProvider>
    );
    const { result, rerender } = renderHook(({ name }) => useValue(name), {
      wrapper: Wrapper,
      initialProps: { name: "theme" },
    });

    selected.silo = second.silo;
    selected.scope = "b";
    rerender({ name: "count" });
    act(() => result.current[1]((previous: unknown) => Number(previous) + 1));
    expect(second.mock.store.get("silo:b:count")).toBe(11);
    expect(first.mock.store.size).toBe(0);
  });

  test("an update supersedes pending hydration and composes with pending writes", async () => {
    const mock = createMockAdapter({ mode: "async", hold: true });
    mock.store.set("silo:count", 100);
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema } },
    });
    const { result } = renderHook(() => useValue("count"), {
      wrapper: wrapperFor(silo),
    });
    const read = mock.calls[0];

    act(() => {
      result.current[1]((previous: unknown) => Number(previous) + 1);
      result.current[1]((previous: unknown) => Number(previous) + 1);
    });
    expect(result.current[0]).toBe(2);
    await act(async () => {
      read?.settle();
      await silo.value("count").hydrated();
      mock.calls.find((call) => call.operation === "set")?.settle();
      await vi.waitFor(() =>
        expect(
          mock.calls.filter((call) => call.operation === "set"),
        ).toHaveLength(2),
      );
      mock.calls.at(-1)?.settle();
      await silo.flush();
    });
    expect(result.current[0]).toBe(2);
    expect(mock.store.get("silo:count")).toBe(2);
    silo.dispose();
  });

  test("function values are wrapped, undefined removes, and updater errors leave state intact", () => {
    const { silo, mock, wrapper } = syncHarness();
    const { result } = renderHook(() => useValue("callback"), { wrapper });
    const callback = vi.fn(() => "saved");
    act(() => result.current[1](() => callback));
    expect(result.current[0]).toBe(callback);
    expect(callback).not.toHaveBeenCalled();
    const calls = mock.calls.length;
    const error = new Error("update failed");
    expect(() =>
      result.current[1](() => {
        throw error;
      }),
    ).toThrow(error);
    expect(result.current[0]).toBe(callback);
    expect(mock.calls).toHaveLength(calls);
    act(() => result.current[1](() => undefined));
    expect(result.current[0]).toBeUndefined();
    expect(silo.value("callback").get()).toBeUndefined();
    expect(mock.store.has("silo:callback")).toBe(false);
  });

  test("carries the fallback until an asynchronous adapter hydrates", async () => {
    const { silo, wrapper } = asyncHarness({ "silo:theme": "dark" });
    const { result } = renderHook(() => useValue("theme"), { wrapper });

    expect(result.current[0]).toBe("light");
    await act(() => silo.value("theme").hydrated());
    expect(result.current[0]).toBe("dark");
  });

  test("reports a change another tab made", () => {
    const { mock, wrapper } = syncHarness();
    const handleChange = vi.fn();
    const { result } = renderHook(() => useValue("theme", handleChange), {
      wrapper,
    });

    act(() => mock.emit({ key: "silo:theme", value: "dark" }));
    expect(result.current[0]).toBe("dark");
    expect(handleChange).toHaveBeenCalledExactlyOnceWith("dark");
  });

  test("stops observing after unmount", () => {
    const { silo, wrapper } = syncHarness();
    const handleChange = vi.fn();
    const { unmount } = renderHook(() => useValue("theme", handleChange), {
      wrapper,
    });

    act(() => silo.value("theme").set("dark"));
    expect(handleChange).toHaveBeenCalledExactlyOnceWith("dark");
    unmount();
    act(() => silo.value("theme").set("light"));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});

describe("useValueStatus", () => {
  test("observes status without reading the value", () => {
    const { mock, silo, wrapper } = syncHarness({ "silo:theme": "dark" });
    const render = vi.fn();
    const { result } = renderHook(
      () => {
        render();

        return useValueStatus("theme");
      },
      { wrapper },
    );

    expect(result.current).toEqual({ state: "ready" });
    // Reaching the key is the only read: status carries no demand of its own.
    expect(reads(mock)).toHaveLength(1);
    act(() => silo.value("theme").set("light"));
    expect(silo.value("theme").get()).toBe("light");
    expect(render).toHaveBeenCalledTimes(1);
    expect(reads(mock)).toHaveLength(1);
  });

  test("reports a failed write with the phase that failed", () => {
    const { mock, silo, wrapper } = syncHarness();
    const { result } = renderHook(() => useValueStatus("theme"), { wrapper });

    expect(result.current).toEqual({ state: "ready" });
    mock.adapter.dispose();
    act(() => silo.value("theme").set("dark"));
    expect(result.current).toEqual({
      state: "error",
      error: { phase: "write", cause: expect.any(Error) },
    });
  });
});

describe("useSiloStatus", () => {
  test("follows the store from migrating to ready without touching a value", async () => {
    const mock = createMockAdapter({ mode: "async" });
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: schema } },
      migrations: { 1: async (store) => await store.set("theme", "dark") },
    });
    const handleChange = vi.fn();
    const { result } = renderHook(() => useSiloStatus(handleChange), {
      wrapper: wrapperFor(silo),
    });

    expect(result.current).toEqual({ state: "migrating" });
    expect(reads(mock)).toHaveLength(1);
    await act(() => silo.ready());
    expect(result.current).toEqual({ state: "ready" });
    expect(handleChange).toHaveBeenCalledExactlyOnceWith({ state: "ready" });
    // The version record was the only read: no value hook, no value read.
    expect(reads(mock).map((call) => call.key)).toEqual(["silo::version"]);
  });

  test("reports a failed migration with the migrate phase", () => {
    const mock = createMockAdapter();
    const silo = new Silo({
      storages: { default: { adapters: [mock.adapter], schema: schema } },
      migrations: {
        1: () => {
          throw new Error("migration 1 failed");
        },
      },
    });
    const { result } = renderHook(() => useSiloStatus(), {
      wrapper: wrapperFor(silo),
    });

    expect(result.current).toEqual({
      state: "error",
      error: { phase: "migrate", cause: expect.any(Error) },
    });
  });
});
