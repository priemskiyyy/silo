import type { SiloDiagnosticEvent } from "@priemskiyyy/silo";
import { expect, test } from "vitest";
import { EventLog } from "src/utils/EventLog";

const event = (type: string, context: unknown = null): SiloDiagnosticEvent => ({
  source: "value",
  type,
  storage: "default",
  key: "silo:theme",
  timestamp: 1_000,
  context,
});

test("keeps the newest events first within a clamped limit and notifies once per microtask", async () => {
  const log = new EventLog(0);
  let notifications = 0;
  log.subscribe(() => {
    notifications += 1;
  });

  log.add(event("record created"), false);
  log.add(event("hydrate landed"), false);
  expect(log.get().map((entry) => entry.type)).toEqual(["hydrate landed"]);
  expect(notifications).toBe(0);

  await Promise.resolve();
  expect(notifications).toBe(1);

  log.setLimit(5_000);
  log.add(event("write accepted"), false);
  log.add(event("write durable"), false);
  expect(log.get()).toHaveLength(3);
  expect(log.get().map((entry) => entry.id)).toEqual([4, 3, 2]);

  log.setLimit(1);
  expect(log.get().map((entry) => entry.type)).toEqual(["write durable"]);
  log.clear();
  expect(log.get()).toEqual([]);
});

test("records the description alongside the event", () => {
  const log = new EventLog(10);
  log.add(
    event("write refused", { generation: 3, cause: new Error("quota") }),
    false,
  );

  expect(log.get()[0]).toMatchObject({
    kind: "ERROR",
    summary: "#3 · quota",
  });
});
