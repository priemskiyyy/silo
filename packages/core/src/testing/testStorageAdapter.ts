import { describe, expect, test, vi } from "vitest";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";

export type StorageAdapterConformanceOptions<TAdapter extends StorageAdapter> =
  {
    /** Label for the generated `describe` blocks. */
    name: string;
    /** Creates a cold adapter; called once per test, and once more to read `mode`. */
    createAdapter: () => TAdapter;
    /**
     * Values this backend must round-trip, added to the JSON-safe defaults. The
     * corpus is what makes the encoding boundary testable: IndexedDB adds `Date`,
     * `Map` and `Blob`, web storage adds nothing.
     */
    values?: Record<string, unknown>;
    /**
     * Applies a change from outside the adapter, the way another tab would: a
     * `{ key, value }` write, or `{ key: null }` to clear the whole backend.
     * Required for the observation block, which is skipped without it.
     */
    externalWrite?: (
      adapter: TAdapter,
      change: Exclude<StorageChange, { error: unknown }>,
    ) => void | Promise<void>;
  };

const JSON_SAFE_VALUES = {
  string: "value",
  "empty string": "",
  number: 42,
  zero: 0,
  "negative fraction": -1.5,
  true: true,
  false: false,
  "empty array": [],
  array: [1, "two", { three: 3 }],
  "empty object": {},
  "nested object": { nested: { deep: [true, null] } },
} satisfies Record<string, unknown>;

// Platform notifications use real tasks, so a fake clock cannot settle them.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Registers the storage adapter contract every adapter must satisfy. Backend
 * specific behavior stays in the adapter's own tests. The optional members are
 * probed once: an adapter that exposes `keys` or `observe` runs their blocks.
 *
 * Mode specific assertions live in two blocks, only one of which runs: the sync
 * block never awaits, which is the only construction that proves a synchronous
 * adapter is synchronous, and the async block proves every operation returns a
 * promise.
 *
 * @example
 * ```ts
 * testStorageAdapter({
 *   name: "local-storage",
 *   createAdapter: () => localStorage(),
 *   externalWrite: (adapter, change) =>
 *     window.dispatchEvent(new StorageEvent("storage", { ...change, storageArea: adapter.native })),
 * });
 * ```
 */
export const testStorageAdapter = <TAdapter extends StorageAdapter>({
  name,
  createAdapter,
  values = {},
  externalWrite,
}: StorageAdapterConformanceOptions<TAdapter>) => {
  // Read once, and not per test: `mode` is a property of the adapter contract,
  // not of one instance, and every assertion below is chosen from it.
  const probe = createAdapter();
  const mode = probe.mode;
  const observes = typeof probe.observe === "function";
  const lists = typeof probe.keys === "function";
  probe.dispose();

  let composed = 0;
  const nextKey = () => {
    composed += 1;

    return `silo:conformance:${name}:${composed}`;
  };

  /**
   * The single gate every shared assertion passes through: an operation's result
   * must be a promise exactly when the adapter says it is asynchronous.
   */
  const resolve = async <TValue>(
    result: TValue | Promise<TValue>,
  ): Promise<TValue> => {
    expect(
      result instanceof Promise,
      `${name}: a "${mode}" adapter must return ${mode === "async" ? "a promise from every operation" : "a settled value from every operation, never a promise"}`,
    ).toBe(mode === "async");

    return await result;
  };

  const read = (adapter: TAdapter, key: string) => resolve(adapter.get(key));
  const write = (adapter: TAdapter, key: string, value: unknown) =>
    resolve(adapter.set(key, value));
  const drop = (adapter: TAdapter, key: string) => resolve(adapter.remove(key));

  const refuses = async (label: string, operation: () => unknown) => {
    let refused = false;

    try {
      await operation();
    } catch {
      refused = true;
    }

    expect(
      refused,
      `${name}: ${label} must be refused after dispose, by a throw or by a rejected promise`,
    ).toBe(true);
  };

  const list = (adapter: TAdapter) => {
    if (typeof adapter.keys !== "function") {
      throw new Error(
        `${name}: keys is absent from an adapter whose factory reported it`,
      );
    }

    return resolve(adapter.keys());
  };

  const observe = (
    adapter: TAdapter,
    listener: (change: StorageChange) => void,
  ) => {
    if (typeof adapter.observe !== "function") {
      throw new Error(
        `${name}: observe is absent from an adapter whose factory reported it`,
      );
    }

    return adapter.observe(listener);
  };

  describe(`${name} storage adapter conformance`, () => {
    test("the factory reports its name, mode and native handle", () => {
      const adapter = createAdapter();

      expect(
        typeof adapter.name,
        `${name}: an adapter must name itself, so an error can say which one failed`,
      ).toBe("string");
      expect(
        adapter.mode,
        `${name}: mode must be the same on every adapter the factory creates`,
      ).toBe(mode);
      expect(
        adapter,
        `${name}: native must be present, even as null when the platform is absent`,
      ).toHaveProperty("native");
      adapter.dispose();
    });

    test("the availability probe answers a boolean without touching the store", () => {
      const adapter = createAdapter();

      expect(
        typeof adapter.available(),
        `${name}: available must answer a boolean, so a store given a list can choose before anything is read`,
      ).toBe("boolean");
      adapter.dispose();
    });

    test("native identity is stable across reads", async () => {
      const adapter = createAdapter();
      const first = adapter.native;

      await write(adapter, nextKey(), "value");

      expect(
        adapter.native,
        `${name}: native must be identity stable for the adapter's life, so a consumer can hold on to it`,
      ).toBe(first);
      adapter.dispose();
    });

    test("a missing key reads undefined", async () => {
      const adapter = createAdapter();

      expect(
        await read(adapter, nextKey()),
        `${name}: an absent key must read undefined, which is the only value meaning absent`,
      ).toBeUndefined();
      adapter.dispose();
    });

    test.each(Object.entries({ ...JSON_SAFE_VALUES, ...values }))(
      "round-trips %s",
      async (label, value) => {
        const adapter = createAdapter();
        const key = nextKey();

        await write(adapter, key, value);

        expect(
          await read(adapter, key),
          `${name}: ${label} must round-trip through this backend's encoding unchanged`,
        ).toEqual(value);
        adapter.dispose();
      },
    );

    test("null round-trips and stays distinct from an absent key", async () => {
      const adapter = createAdapter();
      const key = nextKey();

      await write(adapter, key, null);

      expect(
        await read(adapter, key),
        `${name}: null is an ordinary stored value and must not read back as absent`,
      ).toBeNull();

      await drop(adapter, key);

      expect(
        await read(adapter, key),
        `${name}: a removed key must read undefined, not null`,
      ).toBeUndefined();
      adapter.dispose();
    });

    test("a later write overwrites the earlier one", async () => {
      const adapter = createAdapter();
      const key = nextKey();

      await write(adapter, key, "first");
      await write(adapter, key, "second");

      expect(
        await read(adapter, key),
        `${name}: a write must replace the stored value, not merge with it`,
      ).toBe("second");
      adapter.dispose();
    });

    test("remove deletes the value and is idempotent", async () => {
      const adapter = createAdapter();
      const key = nextKey();

      await write(adapter, key, "value");
      await drop(adapter, key);

      expect(
        await read(adapter, key),
        `${name}: remove must delete the value`,
      ).toBeUndefined();

      await drop(adapter, key);

      expect(
        await read(adapter, key),
        `${name}: removing twice must leave the key absent, not resurrect it`,
      ).toBeUndefined();
      adapter.dispose();
    });

    test("removing a key that was never written is accepted", async () => {
      const adapter = createAdapter();
      const key = nextKey();

      await drop(adapter, key);

      expect(
        await read(adapter, key),
        `${name}: removing an absent key must be a no-op, not an error and not a write`,
      ).toBeUndefined();
      adapter.dispose();
    });

    test("keys are isolated from each other", async () => {
      const adapter = createAdapter();
      const one = nextKey();
      const two = nextKey();

      await write(adapter, one, "one");
      await write(adapter, two, "two");
      await drop(adapter, one);

      expect(
        await read(adapter, two),
        `${name}: removing one key must leave every other key untouched`,
      ).toBe("two");
      adapter.dispose();
    });

    test("a key is opaque and must never be transformed", async () => {
      const adapter = createAdapter();
      const prefix = nextKey();
      const keys = [
        `${prefix}:a:b`,
        `${prefix} spaced `,
        `${prefix}/slash`,
        `${prefix}?query=1&flag`,
        `${prefix}UPPER`,
        `${prefix}🙂`,
        "__proto__",
        "constructor",
      ];

      for (const [index, key] of keys.entries()) {
        await write(adapter, key, index);
      }

      for (const [index, key] of keys.entries()) {
        expect(
          await read(adapter, key),
          `${name}: the core composes physical keys, so "${key}" must read back exactly what was written under it`,
        ).toBe(index);
      }

      // Keys a normalizing adapter would collide with.
      for (const near of [
        `${prefix}.a.b`,
        `${prefix}spaced`,
        `${prefix}upper`,
      ]) {
        expect(
          await read(adapter, near),
          `${name}: "${near}" was never written, so another key must not surface under it`,
        ).toBeUndefined();
      }

      adapter.dispose();
    });

    test("dispose is idempotent", () => {
      const adapter = createAdapter();

      adapter.dispose();

      expect(
        () => adapter.dispose(),
        `${name}: dispose runs from teardown paths that cannot know it already ran`,
      ).not.toThrow();
    });

    test("get, set and remove are refused after dispose", async () => {
      const adapter = createAdapter();
      const key = nextKey();

      await write(adapter, key, "value");
      adapter.dispose();

      await refuses("get", () => adapter.get(key));
      await refuses("set", () => adapter.set(key, "later"));
      await refuses("remove", () => adapter.remove(key));
    });
  });

  describe.runIf(lists)(`${name} storage adapter enumeration`, () => {
    test("keys lists what was written and forgets what was removed", async () => {
      const adapter = createAdapter();
      const kept = nextKey();
      const dropped = nextKey();

      await write(adapter, kept, "kept");
      await write(adapter, dropped, "dropped");
      await drop(adapter, dropped);
      const keys = await list(adapter);

      expect(
        keys,
        `${name}: keys must list every physical key the backend holds, exactly as written`,
      ).toContain(kept);
      expect(keys, `${name}: a removed key must not be listed`).not.toContain(
        dropped,
      );
      adapter.dispose();
    });

    test("keys is refused after dispose", async () => {
      const adapter = createAdapter();

      adapter.dispose();

      await refuses("keys", () => list(adapter));
    });
  });

  describe.runIf(observes && typeof externalWrite === "function")(
    `${name} storage adapter observation`,
    () => {
      // The block never runs without the harness; the fallback only spares the
      // tests below a narrowing dance the `runIf` above already settled.
      const applyExternal = externalWrite ?? (() => undefined);

      test("an external change reaches an observer", async () => {
        const adapter = createAdapter();
        const changes: StorageChange[] = [];
        const stop = observe(adapter, (change) => changes.push(change));
        const key = nextKey();

        await applyExternal(adapter, { key, value: "external" });
        await vi.waitFor(() =>
          expect(
            changes.length,
            `${name}: a change made outside this adapter must reach every observer`,
          ).toBeGreaterThan(0),
        );

        const reported = changes.at(-1);
        // `{ key: null }` is the legal coarse report: everything changed, re-read.
        if (reported?.key !== null) {
          expect(
            reported,
            `${name}: a keyed report must carry the physical key and the decoded value`,
          ).toEqual({ key, value: "external" });
        }

        stop();
        adapter.dispose();
      });

      test("an external clear reports { key: null }, or the removal of every key", async () => {
        const adapter = createAdapter();
        const changes: StorageChange[] = [];
        const stop = observe(adapter, (change) => changes.push(change));
        const key = nextKey();

        await write(adapter, key, "value");
        await applyExternal(adapter, { key: null });
        // A backend with no clear signal of its own reports a clear as one
        // removal per key, which is the same information spelled out.
        await vi.waitFor(() =>
          expect(
            changes.some(
              (change) =>
                !("error" in change) &&
                (change.key === null ||
                  (change.key === key && change.value === undefined)),
            ),
            `${name}: a backend cleared from outside must report { key: null }, or the removal of each key it held`,
          ).toBe(true),
        );

        stop();
        adapter.dispose();
      });

      test("an observer is silent after dispose", async () => {
        const adapter = createAdapter();
        const changes: StorageChange[] = [];

        observe(adapter, (change) => changes.push(change));
        adapter.dispose();
        // A harness reaches the backend through the adapter it was given, and
        // that transport may be gone once disposed; a failure here is not one.
        await Promise.resolve(
          applyExternal(adapter, { key: nextKey(), value: "late" }),
        ).catch(() => undefined);
        await settle();

        expect(
          changes,
          `${name}: dispose must silence every observer, including one the consumer never stopped`,
        ).toEqual([]);
      });
    },
  );

  // No `await` and no `async` callback below this line. A suite that awaits a
  // synchronous adapter passes it while proving nothing about its synchronicity.
  describe.runIf(mode === "sync")(
    `${name} storage adapter synchronicity`,
    () => {
      test("every operation settles in the calling frame", () => {
        const adapter = createAdapter();
        const key = nextKey();

        expect(
          adapter.set(key, "value"),
          `${name}: a sync set must not return a promise`,
        ).not.toBeInstanceOf(Promise);
        expect(
          adapter.get(key),
          `${name}: a sync get must answer with the value written in the same frame`,
        ).toBe("value");
        expect(
          adapter.remove(key),
          `${name}: a sync remove must not return a promise`,
        ).not.toBeInstanceOf(Promise);
        expect(
          adapter.get(key),
          `${name}: a sync remove must have taken effect before it returned`,
        ).toBeUndefined();
        adapter.dispose();
      });

      test("a disposed adapter throws in the calling frame", () => {
        const adapter = createAdapter();
        const key = nextKey();

        adapter.dispose();

        expect(
          () => adapter.get(key),
          `${name}: a disposed sync adapter must throw rather than answer`,
        ).toThrow();
        expect(() => adapter.set(key, "later")).toThrow();
        expect(() => adapter.remove(key)).toThrow();
      });
    },
  );

  describe.runIf(mode === "async")(
    `${name} storage adapter asynchronicity`,
    () => {
      test("every operation returns a promise", async () => {
        const adapter = createAdapter();
        const key = nextKey();
        const written = adapter.set(key, "value");

        expect(
          written,
          `${name}: an async set must return a promise the core can await`,
        ).toBeInstanceOf(Promise);
        await written;

        const pending = adapter.get(key);

        expect(
          pending,
          `${name}: an async get must return a promise`,
        ).toBeInstanceOf(Promise);
        expect(
          await pending,
          `${name}: an async get must answer with the written value once its promise settles`,
        ).toBe("value");

        const removed = adapter.remove(key);

        expect(
          removed,
          `${name}: an async remove must return a promise`,
        ).toBeInstanceOf(Promise);
        await removed;
        adapter.dispose();
      });
    },
  );
};
