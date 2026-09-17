import { expect, test, vi } from "vitest";
import { Lifetime } from "src/utils/common/Lifetime";

test("cleanups run once, in reverse order of registration", () => {
  const lifetime = new Lifetime();
  const order: string[] = [];

  lifetime.add(() => order.push("adapter"));
  lifetime.add(() => order.push("values"));
  lifetime.add(() => order.push("observation"));
  lifetime.dispose();
  lifetime.dispose();

  expect(order).toEqual(["observation", "values", "adapter"]);
});

test("a cleanup that throws does not stop the rest, and every failure is rethrown", () => {
  const lifetime = new Lifetime();
  const last = vi.fn();

  lifetime.add(last);
  lifetime.add(() => {
    throw new Error("second");
  });
  lifetime.add(() => {
    throw new Error("first");
  });

  expect(() => lifetime.dispose()).toThrow(AggregateError);
  expect(last).toHaveBeenCalledTimes(1);

  const single = new Lifetime();
  single.add(() => {
    throw new Error("only");
  });

  expect(() => single.dispose()).toThrow("only");
});

test("a cleanup added after the end runs at once", () => {
  const lifetime = new Lifetime();
  const late = vi.fn();

  lifetime.dispose();
  lifetime.add(late);

  expect(late).toHaveBeenCalledTimes(1);
});

test("setup undoes what was acquired when the acquisition throws, and reports both failures", () => {
  const lifetime = new Lifetime();
  const acquired = vi.fn();

  expect(() =>
    lifetime.setup(() => {
      lifetime.add(acquired);
      throw new Error("acquisition failed");
    }),
  ).toThrow("acquisition failed");
  expect(acquired).toHaveBeenCalledTimes(1);

  const broken = new Lifetime();

  expect(() =>
    broken.setup(() => {
      broken.add(() => {
        throw new Error("cleanup failed");
      });
      throw new Error("acquisition failed");
    }),
  ).toThrow(AggregateError);
  expect(broken.setup(() => "value")).toBe("value");
});

test("an individually released resource is not disposed again during rollback", () => {
  const lifetime = new Lifetime();
  const cleanup = vi.fn(() => {
    throw new Error("cleanup failed");
  });
  const release = lifetime.add(cleanup);
  expect(release).toThrow("cleanup failed");
  release();
  lifetime.dispose();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("cleanup can release another resource, register a cleanup, and dispose again", () => {
  const lifetime = new Lifetime();
  const order: string[] = [];
  const releaseFirst = lifetime.add(() => order.push("first"));
  lifetime.add(() => order.push("second"));
  lifetime.add(() => {
    order.push("third");
    releaseFirst();
    lifetime.add(() => order.push("late"));
    lifetime.dispose();
  });

  lifetime.dispose();
  releaseFirst();

  expect(order).toEqual(["third", "first", "late", "second"]);
});
