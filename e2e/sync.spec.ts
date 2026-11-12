import { expect, test } from "@playwright/test";
import { CODE, CODE_KEY, fakeSupabase } from "../scripts/fake-supabase.mjs";

// Sync and the private texts (SPEC.md), clicked in a real browser. Supabase is never contacted: every call to it is answered by
// scripts/fake-supabase.mjs, with a made-up code and placeholder text only.

test("a device with no sync code never contacts Supabase", async ({ page }) => {
  const asked = await fakeSupabase(page);
  await page.goto("/");
  await page.locator("main h3").first().waitFor({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Sync", exact: true })).toBeVisible();
  await expect(page.getByText("Your private texts")).toHaveCount(0);
  await page.goto("/read?w=tlg0059.tlg002");
  await page.locator("main [role=button]").first().waitFor();
  expect(asked).toEqual([]);
});

test("a private text asks to sync first", async ({ page }) => {
  await page.goto("/read?w=mine:placeholder-work");
  await expect(page.getByText("This is one of your private texts. Sync this device to open it.")).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "Sync this device" })).toHaveAttribute("href", "/sync?next=%2Fread%3Fw%3Dmine%3Aplaceholder-work");
});

test("syncing: a malformed or unknown code is said plainly; the right one opens the private shelf and the text; forgetting it", async ({ page }) => {
  const asked = await fakeSupabase(page);
  await page.goto("/sync?next=%2F");
  const field = page.getByRole("textbox", { name: "Sync code" });
  const sync = page.getByRole("button", { name: "Sync this device" });
  const alert = page.locator("main [role=alert]");

  await field.fill("1234");
  await sync.click();
  await expect(alert).toHaveText("A sync code is 20 letters and digits, as XXXX-XXXX-XXXX-XXXX-XXXX.");
  expect(asked).toEqual([]);

  await field.fill("0000-0000-0000-0000-0000");
  await sync.click();
  await expect(alert).toHaveText("That sync code is not known. Check it, or make a new one.");

  // typed as a person types it: lower case, spaces, an O for a 0
  await field.fill("7k3q 9xwd m2rt ohvb pz4n");
  await sync.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Synced" })).toBeVisible();
  const shelf = page.getByRole("region", { name: "Your private texts" });
  await expect(shelf).toContainText("Placeholder Title");
  expect(await page.evaluate((k) => localStorage.getItem(k), CODE_KEY)).toBe(CODE);

  await shelf.getByRole("link", { name: /Placeholder Title/ }).click();
  await expect(page).toHaveURL(/w=mine:placeholder-work/);
  await expect(page.locator("header h1")).toHaveText("Placeholder Title");
  await expect(page.getByText("Only you can see this")).toBeVisible();
  await expect(page.locator("main")).toContainText("ἀρετή");
  await page.getByRole("button", { name: "Show the English" }).first().click();
  await expect(page.locator("[data-reading]")).toContainText("Placeholder sentence one.");
  await expect(page.locator("[data-reading]")).not.toContainText("Perseus");
  await page.reload();
  await expect(page.getByRole("img", { name: "Only you can see this" })).toBeVisible();

  await page.goto("/sync");
  await expect(page.getByText("This device is synced.")).toBeVisible();
  await page.getByText("Show the code, to type on another device").click();
  await expect(page.getByText("7K3Q-9XWD-M2RT-0HVB-PZ4N")).toBeVisible();
  await page.getByRole("button", { name: "Forget the code on this device" }).click();
  await expect(field).toBeVisible();
  await expect(page.getByRole("link", { name: "Sync", exact: true })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), CODE_KEY)).toBeNull();
});
