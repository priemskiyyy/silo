import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import type { StorageChange } from "src/types/StorageChange";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const Schema = { count: value({ fallback: 0 }) };

test.each(["available", "native", "observe"])(
  "startup falls through a failed %s before migrations or data access",
  async (stage) => {
    const primary = createMockAdapter();
    const fallback = createMockAdapter();
    const failure = new Error("SDK unavailable");
    let report: (change: StorageChange) => void = () => {};
    const broken = {
      ...primary.adapter,
      available: () => {
        if (stage === "available") {
          throw failure;
        }
        return true;
      },
      get native() {
        if (stage === "native") {
          throw failure;
        }
        return primary.adapter.native;
      },
      observe: (listener: (change: StorageChange) => void) => {
        report = listener;
        throw failure;
      },
    };
    const silo = new Silo({
      storages: {
        default: { adapters: [broken, fallback.adapter], schema: Schema },
      },
      migrations: { 1: (store) => store.set("count", 4) },
    });
    await silo.ready();
    const count = silo.value("count");
    expect(silo.native.default).toBe(fallback.adapter.native);
    expect(primary.calls).toEqual([]);
    expect(primary.disposeCount()).toBe(1);
    expect(count.get()).toBe(4);
    report({ key: "silo:count", value: 99 });
    expect(count.get()).toBe(4);
    silo.dispose();
    expect(fallback.disposeCount()).toBe(1);
  },
);

test("exhausted candidates retain each initialization cause", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();
  const failure = new Error("native unavailable");
  vi.spyOn(first.adapter, "available").mockImplementation(() => {
    throw failure;
  });
  vi.spyOn(second.adapter, "available").mockReturnValue(false);
  expect(
    () =>
      new Silo({
        storages: {
          default: {
            adapters: [first.adapter, second.adapter],
            schema: Schema,
          },
        },
      }),
  ).toThrow(
    expect.objectContaining({
      message: 'No adapter could initialize storage "default".',
      errors: [
        expect.objectContaining({ cause: failure }),
        expect.objectContaining({ message: 'Adapter "mock" is unavailable.' }),
      ],
    }),
  );
  expect(first.disposeCount()).toBe(1);
  expect(second.disposeCount()).toBe(1);
});
