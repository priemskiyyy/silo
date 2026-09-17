import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Backend } from "src/utils/internal/adapter/Backend";

test("sync observers run inline and their exceptions are not storage failures", () => {
  const mock = createMockAdapter();
  const backend = new Backend({ adapter: mock.adapter });
  const error = vi.fn();
  const failure = new Error("observer failed");
  expect(() =>
    backend.get("key", {
      value: () => {
        throw failure;
      },
      error,
    }),
  ).toThrow(failure);
  expect(error).not.toHaveBeenCalled();
});

test("an async adapter's synchronous throw is reported asynchronously", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const failure = new Error("adapter failed before returning a promise");
  const backend = new Backend({
    adapter: {
      ...mock.adapter,
      get: () => {
        throw failure;
      },
    },
  });
  const value = vi.fn();
  const error = vi.fn();
  backend.get("key", { value, error });
  expect(error).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(error).toHaveBeenCalledExactlyOnceWith(failure);
  expect(value).not.toHaveBeenCalled();
});
