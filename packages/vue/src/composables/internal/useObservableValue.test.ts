import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, onMounted } from "vue";
import { expect, test, vi } from "vitest";
import { useObservableValue } from "src/composables/internal/useObservableValue";

test("mount catches a change after render and releases the subscription", async () => {
  let snapshot = 0;
  const stop = vi.fn();
  const observable = { get: () => snapshot, subscribe: () => stop };
  const View = defineComponent(() => {
    onMounted(() => {
      snapshot = 1;
    });
    const value = useObservableValue(() => observable);
    return () => h("span", value.value);
  });
  const wrapper = mount(View);
  await nextTick();
  expect(wrapper.text()).toBe("1");
  wrapper.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
