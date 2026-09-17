import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { SiloProvider, useValue, useValueStatus } from "src/index";

test("SSR renders stable fallbacks without subscriptions, writes, or disposal", async () => {
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
  const statusSubscribe = vi.spyOn(handle.status, "subscribe");
  const View = defineComponent(() => {
    const theme = useValue("theme");
    const status = useValueStatus("theme");
    expect(theme.value).toBe(fallback);
    return () =>
      h("span", `${String(theme.value === fallback)}/${status.value.state}`);
  });
  const app = createSSRApp(() => h(SiloProvider, { silo }, () => h(View)));
  expect(await renderToString(app)).toContain("true/ready");
  expect(subscribe).not.toHaveBeenCalled();
  expect(statusSubscribe).not.toHaveBeenCalled();
  expect(mock.calls.map((call) => call.operation)).toEqual(["get"]);
  expect(mock.disposeCount()).toBe(0);
  silo.dispose();
});
