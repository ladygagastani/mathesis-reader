import { expect, test, type Page } from "@playwright/test";

// What the reader brings back from the old one (docs/review-2026-11-12.md, step 3): your place, the keys, Go to and Find in this
// book, the line spacing, the edition and translation, the other dictionaries. At a computer's width: phones come later.
test.skip(({ isMobile }) => isMobile, "the computer's reader");

const APOLOGY = "/read?w=tlg0059.tlg002";
const words = (page: Page) => page.locator("main [data-u] [role=button]");

async function open(page: Page, path = APOLOGY) {
  await page.addInitScript(() => localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002", "tlg0012.tlg001"])));
  await page.goto(path);
  await words(page).first().waitFor({ timeout: 30_000 });
}

test("a book opens again where you stopped, and says so", async ({ page }) => {
  await open(page, `${APOLOGY}&at=29`);
  await expect(page.locator("#p-29")).toBeInViewport();
  // (the place is kept once the page has settled)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mathesis-reader:places") ?? "{}")["tlg0059.tlg002"]?.at)).toBe("29");
  await page.goto("/");
  await page.goto(APOLOGY);
  await expect(page).toHaveURL(/at=29/);
  await expect(page.locator("#p-29")).toBeInViewport();
  await expect(page.locator("#p-29")).toContainText("You stopped here");
});

test("the keys: arrows turn the page, or step from word to word with a word looked up; ? lists them", async ({ page }) => {
  await open(page);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/p=2/);
  await words(page).first().waitFor();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/p=1/);
  await words(page).nth(14).click();
  await page.keyboard.press("ArrowRight");
  await expect(words(page).nth(15)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(words(page).nth(14)).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveURL(/p=1/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  const keys = page.getByRole("dialog", { name: "Keys" });
  await expect(keys).toContainText("Go to a passage, or find a word anywhere in the book.");
  await page.keyboard.press("Escape");
  await expect(keys).toHaveCount(0);
});

test("Go to a passage by its reference; a wrong one says what a reference looks like", async ({ page }) => {
  await open(page);
  await page.keyboard.press("g");
  const menu = page.getByRole("dialog", { name: "Go to" });
  await menu.getByLabel("Passage").fill("99z");
  await menu.getByRole("button", { name: "Go", exact: true }).click();
  await expect(menu.getByRole("alert")).toContainText('No passage "99z" in this text. Try a reference such as');
  await menu.getByLabel("Passage").fill("29");
  await menu.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page).toHaveURL(/at=29/);
  await expect(page.locator("#p-29")).toBeInViewport();
});

test("Find in this book lists the passages, and opens one with the word marked", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Go to:/ }).click();
  const menu = page.getByRole("dialog", { name: "Go to" });
  await menu.getByLabel("Find in this book").fill("μελητ");
  await menu.getByRole("button", { name: "Find" }).click();
  await expect(menu).toContainText(/\d+ passages:/);
  const first = menu.locator("ol").first().getByRole("button").first();
  const ref = (await first.locator("span").first().textContent())!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`at=${ref}&find=`));
  await expect(page.locator("main [data-found]").first()).toBeVisible();
});

test("Text: the line spacing, and the translation where a book has more than one", async ({ page }) => {
  await open(page);
  const leading = () => page.locator("main [data-u]").first().evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) / parseFloat(getComputedStyle(e).fontSize));
  const before = await leading();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Wider" }).click();
  expect(await leading()).toBeGreaterThan(before + 0.05);
  await page.getByRole("button", { name: "As designed" }).click();
  expect(await leading()).toBeCloseTo(before, 2);
  // the Apology has one translation: nothing to choose
  await expect(page.getByLabel("English")).toHaveCount(0);

  await page.goto("/read?w=tlg0012.tlg001");
  await words(page).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const english = page.getByRole("dialog", { name: "Page and text" }).getByLabel("English");
  const second = await english.locator("option").nth(1).getAttribute("value");
  await english.selectOption(second!);
  await expect(page).toHaveURL(new RegExp(`tr=${second}`));
  await words(page).first().waitFor({ timeout: 30_000 });
});

test("the look-up's second layer links to other dictionaries", async ({ page }) => {
  await open(page);
  await words(page).nth(14).click();
  await page.getByRole("button", { name: "More about it" }).click();
  await expect(page.getByRole("link", { name: "Logeion" })).toHaveAttribute("href", /logeion\.uchicago\.edu\/.+/);
  await expect(page.getByRole("link", { name: "Perseus" })).toHaveAttribute("href", /perseus\.tufts\.edu\/hopper\/morph\?l=.+&la=greek/);
});
