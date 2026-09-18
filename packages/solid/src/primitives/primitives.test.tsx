import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@solidjs/testing-library";
import { createEffect, createSignal } from "solid-js";
import { afterEach, expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import {
  SiloProvider,
  useNativeStorage,
  useSilo,
  useScope,
  useSiloStatus,
  useValue,
  useValueStatus,
} from "src/index";

const disposals: Array<() => void> = [];
afterEach(() => {
  cleanup();
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
          callback: value<() => string>(),
        },
      },
    },
  });
  disposals.push(silo.dispose);
  return { mock, silo };
};

test("explicit handles need no provider and accessors retarget subscriptions and setters", () => {
  const { silo } = createHarness();
  const first = silo.scope("workspaces:7").value("count");
  const second = silo.scope("workspaces:7:users:2").value("count");
  second.set(5);
  const [handle, setHandle] = createSignal(first);
  const changed = vi.fn();
  const { unmount } = render(() => {
    const [count, setCount] = useValue(handle, changed);
    const [root, setRoot] = useValue(silo.value("count"));
    const status = useValueStatus(handle);
    return (
      <button
        onClick={() => {
          setCount((previous) => previous + 1);
          setRoot((previous) => previous + 1);
        }}
      >
        {root()}/{count()}/{status().state}
      </button>
    );
  });
  expect(screen.getByRole("button").textContent).toBe("0/0/ready");
  fireEvent.click(screen.getByRole("button"));
  expect(first.get()).toBe(1);
  setHandle(second);
  changed.mockClear();
  first.set(9);
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole("button").textContent).toBe("1/5/ready");
  fireEvent.click(screen.getByRole("button"));
  expect(second.get()).toBe(6);
  expect(screen.getByRole("button").textContent).toBe("2/6/ready");
  unmount();
  changed.mockClear();
  second.set(7);
  expect(changed).not.toHaveBeenCalled();
});
const View = (props: {
  name?: string;
  onChange?: (value: unknown) => void;
}) => {
  const [snapshot, setSnapshot] = useValue(
    () => props.name ?? "theme",
    (next) => props.onChange?.(next),
  );
  const status = useValueStatus(() => props.name ?? "theme");
  const siloStatus = useSiloStatus();
  return (
    <button onClick={() => setSnapshot("updated")}>
      {String(snapshot())}/{status().state}/{siloStatus().state}
    </button>
  );
};

test("persisted snapshots, writes, and external reports reach every consumer", () => {
  const { silo, mock } = createHarness();
  mock.store.set("silo:theme", "stored");
  const changed = vi.fn();
  render(() => (
    <SiloProvider silo={silo}>
      <View onChange={changed} />
      <View />
    </SiloProvider>
  ));
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["stored/ready/ready", "stored/ready/ready"]);
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(
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
  expect(
    screen
      .getAllByRole("button")
      .every((button) => button.textContent === "outside/ready/ready"),
  ).toBe(true);
});

test("scope, key, and provider replacements retarget reads, setters, and native handles", () => {
  const first = createHarness();
  const second = createHarness();
  const [selected, select] = createSignal(first.silo);
  const [scope, setScope] = createSignal("a");
  const [key, setKey] = createSignal<"theme" | "other">("theme");
  first.mock.store.set("silo:a:theme", "A");
  first.mock.store.set("silo:b:other", "B");
  second.mock.store.set("silo:b:other", "C");
  const changed = vi.fn();
  const Probe = () => {
    const silo = useSilo();
    const native = useNativeStorage();
    const scoped = useScope();
    return (
      <section>
        <span>
          {String(
            silo() === selected() &&
              native().default === selected().native.default &&
              scoped().value(key()) === selected().scope(scope()).value(key()),
          )}
        </span>
        <View name={key()} onChange={changed} />
      </section>
    );
  };
  const view = render(() => (
    <SiloProvider silo={selected()} scope={scope()}>
      <Probe />
    </SiloProvider>
  ));
  expect(view.container.textContent).toBe("trueA/ready/ready");
  setScope("b");
  setKey("other");
  expect(view.container.textContent).toBe("trueB/ready/ready");
  select(second.silo);
  expect(view.container.textContent).toBe("trueC/ready/ready");
  first.silo.scope("b").value("other").set("old");
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  expect(second.mock.store.get("silo:b:other")).toBe("updated");
  view.unmount();
  second.silo.scope("b").value("other").set("after unmount");
  expect(changed).toHaveBeenCalledTimes(1);
  expect(first.mock.disposeCount()).toBe(0);
  expect(second.mock.disposeCount()).toBe(0);
});

test("updaters compose with external writes and return the resolved value", () => {
  const { silo, mock } = createHarness();
  const {
    result: [count, setCount],
  } = renderHook(() => useValue("count"), {
    wrapper: (props) => (
      <SiloProvider silo={silo}>{props.children}</SiloProvider>
    ),
  });
  const update = vi.fn((previous: unknown) => Number(previous) + 1);
  expect(setCount(update)).toBe(1);
  expect(setCount(update)).toBe(2);
  mock.emit({ key: "silo:count", value: 10 });
  expect(setCount(update)).toBe(11);
  expect(update.mock.calls).toEqual([[0], [1], [10]]);
  expect(count()).toBe(11);
  expect(mock.store.get("silo:count")).toBe(11);
});

test("setters do not track reactive reads and keep the target captured before an updater", () => {
  const { silo, mock } = createHarness();
  const [key, setKey] = createSignal("count");
  const [amount, setAmount] = createSignal(1);
  const update = vi.fn((previous: unknown) => Number(previous) + amount());
  const {
    result: [snapshot, setSnapshot],
  } = renderHook(
    () => {
      const result = useValue(key);
      createEffect(() => {
        result[1](update);
      });
      return result;
    },
    {
      wrapper: (props) => (
        <SiloProvider silo={silo}>{props.children}</SiloProvider>
      ),
    },
  );
  expect(snapshot()).toBe(1);
  setAmount(5);
  expect(update).toHaveBeenCalledTimes(1);
  expect(
    setSnapshot((previous: unknown) => {
      setKey("other");
      return Number(previous) + 1;
    }),
  ).toBe(2);
  expect(mock.store.get("silo:count")).toBe(2);
  expect(snapshot()).toBe("other");
  expect(setSnapshot((previous: unknown) => `${String(previous)}!`)).toBe(
    "other!",
  );
  expect(mock.store.get("silo:other")).toBe("other!");
  expect(update).toHaveBeenCalledTimes(1);
});

test("wrapped functions remain values and throwing updaters do not write", () => {
  const { silo, mock } = createHarness();
  const {
    result: [callback, setCallback],
  } = renderHook(() => useValue("callback"), {
    wrapper: (props) => (
      <SiloProvider silo={silo}>{props.children}</SiloProvider>
    ),
  });
  const fn = vi.fn(() => "saved");
  expect(setCallback(() => fn)).toBe(fn);
  expect(callback()).toBe(fn);
  expect(fn).not.toHaveBeenCalled();
  const calls = mock.calls.length;
  expect(() =>
    setCallback(() => {
      throw new Error("failed");
    }),
  ).toThrow("failed");
  expect(mock.calls).toHaveLength(calls);
  expect(callback()).toBe(fn);
  expect(setCallback(() => undefined)).toBeUndefined();
  expect(callback()).toBeUndefined();
  expect(mock.store.has("silo:callback")).toBe(false);
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
  render(() => (
    <SiloProvider silo={silo}>
      <View />
    </SiloProvider>
  ));
  expect(screen.getByRole("button").textContent).toBe("light/hydrating/ready");
  mock.calls[0]?.settle();
  await silo.value("theme").hydrated();
  expect(screen.getByRole("button").textContent).toBe("stored/ready/ready");
  fireEvent.click(screen.getByRole("button"));
  mock.calls.at(-1)?.fail(new Error("quota"));
  await expect(silo.flush()).rejects.toThrow("quota");
  expect(screen.getByRole("button").textContent).toBe("updated/error/ready");
});

test("status-only consumers never read the value snapshot", () => {
  const { silo } = createHarness();
  const get = vi.spyOn(silo.value("theme"), "get");
  const Status = () => {
    const status = useValueStatus("theme");
    return <span>{status().state}</span>;
  };
  render(() => (
    <SiloProvider silo={silo}>
      <Status />
    </SiloProvider>
  ));
  expect(screen.getByText("ready")).toBeDefined();
  expect(get).not.toHaveBeenCalled();
});

test("object and function snapshots retain their identities", () => {
  const object = { nested: { count: 1 } };
  const fn = () => "value";
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: {
          object: value({ fallback: object }),
          fn: value({ fallback: fn }),
        },
      },
    },
  });
  disposals.push(silo.dispose);
  const Probe = () => {
    const [snapshot] = useValue("object");
    const [callable] = useValue("fn");
    expect(snapshot()).toBe(object);
    expect(callable()).toBe(fn);
    return <span>{String(snapshot() === object)}</span>;
  };
  render(() => (
    <SiloProvider silo={silo}>
      <Probe />
    </SiloProvider>
  ));
  expect(screen.getByText("true")).toBeDefined();
});

test("missing providers fail with an actionable message", () => {
  expect(() => render(() => <View />)).toThrow("within a SiloProvider");
});

test("unmount releases every value and status subscription", () => {
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
  const view = render(() => (
    <SiloProvider silo={silo}>
      <View />
    </SiloProvider>
  ));
  expect(released).not.toHaveBeenCalled();
  view.unmount();
  expect(released).toHaveBeenCalledTimes(3);
});
