import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import type { AsyncMigrationStore } from "src/types/AsyncMigrationStore";
import type { SyncMigrationStore } from "src/types/SyncMigrationStore";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const reversedKeys = {
  encode: (key: string) =>
    `legacy.${key
      .split(":")
      .reverse()
      .map((segment) => encodeURIComponent(segment).replaceAll(".", "%2E"))
      .join(".")}`,
  decode: (key: string) => {
    if (!key.startsWith("legacy.")) {
      return undefined;
    }
    return key
      .slice("legacy.".length)
      .split(".")
      .map(decodeURIComponent)
      .reverse()
      .join(":");
  },
};

test.each(["sync", "async"])(
  "a mapped migration repeats after its data succeeds but its checkpoint fails (%s)",
  async (mode) => {
    const checkpoint = reversedKeys.encode("silo::version");
    const failure = new Error("checkpoint refused");
    const onCall: NonNullable<
      Parameters<typeof createMockAdapter>[0]
    >["onCall"] = (call) => {
      if (
        call.operation === "set" &&
        call.key === checkpoint &&
        call.value === 2
      ) {
        throw failure;
      }
    };
    const first =
      mode === "async"
        ? createMockAdapter({ mode, onCall })
        : createMockAdapter({ onCall });
    first.store.set(checkpoint, 1);
    first.store.set(reversedKeys.encode("silo:users:7:old"), 4);
    const previous = vi.fn();
    const rename = vi.fn((store: SyncMigrationStore | AsyncMigrationStore) =>
      store.rename("users:7:old", "users:7:count"),
    );
    const next = vi.fn();
    const Schema = { count: value({ fallback: 0 }) };
    const migrations = { 1: previous, 2: rename, 3: next };
    const failed = new Silo({
      storages: {
        default: {
          adapters: [first.adapter],
          keys: reversedKeys,
          schema: Schema,
        },
      },
      migrations,
    });

    await expect(failed.ready()).rejects.toBe(failure);
    expect(failed.status.get()).toEqual({
      state: "error",
      error: { phase: "migrate", cause: failure },
    });
    expect(first.store.get(checkpoint)).toBe(1);
    expect(first.store.has(reversedKeys.encode("silo:users:7:old"))).toBe(
      false,
    );
    expect(first.store.get(reversedKeys.encode("silo:users:7:count"))).toBe(4);
    expect(next).not.toHaveBeenCalled();
    failed.dispose();

    const second =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    for (const [key, raw] of first.store) {
      second.store.set(key, raw);
    }
    const restarted = new Silo({
      storages: {
        default: {
          adapters: [second.adapter],
          keys: reversedKeys,
          schema: Schema,
        },
      },
      migrations,
    });

    await restarted.ready();
    const count = restarted.scope("users:7").value("count");
    await count.hydrated();
    expect(count.get()).toBe(4);
    expect(previous).not.toHaveBeenCalled();
    expect(rename).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(second.store.get(checkpoint)).toBe(3);
    restarted.dispose();
  },
);

test.each(["sync", "async"])(
  "mapped keys cover hydration, writes, observation, clear and diagnostics (%s)",
  async (mode) => {
    const mock =
      mode === "async" ? createMockAdapter({ mode }) : createMockAdapter();
    const physical = reversedKeys.encode("silo:workspaces:7:count");
    mock.store.set(physical, 3);
    const silo = new Silo({
      storages: {
        default: {
          adapters: [mock.adapter],
          keys: reversedKeys,
          schema: { count: value({ fallback: 0 }) },
        },
      },
    });
    const workspace = silo.scope("workspaces:7");
    const count = workspace.value("count");
    await count.hydrated();
    expect(count.get()).toBe(3);
    count.set(4);
    await count.flush();
    expect(mock.store.get(physical)).toBe(4);
    expect(mock.store.has("silo:workspaces:7:count")).toBe(false);
    mock.emit({ key: physical, value: 5 });
    expect(count.get()).toBe(5);
    mock.store.set(physical, 6);
    mock.emit({ key: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count.get()).toBe(6);
    expect(silo.diagnostics.get().records[0]).toMatchObject({
      path: "count",
      segments: ["workspaces:7"],
      physicalKey: physical,
    });
    await workspace.clear();
    expect(mock.store.has(physical)).toBe(false);
    expect(count.get()).toBe(0);
    silo.dispose();
  },
);

test("release follows logical scopes when physical keys put the value before the scope", async () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        keys: reversedKeys,
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  const workspace = silo.scope("workspaces").scope("7");
  const count = workspace.value("count");
  const child = workspace.scope("users:2").value("count");
  const neighbor = silo.scope("workspaces:70").value("count");
  count.set(1);
  child.set(2);
  neighbor.set(3);
  await silo.scope("workspaces:7").release();
  expect(
    silo.diagnostics.get().records.map((record) => record.segments),
  ).toEqual([["workspaces:70"]]);
  count.set(9);
  child.set(9);
  expect(count.get()).toBe(1);
  expect(child.get()).toBe(2);
  expect(mock.store.size).toBe(3);
  expect(workspace.value("count")).not.toBe(count);
  expect(silo.scope("workspaces:70").value("count")).toBe(neighbor);
  silo.dispose();
});

test("asynchronous migrations use logical keys and map versions and cross-storage moves", async () => {
  const primary = createMockAdapter({ mode: "async" });
  const secondary = createMockAdapter();
  primary.store.set(reversedKeys.encode("silo:workspaces:7:old"), 8);
  primary.store.set("unrelated", 42);
  primary.store.set(reversedKeys.encode("other:count"), 9);
  const silo = new Silo({
    storages: {
      default: { adapters: [primary.adapter], keys: reversedKeys, schema: {} },
      archive: {
        adapters: [secondary.adapter],
        namespace: "archive",
        schema: { count: value({ fallback: 0 }) },
      },
    },
    migrations: {
      1: async (store) => {
        expect(await store.keys()).toEqual(["workspaces:7:old"]);
        await store.move("workspaces:7:old", {
          to: "archive",
          as: "workspaces:7:count",
        });
      },
    },
  });
  await silo.ready();
  expect(primary.store.get(reversedKeys.encode("silo::version"))).toBe(1);
  expect(primary.store.has(reversedKeys.encode("silo:workspaces:7:old"))).toBe(
    false,
  );
  expect(secondary.store.get("archive:workspaces:7:count")).toBe(8);
  expect(silo.scope("workspaces:7").value("archive.count").get()).toBe(8);
  expect(primary.store.get("unrelated")).toBe(42);
  silo.dispose();
});

test("synchronous migrations enumerate and rename mapped keys in the constructor", () => {
  const mock = createMockAdapter();
  mock.store.set(reversedKeys.encode("silo:old"), 3);
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        keys: reversedKeys,
        schema: { count: value({ fallback: 0 }) },
      },
    },
    migrations: {
      1: (store) => {
        expect(store.keys()).toEqual(["old"]);
        store.rename("old", "count");
      },
    },
  });
  expect(silo.status.get()).toEqual({ state: "ready" });
  expect(silo.value("count").get()).toBe(3);
  expect(mock.store.has(reversedKeys.encode("silo:old"))).toBe(false);
  expect(mock.store.get(reversedKeys.encode("silo::version"))).toBe(1);
  silo.dispose();
});

test("a broken mapping is rejected before opening a value or touching its stored key", () => {
  const mock = createMockAdapter();
  const encode = vi.fn((key: string) =>
    key === "silo::version" ? key : "collision",
  );
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        keys: { encode, decode: (key) => key },
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
  expect(() => silo.value("count")).toThrow(
    "keys.decode must reverse keys.encode",
  );
  expect(mock.calls).toEqual([]);
  expect(silo.diagnostics.get().records).toEqual([]);
  silo.dispose();
});

test("existing workspace and user keys can be kept byte for byte", () => {
  const mock = createMockAdapter();
  const addresses = new Map([
    ["silo::version", "superchat.siloVersion"],
    [
      "silo:workspaces:7:users:2:dictationAcceptedAt",
      "superchat.7.dictation.onboardingAcceptedAt.2",
    ],
  ]);
  const keys = {
    encode: (key: string) => addresses.get(key) ?? key,
    decode: (key: string) => {
      for (const [logical, physical] of addresses) {
        if (physical === key) {
          return logical;
        }
      }
      return key;
    },
  };
  mock.store.set("superchat.7.dictation.onboardingAcceptedAt.2", "2026-09-18");
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        keys,
        schema: { dictationAcceptedAt: value<string>() },
      },
    },
  });
  const accepted = silo
    .scope("workspaces:7")
    .scope("users:2")
    .value("dictationAcceptedAt");
  expect(accepted.get()).toBe("2026-09-18");
  accepted.set("2026-09-19");
  expect(mock.store.get("superchat.7.dictation.onboardingAcceptedAt.2")).toBe(
    "2026-09-19",
  );
  silo.dispose();
});
