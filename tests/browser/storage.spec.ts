import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Two pages in ONE context, which is what a second tab is: they share the
 * origin's localStorage and IndexedDB and each gets its own sessionStorage.
 * Two contexts would share nothing and prove nothing.
 */
const openTabs = async (context: BrowserContext): Promise<[Page, Page]> => {
  const first = await context.newPage();
  await first.goto("/");
  const second = await context.newPage();
  await second.goto("/");
  await expect(first.getByTestId("db-status")).toHaveText("ready");
  await expect(second.getByTestId("db-status")).toHaveText("ready");
  return [first, second];
};

test("IndexedDB hands back a Date, a Map and an ArrayBuffer as themselves", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("db-status")).toHaveText("ready");
  await page.getByTestId("write-journal").click();
  await expect(page.getByTestId("db-flush")).toHaveText("journal");
  // Reloaded, so the value is read back out of the database rather than out of
  // the snapshot the write left behind.
  await page.reload();
  await expect(page.getByTestId("db-journal")).toHaveText(
    JSON.stringify({
      when: "2024-03-04T05:06:07.000Z",
      tags: { a: 1, b: 2 },
      bytes: [1, 2, 3],
    }),
  );
});

test("IndexedDB hands back a Blob as itself", async ({ page, browserName }) => {
  // WebKit refuses a Blob or a File outright: the transaction errors with a
  // null error and nothing is stored, while a Date, a Map, a Set, a RegExp and
  // an ArrayBuffer all round-trip there. So this is Blob storage specifically,
  // not structured clone, and the test above is what covers the engines. Probed
  // on all three engines with the Playwright 1.63 builds.
  test.skip(
    browserName === "webkit",
    "WebKit cannot store a Blob or a File in IndexedDB.",
  );
  await page.goto("/");
  await expect(page.getByTestId("db-status")).toHaveText("ready");
  await page.getByTestId("write-blob").click();
  await expect(page.getByTestId("db-flush")).toHaveText("blob");
  await page.reload();
  await expect(page.getByTestId("db-blob")).toHaveText(
    JSON.stringify({ type: "text/plain", text: "silo" }),
  );
});

test("a localStorage write in one tab reaches the other tab", async ({
  context,
}) => {
  const [first, second] = await openTabs(context);

  await first.getByTestId("note-input").fill("hello");
  await first.getByTestId("write-note").click();

  await expect(first.getByTestId("local-note")).toHaveText("local:hello");
  // Delivered by the `storage` event, which never fires in the tab that wrote.
  await expect(second.getByTestId("local-note")).toHaveText("local:hello");
});

test("an IndexedDB write in one tab reaches the other tab", async ({
  context,
}) => {
  const [first, second] = await openTabs(context);

  await first.getByTestId("increment").click();
  await expect(first.getByTestId("db-flush")).toHaveText("count:1");
  await expect(first.getByTestId("db-count")).toHaveText("1");
  // IndexedDB reports nothing of its own: this is the adapter's own
  // BroadcastChannel announcement, made after the transaction committed.
  await expect(second.getByTestId("db-count")).toHaveText("1");
});

test("a sessionStorage write stays in the tab that made it", async ({
  context,
}) => {
  const [first, second] = await openTabs(context);

  await first.getByTestId("note-input").fill("hello");
  await first.getByTestId("write-note").click();

  await expect(first.getByTestId("session-note")).toHaveText("session:hello");
  // The positive control, so the assertion below is about sessionStorage and
  // not about a pair of tabs that talk to nobody.
  await expect(second.getByTestId("local-note")).toHaveText("local:hello");
  // Both storages fire `storage` on the same window and both silos use the
  // same physical key, so this also pins the adapter's storageArea filter: a
  // filter on the key alone would show "local:hello" here.
  await expect(second.getByTestId("session-note")).toHaveText("(none)");
});

test("both backends survive a real page reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("db-status")).toHaveText("ready");
  await page.getByTestId("note-input").fill("hello");
  await page.getByTestId("write-note").click();
  await page.getByTestId("increment").click();
  await expect(page.getByTestId("db-flush")).toHaveText("count:1");

  await page.reload();

  await expect(page.getByTestId("local-note")).toHaveText("local:hello");
  await expect(page.getByTestId("db-count")).toHaveText("1");
  // Same tab, so the session value is still here; the test above is what says
  // it would not be in another one.
  await expect(page.getByTestId("session-note")).toHaveText("session:hello");
});

test("the adapter keeps its transactions off the auto-commit boundary", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("db-status")).toHaveText("ready");
  await page.getByTestId("probe-transaction").click();

  // `afterTask` is the trap itself, measured in the engine under test: a
  // transaction held across a task is dead. `coldWrites` is the adapter on the
  // same boundary, writing while its connection is still opening and having
  // every write commit anyway.
  await expect(page.getByTestId("probe")).toHaveText(
    JSON.stringify({ afterTask: "TransactionInactiveError", coldWrites: 3 }),
  );
});
