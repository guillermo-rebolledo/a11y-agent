import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrator completes onboarding using the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  await page
    .getByRole("link", { name: "Continue with GitHub test account" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status", { name: /signed in as fixture-admin/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save disabled Project" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "memoji-inc/example" }),
  ).toBeVisible();
  await expect(
    page.getByText("Disabled pending enablement proof"),
  ).toBeVisible();
});

test("critical onboarding screens have no obvious Axe Findings", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/onboarding?provider=github-fixture",
    "/projects/example",
  ]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});
