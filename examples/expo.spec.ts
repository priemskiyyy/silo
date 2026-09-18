import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:4192" });

const open = async (page: Page, width: number) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Workspace draft" }),
  ).toBeEditable();
  return errors;
};

for (const width of [390, 1024]) {
  test(`Expo keeps workspace drafts and user preferences separate at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors = await open(page, width);
    await page.screenshot({
      path: testInfo.outputPath("notebook.png"),
      fullPage: false,
    });
    const draft = page.getByRole("textbox", { name: "Workspace draft" });
    await draft.fill("Alpine notes");
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.getByRole("switch", { name: "Pin this workspace" }).check();

    await page
      .getByRole("radio", { name: "Demo user: Grace", exact: true })
      .click();
    await expect(draft).toHaveValue("Alpine notes");
    await expect(
      page.getByRole("switch", { name: "Pin this workspace" }),
    ).not.toBeChecked();
    await page.getByRole("tab", { name: "Preferences", exact: true }).click();
    await page
      .getByRole("radio", { name: "Language: Deutsch", exact: true })
      .click();
    await page.getByRole("radio", { name: "Theme: dark", exact: true }).click();
    await page
      .getByRole("radio", { name: "Workspace: Coast", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "Language: Deutsch", exact: true }),
    ).toBeChecked();
    await page.getByRole("tab", { name: "Notebook", exact: true }).click();
    await expect(draft).toHaveValue("");
    await draft.fill("Coast notes");
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(draft).toHaveValue("Alpine notes");
    await expect(
      page.getByRole("switch", { name: "Pin this workspace" }),
    ).toBeChecked();
    await page.getByRole("tab", { name: "Preferences", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: "Theme: dark", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Language: English", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("radio", { name: "Demo user: Grace", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "Language: Deutsch", exact: true }),
    ).toBeChecked();
    expect(errors).toEqual([]);
  });

  test(`Expo releases cached drafts without deleting them at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    const draft = page.getByRole("textbox", { name: "Workspace draft" });
    await draft.fill("Keep after release");
    await page.getByRole("tab", { name: "Storage", exact: true }).click();
    await page
      .getByRole("button", { name: "Release Alpine cache", exact: true })
      .click();
    await expect(
      page.getByText("Alpine's cached values were released.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Notebook", exact: true }).click();
    await expect(draft).toHaveValue("Keep after release");
    expect(errors).toEqual([]);
  });

  test(`Expo clearly uses temporary tokens in the web preview at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);
    await page.getByRole("tab", { name: "Storage", exact: true }).click();
    await expect(
      page.getByText("This web preview keeps the token in memory.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save demo token", exact: true })
      .click();
    await expect(
      page.getByText("Demo token saved.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: "Demo user: Grace", exact: true })
      .click();
    await expect(
      page.getByText("No demo token", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: "Demo user: Ada", exact: true })
      .click();
    await expect(
      page.getByText("Demo token present", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Storage", exact: true }).click();
    await expect(
      page.getByText("No demo token", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
