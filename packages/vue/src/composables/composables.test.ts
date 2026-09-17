import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, shallowRef } from "vue";
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
afterEach(() =>
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose()),
);
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
const View = defineComponent(
  (props: { name?: string; onChange?: (value: unknown) => void }) => {
    const snapshot = useValue(
      () => props.name ?? "theme",
      (next) => props.onChange?.(next),
    );
    const status = useValueStatus(() => props.name ?? "theme");
    const siloStatus = useSiloStatus();
    return () =>
      h(
        "button",
        {
          onClick: () => {
            snapshot.value = "updated";
          },
        },
        `${String(snapshot.value)}/${status.value.state}/${siloStatus.value.state}`,
      );
  },
  { props: ["name", "onChange"] },
);

test("persisted snapshots, writes, and external reports reach every consumer", async () => {
  const { silo, mock } = createHarness();
  mock.store.set("silo:theme", "stored");
  const changed = vi.fn();
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => [h(View, { onChange: changed }), h(View)] },
  });
  disposals.push(() => wrapper.unmount());
  expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
    "stored/ready/ready",
    "stored/ready/ready",
  ]);
  expect(changed).not.toHaveBeenCalled();
  await wrapper.find("button").trigger("click");
  expect(mock.store.get("silo:theme")).toBe("updated");
  expect(
    wrapper
      .findAll("button")
      .every((button) => button.text() === "updated/ready/ready"),
  ).toBe(true);
  expect(changed).toHaveBeenCalledExactlyOnceWith("updated");
  mock.emit({ key: "silo:theme", value: "outside" });
  await nextTick();
  expect(
    wrapper
      .findAll("button")
      .every((button) => button.text() === "outside/ready/ready"),
  ).toBe(true);
});

test("consecutive assignments read the latest value before rendering", async () => {
  const { silo, mock } = createHarness();
  const Counter = defineComponent(() => {
    const count = useValue("count");
    return () =>
      h(
        "button",
        {
          onClick: () => {
            count.value = Number(count.value) + 1;
            count.value = Number(count.value) + 1;
            mock.emit({ key: "silo:count", value: 10 });
            count.value = Number(count.value) + 1;
          },
        },
        String(count.value),
      );
  });
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => h(Counter) },
  });
  disposals.push(() => wrapper.unmount());
  await wrapper.find("button").trigger("click");
  expect(wrapper.find("button").text()).toBe("11");
  expect(mock.store.get("silo:count")).toBe(11);
});

test("scope, key, and provider replacements retarget reads, setters, and native handles", async () => {
  const first = createHarness();
  const second = createHarness();
  const selected = shallowRef(first.silo);
  const scope = shallowRef<string | undefined>("a");
  const key = shallowRef<"theme" | "other">("theme");
  first.mock.store.set("silo:a:theme", "A");
  first.mock.store.set("silo:b:other", "B");
  second.mock.store.set("silo:b:other", "C");
  const changed = vi.fn();
  const Probe = defineComponent(() => {
    const silo = useSilo();
    const native = useNativeStorage();
    const scoped = useScope();
    const correct = computed(
      () =>
        silo.value === selected.value &&
        native.value.default === selected.value.native.default &&
        scoped.value.value(key.value) ===
          selected.value.scope(scope.value ?? "b").value(key.value),
    );
    return () =>
      h("section", [
        h("span", String(correct.value)),
        h(View, { name: key.value, onChange: changed }),
      ]);
  });
  const Root = defineComponent(
    () => () =>
      h(SiloProvider, { silo: selected.value, scope: scope.value }, () =>
        h(Probe),
      ),
  );
  const wrapper = mount(Root);
  disposals.push(() => wrapper.unmount());
  expect(wrapper.text()).toContain("trueA/ready/ready");
  scope.value = "b";
  key.value = "other";
  await nextTick();
  expect(wrapper.text()).toContain("trueB/ready/ready");
  selected.value = second.silo;
  await nextTick();
  expect(wrapper.text()).toContain("trueC/ready/ready");
  first.silo.scope("b").value("other").set("old");
  await nextTick();
  expect(changed).not.toHaveBeenCalled();
  await wrapper.find("button").trigger("click");
  expect(second.mock.store.get("silo:b:other")).toBe("updated");
  expect(first.mock.disposeCount()).toBe(0);
  wrapper.unmount();
  second.silo.scope("b").value("other").set("after unmount");
  expect(changed).toHaveBeenCalledTimes(1);
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
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => h(View) },
  });
  disposals.push(() => wrapper.unmount());
  expect(wrapper.text()).toBe("light/hydrating/ready");
  mock.calls[0]?.settle();
  await silo.value("theme").hydrated();
  await nextTick();
  expect(wrapper.text()).toBe("stored/ready/ready");
  await wrapper.find("button").trigger("click");
  mock.calls.at(-1)?.fail(new Error("quota"));
  await expect(silo.flush()).rejects.toThrow("quota");
  await nextTick();
  expect(wrapper.text()).toBe("updated/error/ready");
});

test("status-only consumers never read the value snapshot", () => {
  const { silo } = createHarness();
  const handle = silo.value("theme");
  const get = vi.spyOn(handle, "get");
  const Status = defineComponent(() => {
    const status = useValueStatus("theme");
    return () => h("span", status.value.state);
  });
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => h(Status) },
  });
  disposals.push(() => wrapper.unmount());
  expect(wrapper.text()).toBe("ready");
  expect(get).not.toHaveBeenCalled();
});

test("stored object references are preserved without deep proxies", () => {
  const object = { nested: { count: 1 } };
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { object: value({ fallback: object }) },
      },
    },
  });
  disposals.push(silo.dispose);
  const Probe = defineComponent(() => {
    const snapshot = useValue("object");
    expect(snapshot.value).toBe(object);
    return () => h("span", String(snapshot.value === object));
  });
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => h(Probe) },
  });
  disposals.push(() => wrapper.unmount());
  expect(wrapper.text()).toBe("true");
});

test("missing providers fail with an actionable message", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() => mount(View)).toThrow("within a SiloProvider");
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
  const wrapper = mount(SiloProvider, {
    props: { silo },
    slots: { default: () => h(View) },
  });
  expect(released).not.toHaveBeenCalled();
  wrapper.unmount();
  expect(released).toHaveBeenCalledTimes(3);
});
