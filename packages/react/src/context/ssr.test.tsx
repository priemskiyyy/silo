// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { expect, test, vi } from "vitest";
import { SiloProvider } from "src/context/SiloProvider";
import { useSiloStatus } from "src/hooks/useSiloStatus";
import { useValue } from "src/hooks/useValue";
import { useValueStatus } from "src/hooks/useValueStatus";

const schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
};

test("SSR renders the fallback, writes nothing, and hydrates without a mismatch", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: schema } },
  });
  const onRecoverableError = vi.fn();
  const View = () => {
    const [theme] = useValue("theme");
    const status = useValueStatus("theme");
    const store = useSiloStatus();

    return <span>{`${theme}/${status.state}/${store.state}`}</span>;
  };
  const view = (
    <SiloProvider silo={silo}>
      <View />
    </SiloProvider>
  );
  const html = renderToString(view);

  // Both statuses read their conservative state on the server, so gating on
  // either never renders a value the client has not read yet.
  expect(html).toContain("light/hydrating/migrating");
  // The server touches storage only to ask for the value it renders; it never
  // writes, which is what a browser adapter would throw on there.
  expect(mock.calls.map((call) => call.operation)).toEqual(["get"]);
  expect(mock.store.get("silo:theme")).toBe("dark");
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => {
      root = hydrateRoot(container, view, { onRecoverableError });
    });
    // The hydrating client renders the same fallback the server did; the
    // persisted value arrives after, which is the documented flicker.
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("light/hydrating/ready");
    await act(async () => {
      mock.calls[0]?.settle();
      await silo.value("theme").hydrated();
    });
    expect(container.textContent).toBe("dark/ready/ready");
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
