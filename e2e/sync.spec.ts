import { expect, test } from "@playwright/test";
import { CODE, CODE_KEY, NEW, fakeSupabase } from "../scripts/fake-supabase.mjs";

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
  const field = page.getByLabel("Sync code");
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
  // the library opens on the works; the private texts wait behind a button at the top right
  await expect(page.locator("main")).not.toContainText("Placeholder Title");
  await page.getByRole("button", { name: /^Private texts/ }).click();
  const shelf = page.getByRole("dialog", { name: "Your private texts" });
  await expect(shelf).toContainText("Placeholder Title");
  await expect(shelf).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(shelf).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Private texts/ })).toBeFocused();
  await page.getByRole("button", { name: /^Private texts/ }).click();
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
  await expect(page.getByRole("heading", { name: "This device is synced" })).toBeVisible();
  await page.getByText("Show the code").click();
  await expect(page.getByText("7K3Q-9XWD-M2RT-0HVB-PZ4N")).toBeVisible();
  await page.getByRole("button", { name: "Forget the code on this device" }).click();
  await expect(field).toBeVisible();
  await expect(page.getByRole("link", { name: "Sync", exact: true })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), CODE_KEY)).toBeNull();
});

test("making a new code: shown once, for a password manager and as a file; it opens no private texts", async ({ page }) => {
  await fakeSupabase(page);
  await page.goto("/sync");
  await page.getByRole("button", { name: "Make a new code" }).click();
  const shown = NEW.match(/.{4}/g)!.join("-");
  await expect(page.getByText(shown, { exact: true })).toBeVisible();
  // the fields a password manager reads: a fixed user name and the code as a new password
  await expect(page.locator("input[autocomplete=username]")).toHaveValue("Mathesis Reader sync code");
  await expect(page.locator("input[autocomplete=new-password]")).toHaveValue(shown);
  expect(await page.evaluate((k) => localStorage.getItem(k), CODE_KEY)).toBe(NEW);

  // every button says what it does
  await expect(page.getByText("Puts the code on your clipboard")).toBeVisible();
  await expect(page.getByText("Downloads a small text file")).toBeVisible();
  // Copy the code puts the code itself on the clipboard (a password field cannot be copied from)
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy the code" }).click();
  await expect(page.getByText("Copied. Paste it where you keep it.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);

  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save to your files" }).click()]);
  expect(file.suggestedFilename()).toBe("mathesis-sync-code.txt");
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toContain(shown);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator("main h3").first().waitFor({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Synced" })).toBeVisible();
  await expect(page.getByText("Your private texts")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Private texts/ })).toHaveCount(0);
});

test("a code kept in a password manager is filled into a password field; the page says how sync works", async ({ page }) => {
  await page.goto("/sync");
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.getByText("Gets a new, empty code from the database")).toBeVisible();
  await expect(page.locator("input[autocomplete=username]")).toHaveValue("Mathesis Reader sync code");
  await expect(page.getByLabel("Sync code")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Sync code")).toHaveAttribute("autocomplete", "current-password");
  await page.getByRole("button", { name: "Show the letters" }).click();
  await expect(page.getByLabel("Sync code")).toHaveAttribute("type", "text");
});
