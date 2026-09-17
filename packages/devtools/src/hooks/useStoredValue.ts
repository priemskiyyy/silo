import { createSignal, onCleanup } from "solid-js";

/**
 * A signal backed by `localStorage` and kept in sync with other tabs through
 * `storage` events. Unavailable or corrupt storage falls back to `fallback`;
 * `parse` decides what a stored value is allowed to be.
 */
export const useStoredValue = <TValue>(
  key: string,
  parse: (raw: unknown) => TValue,
  fallback: TValue,
) => {
  const read = (): TValue => {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) {
        return fallback;
      }

      return parse(JSON.parse(raw));
    } catch {
      return fallback;
    }
  };
  const [value, setValue] = createSignal(read());

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== key) {
      return;
    }

    setValue(() => read());
  };

  window.addEventListener("storage", handleStorage);
  onCleanup(() => window.removeEventListener("storage", handleStorage));

  const update = (next: TValue) => {
    setValue(() => next);

    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return;
    }
  };

  return [value, update] as const;
};
