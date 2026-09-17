import type { RegisteredKey, RegisteredValue } from "@priemskiyyy/silo-react";
import { useScope, useValue, useValueStatus } from "@priemskiyyy/silo-react";
import { useEffect, useRef, useState } from "react";

export type SaveState<TValue> =
  | { state: "IDLE" }
  | { state: "PENDING" }
  | { state: "DURABLE" }
  | { state: "REFUSED"; value: TValue; cause: unknown };

const OUTSIDE_FLASH_LENGTH = 1_400;

/**
 * A value with its write pipeline beside it. `persist` returns at once and
 * counts as accepted; `flush()` is the only way to know the write landed, and
 * each resolution counts as durable, while a refusal keeps the value here for
 * `retry`. A change that arrives without a local write, from another tab, is
 * flagged for a moment.
 */
export const useDurableValue = <TKey extends RegisteredKey>(key: TKey) => {
  const scope = useScope();
  const status = useValueStatus(key);
  const settled = useRef(false);
  const lastWritten = useRef<{ value: unknown } | null>(null);
  const sequence = useRef(0);
  const [writes, setWrites] = useState({ accepted: 0, durable: 0 });
  const [save, setSave] = useState<SaveState<RegisteredValue<TKey>>>({
    state: "IDLE",
  });
  const [changedOutsideAt, setChangedOutsideAt] = useState<number | null>(null);
  const [value] = useValue(key, (next) => {
    // The first change after mount on an asynchronous storage is hydration
    // landing, and a local write is the value this hook handed over.
    if (!settled.current) {
      return;
    }

    if (
      lastWritten.current !== null &&
      Object.is(next, lastWritten.current.value)
    ) {
      return;
    }

    setChangedOutsideAt(Date.now());
  });

  useEffect(() => {
    if (status.state === "ready") {
      settled.current = true;
    }
  }, [status]);

  useEffect(() => {
    if (changedOutsideAt === null) {
      return;
    }

    const timer = setTimeout(
      () => setChangedOutsideAt(null),
      OUTSIDE_FLASH_LENGTH,
    );
    return () => clearTimeout(timer);
  }, [changedOutsideAt]);

  const persist = (next: RegisteredValue<TKey>) => {
    const handle = scope.value(key);
    sequence.current += 1;
    const write = sequence.current;
    lastWritten.current = { value: next };
    handle.set(next);
    setSave({ state: "PENDING" });
    setWrites((current) => ({ ...current, accepted: current.accepted + 1 }));
    // Only the latest write's barrier speaks: an earlier one resolving while
    // a newer write is in flight would call the value durable too soon.
    handle.flush().then(
      () => {
        setWrites((current) => ({ ...current, durable: current.durable + 1 }));

        if (sequence.current === write) {
          setSave({ state: "DURABLE" });
        }
      },
      (cause: unknown) => {
        if (sequence.current === write) {
          setSave({ state: "REFUSED", value: next, cause });
        }
      },
    );
  };
  const retry = () => {
    if (save.state !== "REFUSED") {
      return;
    }

    persist(save.value);
  };

  return {
    value,
    status,
    save,
    writes,
    persist,
    retry,
    changedOutside: changedOutsideAt !== null,
  };
};
