import { cleanup, render } from "@testing-library/react";
import { StrictMode, createElement } from "react";
import { renderToString } from "react-dom/server";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { SiloProvider } from "@priemskiyyy/silo-react";
import { afterEach, expect, test } from "vitest";
import { SiloDevtools } from "src/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const Schema = { theme: value({ fallback: "light" }) };

const shadowText = (container: HTMLElement) =>
  container.querySelector("[data-silo-devtools]")?.shadowRoot?.textContent ??
  "";

test("the React wrapper mounts the inspector for the provider's store and removes it on unmount", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const view = render(
    createElement(
      StrictMode,
      null,
      createElement(
        SiloProvider,
        { silo },
        createElement(SiloDevtools, { initialIsOpen: true }),
      ),
    ),
  );

  expect(shadowText(view.container)).toContain("All records");
  expect(mock.calls).toEqual([]);
  view.unmount();
  expect(view.container.querySelector("[data-silo-devtools]")).toBeNull();
  silo.dispose();
});

test("server rendering emits only the host element and reaches no value", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const html = renderToString(
    createElement(
      SiloProvider,
      { silo },
      createElement(SiloDevtools, { initialIsOpen: true }),
    ),
  );

  expect(html).toBe('<div data-silo-devtools=""></div>');
  expect(mock.calls).toEqual([]);
  silo.dispose();
});
