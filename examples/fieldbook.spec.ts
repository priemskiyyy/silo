import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const WIDTHS = [375, 1280];
const STORAGES = [
  "Memory",
  "Local",
  "Session",
  "IndexedDB",
  "Cookie",
  "URL",
  "Synced URL",
  "Remote",
];

// A fresh context per test keeps every storage empty, so each test starts cold.
const open = async (page: Page, width: number) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByText("Store ready", { exact: true }),
  ).toBeVisible();

  return errors;
};

const panel = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

// An asynchronous chip shows a skeleton until its storage answered, so the
// note is waited for rather than assumed.
const pick = async (page: Page, storage: string) => {
  const playground = panel(page, "Playground");
  await playground.getByRole("button", { name: storage, exact: true }).click();
  const note = playground.getByRole("textbox", { name: "Note", exact: true });
  await expect(note).toBeVisible();

  return note;
};

const pickRemote = (page: Page) => pick(page, "Remote");

// The pipeline always lists all three steps; only the current one counts.
const currentStep = (page: Page) =>
  panel(page, "Composer").locator('[aria-current="step"]');

// The optimistic snapshot shows the entry at once; "Saved" is `flush()`
// resolving, and only then can a reload not lose it.
const addEntry = async (page: Page, title: string) => {
  const entries = panel(page, "Entries");
  await page
    .getByRole("textbox", { name: "New entry", exact: true })
    .fill(title);
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await expect(entries.getByText(title, { exact: true })).toBeVisible();
  await expect(entries.getByText("Saved", { exact: true })).toBeVisible();
};

for (const width of WIDTHS) {
  test(`navigation preserves shared URL data at ${width}px`, async ({
    page,
  }, testInfo) => {
    await open(page, width);
    await page.screenshot({
      path: testInfo.outputPath("notebook.png"),
      fullPage: false,
    });
    const note = await pick(page, "Synced URL");
    await note.fill("keep this fragment");
    await expect(page).toHaveURL(/#note=keep\+this\+fragment/);
    const navigation = page.getByRole("navigation", {
      name: "Explore Fieldbook",
    });
    await expect(navigation).toBeVisible();
    await navigation
      .getByRole("button", { name: "Notebook", exact: true })
      .click();
    await expect(page).toHaveURL(/#note=keep\+this\+fragment/);
    await expect(
      page.getByRole("textbox", { name: "New entry", exact: true }),
    ).toBeInViewport();
  });

  test(`clearing a notebook requires confirmation at ${width}px`, async ({
    page,
  }) => {
    await open(page, width);
    await addEntry(page, "Keep until confirmed");
    await page.getByRole("button", { name: "Coast", exact: true }).click();
    await addEntry(page, "Keep the coast note");
    await page.getByRole("button", { name: "Alpine", exact: true }).click();
    await page
      .getByRole("button", { name: "Clear this notebook", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      panel(page, "Entries").getByText("Keep until confirmed", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear this notebook", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm clear", exact: true })
      .click();
    await expect(
      page.getByText(
        "Notebook cleared. Your other notebooks and preferences are unchanged.",
      ),
    ).toBeVisible();
    await expect(
      panel(page, "Entries").getByText("No entries yet", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Coast", exact: true }).click();
    await expect(
      panel(page, "Entries").getByText("Keep the coast note", { exact: true }),
    ).toBeVisible();
  });

  test(`entries survive a reload and stay inside their notebook at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);

    await addEntry(page, "Reached the ridge #camp");
    await page.reload();
    await expect(
      panel(page, "Entries").getByText("Reached the ridge #camp", {
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Coast", exact: true }).click();
    await expect(
      page.getByText("No entries yet", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Alpine", exact: true }).click();
    await expect(
      panel(page, "Entries").getByText("Reached the ridge #camp", {
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`the composer is this tab only, the journal is every tab at ${width}px`, async ({
    page,
    context,
  }) => {
    const errors = await open(page, width);
    const composer = page.getByRole("textbox", {
      name: "Composer",
      exact: true,
    });

    await composer.fill("Tide tables\nLow tide at dawn. #sea");
    await page
      .getByRole("button", { name: "Save as entry", exact: true })
      .click();
    await expect(currentStep(page)).toHaveText("Saved");
    await expect(
      panel(page, "Entries").getByText("Tide tables", { exact: true }),
    ).toBeVisible();
    await composer.fill("Only here");

    const other = await context.newPage();
    await open(other, width);
    await expect(
      other.getByRole("textbox", { name: "Composer", exact: true }),
    ).toHaveValue("");
    await expect(
      panel(other, "Entries").getByText("Tide tables", { exact: true }),
    ).toBeVisible();
    await other.close();
    expect(errors).toEqual([]);
  });

  test(`the filter lives in the URL at ${width}px`, async ({ page }) => {
    const errors = await open(page, width);

    await page
      .getByRole("combobox", { name: "Filter", exact: true })
      .selectOption("starred");
    await expect(page).toHaveURL(/filter=starred/);
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Filter", exact: true }),
    ).toHaveValue("starred");
    expect(errors).toEqual([]);
  });

  test(`the theme is painted before React runs at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    const html = page.locator("html");

    await page
      .getByRole("group", { name: "Theme", exact: true })
      .getByRole("button", { name: "Dark", exact: true })
      .click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // With every script but the inline one blocked, React never renders:
    // the attribute can only come from the pre-paint script.
    await page.route("**/assets/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("banner")).toHaveCount(0);

    await page.unroute("**/assets/**/*.js");
    await page.reload();
    await expect(
      page.getByRole("banner").getByText("Store ready", { exact: true }),
    ).toBeVisible();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(
      page
        .getByRole("group", { name: "Theme", exact: true })
        .getByRole("button", { name: "Dark", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test(`an invalid stored theme uses the fallback until repaired at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    await page.evaluate(() => {
      localStorage.setItem("fieldbook:theme", JSON.stringify("sepia"));
    });
    await page.reload();

    const preferences = panel(page, "Preferences");
    await expect(preferences.getByText("Could not load theme")).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Theme", exact: true })
        .getByRole("button", { name: "System", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(() => localStorage.getItem("fieldbook:theme")),
    ).toBe(JSON.stringify("sepia"));

    await preferences
      .getByRole("button", { name: "Fix theme", exact: true })
      .click();
    await expect(preferences.getByText("Could not load theme")).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("fieldbook:theme")),
    ).toBe(JSON.stringify("system"));
    expect(errors).toEqual([]);
  });

  test(`URL counts validate text and persist numeric updates at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    await page.goto("/?count=invalid");
    await pick(page, "URL");

    const playground = panel(page, "Playground");
    const count = playground.getByRole("group", { name: "Count", exact: true });
    await expect(count.getByText("0", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/count=invalid/);

    await count
      .getByRole("button", { name: "Count one more", exact: true })
      .click();
    await expect(page).toHaveURL(/count=1/);
    await page.reload();
    await pick(page, "URL");
    await expect(count.getByText("1", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`private mode falls through to the memory floor at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    // The chip names the adapter that won the list; the memory floor after.
    const local = panel(page, "Playground").getByRole("button", {
      name: "Local",
      exact: true,
    });

    await expect(local).toContainText("local-storage");
    await page
      .getByRole("button", { name: "Private mode", exact: true })
      .click();
    await expect(local).toContainText("memory");
    await expect(
      page.getByRole("banner").getByText("Store ready", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`a refused write is reported and retried at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    const composer = panel(page, "Composer");

    await page
      .getByRole("button", { name: "Fail next write", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Composer", exact: true })
      .fill("Storm coming");
    await page
      .getByRole("button", { name: "Save as entry", exact: true })
      .click();
    await expect(currentStep(page)).toHaveText("Refused");
    await composer.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(currentStep(page)).toHaveText("Saved");
    await expect(
      panel(page, "Entries").getByText("Storm coming", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      panel(page, "Entries").getByText("Storm coming", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`the playground keeps a note in each storage and only memory forgets at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    const playground = panel(page, "Playground");
    const note = playground.getByRole("textbox", { name: "Note", exact: true });

    for (const storage of STORAGES) {
      await playground
        .getByRole("button", { name: storage, exact: true })
        .click();
      await note.fill(`kept in ${storage}`);
      await playground
        .getByRole("button", { name: "Count one more", exact: true })
        .click();
      await expect(
        playground.getByText("Saved", { exact: true }).first(),
      ).toBeVisible();
    }

    // URLSearchParams spells a space as `+`; the synced storage is the fragment.
    await expect(page).toHaveURL(/\?note=kept\+in\+URL/);
    await expect(page).toHaveURL(/#note=kept\+in\+Synced\+URL/);
    await page.reload();
    await expect(
      page.getByRole("banner").getByText("Store ready", { exact: true }),
    ).toBeVisible();

    for (const storage of STORAGES) {
      await playground
        .getByRole("button", { name: storage, exact: true })
        .click();
      await expect(note).toHaveValue(
        storage === "Memory" ? "" : `kept in ${storage}`,
      );
    }

    expect(errors).toEqual([]);
  });

  test(`a remote value reaches the server and the other tab live at ${width}px`, async ({
    page,
    context,
  }) => {
    const errors = await open(page, width);
    const other = await context.newPage();
    await open(other, width);
    const otherNote = await pickRemote(other);
    await expect(otherNote).toHaveValue("");

    const note = await pickRemote(page);
    await note.fill("shared through the server");
    await expect(
      panel(page, "Playground").getByText("Saved", { exact: true }).first(),
    ).toBeVisible();
    // The access log, newest first: the write is a PUT the server accepted.
    await expect(
      panel(page, "Server")
        .getByRole("list", { name: "Requests", exact: true })
        .getByRole("listitem")
        .first(),
    ).toContainText(/PUT\s*\/kv\/fieldbook:note\s*204/u);

    // No reload on the other page: the announcement applied the value.
    await expect(
      panel(other, "Playground").getByText("Changed in another tab", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(otherNote).toHaveValue("shared through the server");
    await other.close();
    expect(errors).toEqual([]);
  });

  test(`a synced URL follows the other tab and a plain URL stays its own at ${width}px`, async ({
    page,
    context,
  }) => {
    const errors = await open(page, width);
    const other = await context.newPage();
    await open(other, width);
    const otherNote = await pick(other, "Synced URL");
    const note = await pick(page, "Synced URL");
    await note.fill("same link everywhere");
    await expect(
      panel(page, "Playground").getByText("Saved", { exact: true }).first(),
    ).toBeVisible();

    // The other tab wrote the announcement into its own fragment, then applied it.
    await expect(other).toHaveURL(/#note=same\+link\+everywhere/);
    await expect(otherNote).toHaveValue("same link everywhere");

    // With single-tab sharing the query string is this tab's alone.
    const plain = await pick(page, "URL");
    await plain.fill("mine only");
    await expect(page).toHaveURL(/\?note=mine\+only/);
    await pick(other, "URL");
    await expect(other).not.toHaveURL(/mine/);
    await other.close();
    expect(errors).toEqual([]);
  });

  test(`a failed request is refused and retried against the server at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    const playground = panel(page, "Playground");
    const note = await pickRemote(page);

    await page
      .getByRole("button", { name: "Fail next request", exact: true })
      .click();
    await note.fill("lost at sea");
    await expect(
      playground.getByText("Write refused", { exact: true }),
    ).toBeVisible();
    await expect(
      panel(page, "Server")
        .getByRole("list", { name: "Requests", exact: true })
        .getByRole("listitem")
        .first(),
    ).toContainText("503");

    await playground
      .getByRole("button", { name: "Retry", exact: true })
      .click();
    await expect(
      playground.getByText("Saved", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("banner").getByText("Store ready", { exact: true }),
    ).toBeVisible();
    await expect(await pickRemote(page)).toHaveValue("lost at sea");
    expect(errors).toEqual([]);
  });

  test(`the devtools list what the page reached and count a refused write at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);

    // Playwright reaches into the shadow root by default.
    await page
      .getByRole("button", { name: "Open Silo devtools", exact: true })
      .click();
    const devtools = page.getByRole("complementary", {
      name: "Silo devtools",
      exact: true,
    });
    await expect(devtools).toBeVisible();
    await expect(
      devtools.getByRole("navigation", { name: "Silo records" }),
    ).toContainText("theme");
    await expect(
      devtools.getByRole("button", { name: "Errors 0", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(devtools).toBeHidden();

    await page
      .getByRole("button", { name: "Fail next write", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Composer", exact: true })
      .fill("Storm coming");
    await page
      .getByRole("button", { name: "Save as entry", exact: true })
      .click();
    await expect(currentStep(page)).toHaveText("Refused");

    await page
      .getByRole("button", { name: "Open Silo devtools", exact: true })
      .click();
    await expect(
      devtools.getByRole("button", { name: "Errors 1", exact: true }),
    ).toBeVisible();
    await devtools
      .getByRole("button", { name: "Errors 1", exact: true })
      .click();
    await expect(devtools.getByLabel("Event timeline")).toContainText(
      "write refused",
    );
    expect(errors).toEqual([]);
  });
}
