import { expect, test, type Locator, type Page } from "@playwright/test";

// The reader of version 1 (SPEC.md, ADR 0009), clicked in a real browser at a computer's width and a phone's.
const APOLOGY = "/read?w=tlg0059.tlg002";
const words = (page: Page) => page.locator("main [role=button]");
const lookup = (page: Page) => page.locator("[data-lookup]");

async function openBook(page: Page, { opened = true, settings }: { opened?: boolean; settings?: object } = {}) {
  await page.addInitScript(([opened, settings]) => {
    if (opened) localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002"]));
    if (settings) localStorage.setItem("mathesis-reader:settings", JSON.stringify(settings));
  }, [opened, settings ?? null] as const);
  await page.goto(APOLOGY);
  await words(page).first().waitFor();
  // PROVE_CSS="<css>" adds a style, to prove a test fails on the kind of bug it is for. Proved 2026-11-12:
  // PROVE_CSS='[data-lookup] { height: 92dvh !important; max-height: none !important }' fails "never covers the word" on a phone, and
  // PROVE_CSS='[data-lookup] { left: 80px !important; width: 700px !important }' fails it on a computer.
  if (process.env.PROVE_CSS) await page.addStyleTag({ content: process.env.PROVE_CSS });
}

async function lookUp(page: Page, word: Locator) {
  await word.click();
  await expect(lookup(page).locator("[aria-busy=false]")).toBeVisible({ timeout: 30_000 });
}

/** The word and the look-up both stand on the screen, and do not overlap. */
async function clear(page: Page, word: Locator) {
  const w = (await word.boundingBox())!, l = (await lookup(page).boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(w.y, "the word is on the screen").toBeGreaterThanOrEqual(0);
  expect(w.y + w.height, "the word is on the screen").toBeLessThanOrEqual(vh);
  const apart = w.x + w.width <= l.x || l.x + l.width <= w.x || w.y + w.height <= l.y || l.y + l.height <= w.y;
  expect(apart, `the look-up (${JSON.stringify(l)}) covers the word (${JSON.stringify(w)})`).toBe(true);
}

test("a book opens on its title page the first time, then on its one-line title", async ({ page }) => {
  await openBook(page, { opened: false });
  await expect(page.locator("header h1")).toHaveText("Ἀπολογία Σωκράτους");
  await expect(page.getByText("Burnet, 1905")).toBeVisible();
  await page.reload();
  await words(page).first().waitFor();
  await expect(page.locator("main h1")).toContainText("Ἀπολογία Σωκράτους · Plato, Apology");
  await expect(page.getByRole("button", { name: /^Go to:/ })).toContainText("Sections 17–22");
});

test("the Greek stands alone, and Show the English opens one passage's English", async ({ page }) => {
  await openBook(page);
  await expect(page.locator("[data-reading]")).toHaveCount(0);
  const show = page.getByRole("button", { name: "Show the English" });
  await show.first().click();
  await expect(page.locator("[data-reading]")).toHaveCount(1);
  await expect(page.locator("[data-reading]")).toContainText("How you, men of Athens");
  await expect(page.locator("[data-reading]")).toContainText("Perseus Digital Library, CC BY-SA 4.0");
  await page.getByRole("button", { name: "Hide the English" }).click();
  await expect(page.locator("[data-reading]")).toHaveCount(0);
});

test("the look-up gives the meaning and the form, and never covers the word", async ({ page }) => {
  await openBook(page);
  const ws = words(page);
  const n = await ws.count();
  // the first word, words low on the first screen, and the last word of the page
  for (const i of [3, 60, 120, 200, n - 1]) {
    const w = ws.nth(i);
    await lookUp(page, w);
    await expect(w).toHaveAttribute("aria-current", "true");
    await clear(page, w);
    // the floating card may lie over the next word: put it away first, as a reader would
    await page.keyboard.press("Escape");
    await expect(lookup(page)).toHaveCount(0);
  }
  await lookUp(page, ws.nth(14));
  await expect(lookup(page)).toContainText("Here, it is");
});

test("More about it, Back, Previous, Next and Escape", async ({ page, isMobile }) => {
  await openBook(page);
  const ws = words(page);
  await lookUp(page, ws.nth(14));
  await page.getByRole("button", { name: "More about it" }).click();
  await expect(lookup(page)).toContainText("Dictionary · LSJ");
  await expect(lookup(page)).toContainText("How sure");
  // (on a phone the second layer fills the screen and hides the text on purpose: the word is in sight again after Back)
  if (!isMobile) await clear(page, ws.nth(14));
  // οἶδα's LSJ entry is two short lines: all of it shows, with nothing more to open; its "v. Εἴδω" is written out and opens Εἴδω
  await expect(lookup(page)).toContainText("see Εἴδω B.");
  await expect(page.getByRole("button", { name: "The whole entry" })).toHaveCount(0);
  await lookup(page).getByRole("button", { name: "Εἴδω", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to οἶδα" })).toBeVisible();
  await expect(lookup(page)).toContainText("This word is not in the passage.");
  await page.getByRole("button", { name: "Back to οἶδα" }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "More about it" })).toBeVisible();
  await clear(page, ws.nth(14));
  await page.getByRole("button", { name: "Next word" }).click();
  await expect(ws.nth(15)).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Previous word" }).click();
  await expect(ws.nth(14)).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Close the look-up" }).click();
  await expect(lookup(page)).toHaveCount(0);
  await expect(ws.nth(14)).not.toHaveAttribute("aria-current", "true");

  // ἄνδρες: LSJ's long entry for ἀνήρ starts clipped, and opens whole
  await lookUp(page, ws.nth(6));
  await page.getByRole("button", { name: "More about it" }).click();
  await page.getByRole("button", { name: "The whole entry" }).click();
  await expect(page.getByRole("button", { name: "The short entry" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "More about it" })).toBeVisible();
});

test("the keyboard: Tab to a passage, arrows from word to word, Enter looks up, Escape closes", async ({ page }) => {
  await openBook(page);
  const ws = words(page);
  await ws.first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(ws.nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(lookup(page)).toBeFocused();
  await expect(lookup(page).locator("[aria-busy=false]")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(lookup(page)).toHaveCount(0);
  await expect(ws.nth(2)).toBeFocused();
});

test("Aa: Day or Night, the Greek's size, and the columns", async ({ page }) => {
  await openBook(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("radio", { name: "Night" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("radio", { name: "Day" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.getByRole("radio", { name: "Follow device" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  const size = () => words(page).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const before = await size();
  await page.getByRole("button", { name: "Larger" }).click();
  expect(await size()).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Smaller" }).click();
  await page.getByRole("button", { name: "Smaller" }).click();
  expect(await size()).toBeLessThan(before);
  await page.getByRole("button", { name: "Device size" }).click();
  expect(await size()).toBeCloseTo(before, 0);

  await page.getByRole("radio", { name: "Both" }).click();
  await expect(page.locator("main[data-cols=both]")).toBeVisible();
  await expect(page.locator("[data-reading]").first()).toContainText("How you, men of Athens");
  await page.getByRole("radio", { name: "English" }).click();
  await expect(words(page).first()).toBeHidden();
  await page.getByRole("radio", { name: "Greek" }).click();
  await expect(page.locator("[data-reading]")).toHaveCount(0);

  // remembered on this device
  await page.getByRole("radio", { name: "Night" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Close Page and text" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("pages: the menu, Continue and the way back, and the Library", async ({ page }) => {
  await openBook(page);
  await page.getByRole("button", { name: /^Go to:/ }).click();
  await page.getByRole("button", { name: "Sections 35–40" }).click();
  await expect(page).toHaveURL(/p=4/);
  await expect(page.getByRole("button", { name: /^Go to:/ })).toContainText("Sections 35–40");
  await page.getByRole("button", { name: /Continue to Sections 41–42/ }).click();
  await expect(page).toHaveURL(/p=5/);
  await expect(page.getByRole("button", { name: /Continue/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Sections 35–40/ }).click();
  await expect(page).toHaveURL(/p=4/);
  await page.goto(`${APOLOGY}&at=29`);
  await expect(page.locator("#p-29")).toBeInViewport();
  await page.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("on a phone, More about it fills the screen; the handle drags it back to the low sheet, up again, and away", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's sheet");
  await openBook(page);
  await lookUp(page, words(page).nth(5));
  const sheet = lookup(page);
  const vh = page.viewportSize()!.height;
  // drag from the sheet's handle, at the middle of its top edge
  // (slow: a hand's pace, 16 ms a step, so a short drag is not read as a flick, which closes it as a long drag does)
  const drag = async (dy: number, slow = false) => {
    const b = (await sheet.boundingBox())!;
    const x = b.x + b.width / 2, y = b.y + 22;
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (slow) for (let i = 1; i <= 10; i++) { await page.mouse.move(x, y + (dy * i) / 10); await page.waitForTimeout(16); }
    else await page.mouse.move(x, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  await sheet.getByRole("button", { name: "More about it" }).click();
  await expect(sheet).toHaveAttribute("data-layer", "2");
  await expect.poll(async () => (await sheet.boundingBox())!.y).toBe(0);
  expect(Math.round((await sheet.boundingBox())!.height)).toBe(vh);
  await drag(220);
  await expect(sheet).toHaveAttribute("data-layer", "1");
  expect((await sheet.boundingBox())!.y).toBeGreaterThan(vh / 3);
  await drag(-120);
  await expect(sheet).toHaveAttribute("data-layer", "2");
  await drag(220);
  await expect(sheet).toHaveAttribute("data-layer", "1");
  // a short drag that lets go early slides back, and leaves it as it was
  await drag(30, true);
  await expect(sheet).toHaveAttribute("data-layer", "1");
  await drag(220);
  await expect(sheet).toHaveCount(0);
});

test("on a phone, a swipe down anywhere in More about it brings back the low sheet, once it is scrolled to its top", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's sheet");
  await openBook(page);
  await lookUp(page, words(page).nth(14));
  const sheet = lookup(page);
  const body = sheet.locator("[aria-busy]");
  // a finger on the screen, through the browser's own touch events (the sheet listens for touches, not for a mouse)
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (from: number, to: number) => {
    const x = 195, steps = 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
    for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: from + ((to - from) * i) / steps }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await sheet.getByRole("button", { name: "More about it" }).click();
  await expect(sheet).toHaveAttribute("data-layer", "2");
  await expect(sheet.getByText("Dictionary · LSJ")).toBeVisible();
  // scrolled down, a swipe down scrolls the words back up and leaves More about it open
  await body.evaluate((b) => { b.scrollTop = 400; });
  await swipe(400, 560);
  await expect(sheet).toHaveAttribute("data-layer", "2");
  // a swipe up scrolls, too
  await body.evaluate((b) => { b.scrollTop = 0; });
  await swipe(600, 420);
  await expect(sheet).toHaveAttribute("data-layer", "2");
  // at the top, a swipe down from the middle of the screen brings back the low sheet
  await body.evaluate((b) => { b.scrollTop = 0; });
  await swipe(420, 680);
  await expect(sheet).toHaveAttribute("data-layer", "1");
  // and a short one that lets go early leaves it where it was
  await swipe(560, 580);
  await expect(sheet).toHaveAttribute("data-layer", "1");
  await expect(sheet).toBeVisible();
});

test("nothing scrolls sideways", async ({ page }) => {
  await openBook(page, { settings: { columns: "both" } });
  for (const act of [async () => {}, () => lookUp(page, words(page).nth(14)), () => page.getByRole("button", { name: "More about it" }).click()]) {
    await act();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});
