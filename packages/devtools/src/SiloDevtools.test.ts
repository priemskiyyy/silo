import { fireEvent, within } from "@testing-library/dom";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { afterEach, expect, test } from "vitest";
import { SiloDevtools } from "src/SiloDevtools";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

const schema = { theme: value({ fallback: "light" }) };

const createStore = () => {
  const local = createMockAdapter({
    onCall: (call) => {
      if (call.operation === "set" && call.value === "refused") {
        throw new Error("quota exceeded");
      }
    },
  });
  const secure = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    namespace: "app",
    storages: {
      default: { adapters: [local.adapter], schema },
      secure: {
        adapters: [secure.adapter],
        schema: { token: value<string>() },
        namespace: "",
      },
    },
  });

  return { silo, local, secure };
};

const mountDevtools = (
  options: ConstructorParameters<typeof SiloDevtools>[0],
) => {
  const host = document.body.appendChild(document.createElement("div"));
  const devtools = new SiloDevtools(options);
  devtools.mount(host);
  // Queries need an element; the shadow root's only child is the application root.
  const view = () => {
    const root = host.shadowRoot?.firstElementChild;

    if (!(root instanceof HTMLElement)) {
      throw new Error("Expected the devtools root inside the shadow root");
    }

    return within(root);
  };
  const text = () => host.shadowRoot?.textContent ?? "";

  return { host, devtools, view, text };
};

test("the panel observes a store without reaching any value and lists what the application reached", async () => {
  const { silo, local, secure } = createStore();
  const { devtools, view, text } = mountDevtools({
    silo,
    initialIsOpen: true,
  });

  expect(
    view().getByRole("complementary", { name: "Silo devtools" }),
  ).toBeTruthy();
  expect(text()).toContain("ready");
  expect(text()).toContain("no migrations");
  expect(text()).toContain("nothing reached");
  expect(text()).toContain("mock sync");
  expect(text()).toContain("mock async");
  expect(local.calls).toEqual([]);
  expect(secure.calls).toEqual([]);

  const theme = silo.value("theme");
  theme.set("dark");
  await macrotask();

  const records = view().getByRole("navigation", { name: "Silo records" });
  expect(
    within(records).getByRole("button", { name: /theme/ }).textContent,
  ).toContain("1 accepted / 1 durable");
  expect(
    within(records).getByRole("button", { name: /^All records/ }),
  ).toBeTruthy();
  expect(text()).toContain("write durable");
  expect(text()).toContain("hydrate landed");
  expect(text()).toContain("record created");
  devtools.unmount();
  silo.dispose();
});

test("values stay hidden until asked for, and a selected record can be set and removed through the store", async () => {
  const { silo, local } = createStore();
  const { devtools, view } = mountDevtools({ silo, initialIsOpen: true });
  const theme = silo.scope("users:7").value("theme");
  theme.set("dark");
  await macrotask();

  fireEvent.click(view().getByRole("button", { name: /theme/ }));
  const detail = view().getByRole("region", { name: "Selected record" });
  expect(detail.textContent).toContain("app:users:7:theme");
  expect(detail.textContent).toContain("[Values are hidden]");
  expect(detail.textContent).not.toContain('"dark"');

  fireEvent.click(view().getByRole("checkbox", { name: "Show values" }));
  expect(within(detail).getByLabelText("Snapshot").textContent).toContain(
    '"dark"',
  );

  fireEvent.input(within(detail).getByLabelText("New value as JSON"), {
    target: { value: "{ not json" },
  });
  fireEvent.click(within(detail).getByRole("button", { name: "Set" }));
  expect(within(detail).getByRole("alert").textContent).toMatch(/JSON/);
  expect(theme.get()).toBe("dark");

  fireEvent.input(within(detail).getByLabelText("New value as JSON"), {
    target: { value: '"dim"' },
  });
  fireEvent.click(view().getByRole("button", { name: "Set" }));
  expect(within(detail).queryByRole("alert")).toBeNull();
  expect(theme.get()).toBe("dim");
  expect(local.store.get("app:users:7:theme")).toBe("dim");

  fireEvent.click(view().getByRole("button", { name: "Remove" }));
  expect(theme.get()).toBe("light");
  expect(local.store.has("app:users:7:theme")).toBe(false);

  // A selected record narrows the timeline to its own events.
  await macrotask();
  const rows = view().getByLabelText("Event timeline");
  expect(rows.textContent).toContain("app:users:7:theme");
  fireEvent.click(view().getByRole("button", { name: "Deselect record" }));
  expect(view().queryByRole("region", { name: "Selected record" })).toBeNull();
  devtools.unmount();
  silo.dispose();
});

test("a refused write is an error: it fills the error chip, matches the search, and lights the launcher while closed", async () => {
  const { silo } = createStore();
  const { devtools, view, host } = mountDevtools({ silo, initialIsOpen: true });
  const theme = silo.value("theme");

  fireEvent.keyDown(
    view().getByRole("complementary", { name: "Silo devtools" }),
    { key: "Escape" },
  );
  const launcher = () =>
    view().getByRole("button", { name: "Open Silo devtools" });
  expect(launcher().querySelector(".dot")?.getAttribute("data-state")).toBe(
    "ready",
  );

  // Timestamps are milliseconds; the close and the refusal must not share one.
  await macrotask();
  theme.set("refused");
  await macrotask();

  expect(launcher().querySelector(".dot")?.getAttribute("data-state")).toBe(
    "error",
  );
  fireEvent.click(launcher());
  expect(host.shadowRoot?.activeElement).toBe(
    view().getByRole("complementary", { name: "Silo devtools" }),
  );

  const kinds = view().getByRole("group", { name: "Event kinds" });
  expect(within(kinds).getByRole("button", { name: "Errors 1" })).toBeTruthy();
  fireEvent.click(within(kinds).getByRole("button", { name: "Errors 1" }));
  const rows = view().getByLabelText("Event timeline");
  expect(rows.querySelectorAll("details")).toHaveLength(1);
  expect(rows.textContent).toContain("write refused");
  expect(rows.textContent).toContain("quota exceeded");

  fireEvent.input(view().getByRole("searchbox", { name: "Filter events" }), {
    target: { value: "nothing matches this" },
  });
  expect(view().getByText("No matching events")).toBeTruthy();
  fireEvent.click(view().getByRole("button", { name: "Clear filters" }));
  expect(
    view().getByLabelText("Event timeline").querySelectorAll("details").length,
  ).toBeGreaterThan(1);
  devtools.unmount();
  silo.dispose();
});

test("pausing stops recording, resuming continues it, and clearing forgets everything", async () => {
  const { silo } = createStore();
  const { devtools, view, text } = mountDevtools({
    silo,
    initialIsOpen: true,
    maxEvents: 3,
  });
  const theme = silo.value("theme");
  theme.set("before pause");
  await macrotask();

  // Three is the limit, so the earliest of the four events is already gone.
  expect(
    view().getByLabelText("Event timeline").querySelectorAll("details"),
  ).toHaveLength(3);

  fireEvent.click(view().getByRole("button", { name: "Pause" }));
  theme.set("while paused");
  await macrotask();
  expect(
    view().getByLabelText("Event timeline").querySelectorAll("details"),
  ).toHaveLength(3);

  fireEvent.click(view().getByRole("button", { name: "Clear" }));
  // The log notifies once per microtask, like the store's own diagnostics.
  await macrotask();
  expect(view().getByText("Recording paused")).toBeTruthy();

  fireEvent.click(view().getByRole("button", { name: "Resume" }));
  theme.set("after resume");
  await macrotask();
  expect(text()).toContain("write accepted");
  expect(text()).toContain("write durable");
  expect(
    view().getByLabelText("Event timeline").querySelectorAll("details"),
  ).toHaveLength(2);
  devtools.unmount();
  silo.dispose();
});

test("the launcher opens the panel, the panel resizes and docks, Escape closes it, and the state is remembered", () => {
  const { silo } = createStore();
  const first = mountDevtools({ silo });

  fireEvent.click(
    first.view().getByRole("button", { name: "Open Silo devtools" }),
  );
  const panel = first
    .view()
    .getByRole("complementary", { name: "Silo devtools" });
  expect(first.host.shadowRoot?.activeElement).toBe(panel);
  const handle = () =>
    first.view().getByRole("separator", { name: "Resize devtools" });
  fireEvent.keyDown(handle(), { key: "ArrowUp" });
  expect(panel.style.height).toBe("444px");
  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the right" }),
  );
  expect(panel.dataset.position).toBe("right");
  fireEvent.keyDown(handle(), { key: "ArrowLeft" });
  expect(panel.style.width).toBe("544px");
  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the bottom" }),
  );
  expect(panel.style.height).toBe("444px");
  fireEvent.keyDown(panel, { key: "Escape" });
  const launcher = first
    .view()
    .getByRole("button", { name: "Open Silo devtools" });
  expect(first.host.shadowRoot?.activeElement).toBe(launcher);
  expect(
    JSON.parse(localStorage.getItem("@priemskiyyy/silo-devtools") ?? ""),
  ).toEqual({
    isOpen: false,
    height: 444,
    width: 544,
    position: "bottom",
  });
  first.devtools.unmount();

  const second = mountDevtools({ silo, initialIsOpen: true });
  expect(
    second.view().getByRole("button", { name: "Open Silo devtools" }),
  ).toBeTruthy();
  second.devtools.unmount();
  silo.dispose();
});

test("the sidebar marks a memory floor, the header shows the version, and an async migration chain runs live", async () => {
  const memory = createMockAdapter();
  const mock = createMockAdapter({ mode: "async" });
  const silo = new Silo({
    storages: {
      default: { adapters: [mock.adapter], schema },
      session: {
        adapters: [{ ...memory.adapter, name: "memory" }],
        schema,
      },
    },
    migrations: { 2: async () => undefined },
  });
  const { devtools, view, text } = mountDevtools({ silo, initialIsOpen: true });

  expect(text()).toContain("migrating");
  expect(text()).toContain("reading, 2 declared");
  expect(view().getByRole("region", { name: "session" }).dataset.floor).toBe(
    "",
  );
  expect(
    view().getByRole("region", { name: "default" }).dataset.floor,
  ).toBeUndefined();

  await silo.ready();
  await macrotask();

  expect(text()).toContain("v2 of 2");
  const kinds = view().getByRole("group", { name: "Event kinds" });
  expect(
    within(kinds).getByRole("button", { name: "Migrations 4" }),
  ).toBeTruthy();
  devtools.unmount();
  silo.dispose();
});

test("setSilo follows another store, mounting twice throws, and unmount stops recording", async () => {
  const first = createStore();
  const second = createStore();
  const { devtools, view, host, text } = mountDevtools({
    silo: first.silo,
    initialIsOpen: true,
  });

  expect(() => devtools.mount(host)).toThrow(/already mounted/);

  devtools.setSilo(second.silo);
  second.silo.value("theme").set("second");
  first.silo.value("theme").set("first");
  await macrotask();

  const rows = view().getByLabelText("Event timeline");
  expect(rows.textContent).toContain("app:theme");
  // Only the second store's events were recorded: one create, one hydrate, one write pair.
  expect(rows.querySelectorAll("details")).toHaveLength(4);

  devtools.unmount();
  expect(host.shadowRoot?.childElementCount).toBe(0);
  second.silo.value("theme").set("after unmount");
  await macrotask();
  expect(text()).toBe("");

  first.silo.dispose();
  second.silo.dispose();
});
