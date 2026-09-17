import { render } from "@solidjs/testing-library";
import { createEffect } from "solid-js";
import { expect, test, vi } from "vitest";
import { useObservableValue } from "src/primitives/internal/useObservableValue";

test("subscription catches a change after render and releases the subscription", () => {
  let snapshot = 0;
  const stop = vi.fn();
  const observable = { get: () => snapshot, subscribe: () => stop };
  const View = () => {
    createEffect(() => {
      snapshot = 1;
    });
    const value = useObservableValue(() => observable);
    return <span>{value()}</span>;
  };
  const view = render(() => <View />);
  expect(view.container.textContent).toBe("1");
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
