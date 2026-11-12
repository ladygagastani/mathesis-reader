import { expect, test, type Page } from "@playwright/test";

// The library of version 1 (SPEC.md, "The library"), clicked in a real browser at a computer's width and a phone's.
const ready = async (page: Page) => { await page.locator("main h3").first().waitFor({ timeout: 30_000 }); };

test("the catalogue opens as one A to Z list of authors, and By kind groups it", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator("main h1")).toContainText("The library");
  await expect(page.getByText(/Greek works by \d+ authors/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Authors A–Z" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("main h3").first()).toHaveText("A");
  await page.getByRole("radio", { name: "By kind" }).click();
  await expect(page).toHaveURL(/sort=kind/);
  await expect(page.locator("main h3").first()).toHaveText("Epic");
  await page.getByRole("radio", { name: "Authors A–Z" }).click();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(page.locator("main h3").first()).toHaveText("A");
  // a fresh visit opens on A to Z again, whatever was chosen before
  await page.getByRole("radio", { name: "By kind" }).click();
  await page.goto("/");
  await ready(page);
  await expect(page.locator("main h3").first()).toHaveText("A");
});

test("the search finds an author by an English or Greek name, and a work by its title", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const search = page.getByRole("searchbox");
  await search.fill("Πλάτων");
  await expect(page.getByRole("region", { name: "Best match" })).toContainText("Plato");
  await expect(page).toHaveURL(/q=/);
  await search.fill("symposium");
  await expect(page.getByText(/^\d+ of [\d,]+ works$/)).toBeVisible();
  await expect(page.locator("main").getByText("Symposium").first()).toBeVisible();
  await search.fill("zzzzqqq");
  await expect(page.getByText('No work in the library matches "zzzzqqq".')).toBeVisible();
});

test("With English and Greek only narrow the list", async ({ page }) => {
  await page.goto("/?q=plato");
  await ready(page);
  const count = async () => Number((await page.getByText(/ of [\d,]+ works$/).textContent())!.split(" ")[0].replace(/,/g, ""));
  const all = await count();
  await page.getByRole("radio", { name: "With English" }).click();
  await expect(page.getByRole("radio", { name: "With English" })).toHaveAttribute("aria-checked", "true");
  const english = await count();
  await page.getByRole("radio", { name: "Greek only" }).click();
  await expect(page.getByRole("radio", { name: "Greek only" })).toHaveAttribute("aria-checked", "true");
  const greek = await count();
  expect(english).toBeGreaterThan(0);
  expect(greek).toBeGreaterThan(0);
  expect(english + greek).toBe(all);
  await page.getByRole("radio", { name: "All" }).click();
  await expect(page.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
  expect(await count()).toBe(all);
});

test("an author opens to their works, and a work opens in the reader", async ({ page }) => {
  await page.goto("/?q=plato");
  await ready(page);
  const plato = page.getByRole("region", { name: "Best match" }).getByRole("button");
  await plato.click();
  await expect(plato).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("region", { name: "Best match" }).getByRole("link", { name: /Apology/ }).click();
  await expect(page).toHaveURL(/\/read\?w=tlg0059\.tlg002/);
  await page.locator("main [role=button]").first().waitFor();
  // back to the same search
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("plato");
});

test("the device at the head of the page leads home, and nothing scrolls sideways", async ({ page }) => {
  await page.goto("/?q=homer");
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: /Mathesis Stoicheion, the library/ }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the credits name every source with its licence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Credits and licences" }).click();
  await expect(page).toHaveURL(/\/credits$/);
  for (const name of ["Perseus Digital Library, canonical-greekLit", "GLAUx, by Alek Keersmaekers", "Liddell–Scott–Jones", "Dickinson College Commentaries", "Wikidata", "Lucide"])
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});

test("the site bar: the way to the library from every page, and Paper or Night", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/credits");
  const bar = page.getByRole("navigation", { name: "The site" });
  await bar.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(bar.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Switch to the night page" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.goto("/saved");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("button", { name: "Switch to the paper page" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
});

test("an address that leads nowhere says so, and its search goes to the library", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.locator("main h1")).toHaveText("This page is not here");
  await page.getByRole("searchbox").fill("plato");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/\?q=plato$/);
  await expect(page.getByRole("searchbox")).toHaveValue("plato");
});
