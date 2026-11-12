import { expect, test } from "@playwright/test";
import { PASSWORD, SESSION_KEY, fakeSupabase } from "../scripts/fake-supabase.mjs";

// Sign-in and the private texts (SPEC.md), clicked in a real browser. Supabase is never contacted: every call to it is answered by
// scripts/fake-supabase.mjs, with made-up placeholder text only.

test("a reader who never signs in never contacts Supabase", async ({ page }) => {
  const asked = await fakeSupabase(page);
  await page.goto("/");
  await page.locator("main h3").first().waitFor({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Your private texts")).toHaveCount(0);
  await page.goto("/read?w=tlg0059.tlg002");
  await page.locator("main [role=button]").first().waitFor();
  expect(asked).toEqual([]);
});

test("a private text asks to sign in first", async ({ page }) => {
  await page.goto("/read?w=mine:placeholder-work");
  await expect(page.getByText("This is one of your private texts. Sign in to open it.")).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/account?next=%2Fread%3Fw%3Dmine%3Aplaceholder-work");
});

test("signing in: a wrong password is said plainly; the right one opens the private shelf and the text; signing out", async ({ page }) => {
  await fakeSupabase(page);
  await page.goto("/account?next=%2F");
  await page.getByRole("textbox", { name: "Email" }).fill("owner@example.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("main [role=alert]")).toHaveText("That email and password do not match an account.");

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Your account" })).toBeVisible();
  const shelf = page.getByRole("region", { name: "Your private texts" });
  await expect(shelf).toContainText("Placeholder Title");
  expect(await page.evaluate((k) => !!localStorage.getItem(k), SESSION_KEY)).toBe(true);

  // the first opening: its title page, marked private
  await shelf.getByRole("link", { name: /Placeholder Title/ }).click();
  await expect(page).toHaveURL(/w=mine:placeholder-work/);
  await expect(page.locator("header h1")).toHaveText("Placeholder Title");
  await expect(page.getByText("Only you can see this")).toBeVisible();
  await expect(page.locator("main")).toContainText("ἀρετή");
  await page.getByRole("button", { name: "Show the English" }).first().click();
  await expect(page.locator("[data-reading]")).toContainText("Placeholder sentence one.");
  await expect(page.locator("[data-reading]")).not.toContainText("Perseus");
  // a later opening: the one-line title, with its lock
  await page.reload();
  await expect(page.getByRole("img", { name: "Only you can see this" })).toBeVisible();

  await page.goto("/account");
  await expect(page.getByText("Signed in as owner@example.test.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(await page.evaluate((k) => !!localStorage.getItem(k), SESSION_KEY)).toBe(false);
});
