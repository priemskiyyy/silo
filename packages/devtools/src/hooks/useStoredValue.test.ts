import { createRoot } from "solid-js";
import { afterEach, expect, test } from "vitest";
import { useStoredValue } from "src/hooks/useStoredValue";

afterEach(() => {
  localStorage.clear();
});

const parseCount = (raw: unknown) => (typeof raw === "number" ? raw : 0);

test("reads the stored value, writes updates, and follows other tabs", () => {
  localStorage.setItem("count", "3");
  localStorage.setItem("broken", "{");

  createRoot((dispose) => {
    const [count, setCount] = useStoredValue("count", parseCount, 0);
    const [broken] = useStoredValue("broken", parseCount, 7);
    expect(count()).toBe(3);
    expect(broken()).toBe(7);

    setCount(4);
    expect(localStorage.getItem("count")).toBe("4");

    localStorage.setItem("count", "9");
    window.dispatchEvent(new StorageEvent("storage", { key: "count" }));
    expect(count()).toBe(9);

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(count()).toBe(9);
    dispose();
  });
});
