import { expect, test, type Page } from "@playwright/test";
import { CODE, NOTES_KEY, fakeSupabase, synced, withNotes } from "../scripts/fake-supabase.mjs";

// Notes and Saved (SPEC.md), clicked in a real browser at a computer's width and a phone's. Supabase is the stand-in of
// scripts/fake-supabase.mjs, with made-up codes only.
const APOLOGY = "/read?w=tlg0059.tlg002";
const words = (page: Page) => page.locator("main [data-u] [role=button]");
const marks = (page: Page) => page.getByRole("navigation", { name: "Notes on this page" }).getByRole("button");
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), NOTES_KEY);

async function open(page: Page, path = APOLOGY) {
  await page.addInitScript(() => localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002", "tlg0012.tlg001"])));
  await page.goto(path);
  await words(page).first().waitFor({ timeout: 30_000 });
}

async function writeNote(page: Page, wordIndex: number, on: string, colour: string, text: string) {
  await words(page).nth(wordIndex).click();
  await page.locator("[data-lookup]").getByRole("button", { name: "Note", exact: true }).click();
  const editor = page.getByRole("complementary", { name: "A new note" });
  await editor.getByRole("radio", { name: on }).click();
  await editor.getByRole("radio", { name: colour }).click();
  await editor.getByLabel("Your note").fill(text);
  await editor.getByRole("button", { name: "Save the note" }).click();
  await expect(editor).toHaveCount(0);
}

test("a note on a passage: marked in the text and at the right edge, listed under Notes, opened, edited and removed", async ({ page }) => {
  await open(page);
  await writeNote(page, 1000, "The passage", "Blue", "Socrates begins his defence.");
  await expect(page.locator("main section[data-noted=passage][data-colour=blue]")).toHaveCount(1);
  await expect(marks(page)).toHaveCount(1);
  await expect(marks(page).first()).toHaveAccessibleName(/^Note on .+: Socrates begins his defence\.$/);
  const [note] = await stored(page);
  expect(note).toMatchObject({ work: "tlg0059.tlg002", colour: "blue", text: "Socrates begins his defence.", anchor: { kind: "passage" } });

  // the mark stands where the scrollbar's thumb stands when the passage is in view (a passage half-way down the page, so the mark is
  // not held in from the window's edges)
  const at = await page.evaluate(() => {
    const el = document.querySelector("main section[data-noted]")!;
    const mark = document.querySelector("nav[aria-label='Notes on this page'] button")!.getBoundingClientRect();
    const want = ((el.getBoundingClientRect().top + scrollY) / document.documentElement.scrollHeight) * innerHeight;
    return { centre: mark.top + mark.height / 2, want };
  });
  expect(Math.abs(at.centre - at.want)).toBeLessThan(2);

  // the mark jumps to the passage and opens the note
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await marks(page).first().click();
  const editor = page.getByRole("complementary", { name: /^Your note on / });
  await expect(editor.getByLabel("Your note")).toHaveValue("Socrates begins his defence.");
  const box = (await page.locator("main section[data-noted]").boundingBox())!;
  expect(box.y + 20, "the passage is in view").toBeLessThan(page.viewportSize()!.height);
  await editor.getByLabel("Your note").fill("Edited.");
  await editor.getByRole("button", { name: "Save the note" }).click();
  expect((await stored(page))[0].text).toBe("Edited.");

  // the foot bar's Notes lists it and opens it
  await page.getByRole("button", { name: /^Notes/ }).click();
  const menu = page.getByRole("dialog", { name: "Notes in this book" });
  await expect(menu).toContainText("Edited.");
  await menu.getByRole("button", { name: /Edited\./ }).click();
  await page.getByRole("complementary", { name: /^Your note on / }).getByRole("button", { name: "Remove" }).click();
  await expect(marks(page)).toHaveCount(0);
  await expect(page.locator("main [data-noted]")).toHaveCount(0);
  expect((await stored(page))[0]).toMatchObject({ deleted: true, text: "" });
});

test("a note on a word is underlined in its colour; a word in a line of verse can take a note on the line", async ({ page }) => {
  await open(page);
  await writeNote(page, 12, "The word", "Ochre", "A word to remember.");
  await expect(page.locator("main [role=button][data-noted=word][data-colour=ochre]")).toHaveCount(1);
  expect((await stored(page))[0].anchor).toMatchObject({ kind: "word", i: expect.any(Number) });

  await page.goto("/read?w=tlg0012.tlg001");
  await words(page).first().waitFor({ timeout: 30_000 });
  await writeNote(page, 3, "The line", "Green", "The first line.");
  await expect(page.locator("main [data-noted=line][data-colour=green]")).toHaveCount(1);
  const line = (await stored(page)).find((n: { work: string }) => n.work === "tlg0012.tlg001");
  expect(line.anchor).toMatchObject({ kind: "line", line: 0, lines: 1 });
});

test("Saved lists every note by book, edits it, and opens it at its place in the book", async ({ page }) => {
  await withNotes(page.context(), [{
    id: "aaaa1111", work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "passage", unit: "19" }, colour: "red", text: "A saved note.", updated: 1,
  }]);
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Plato, Apology" })).toBeVisible();
  await expect(page.getByText("These notes are on this device only.")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Your note on 19/).fill("Changed on the Saved page.");
  await page.getByRole("button", { name: "Save the note" }).click();
  await expect(page.getByText("Changed on the Saved page.")).toBeVisible();
  await page.getByRole("link", { name: "Open in the book" }).click();
  await expect(page).toHaveURL(/at=19&note=aaaa1111/);
  await expect(page.getByRole("complementary", { name: "Your note on 19" }).getByLabel("Your note")).toHaveValue("Changed on the Saved page.", { timeout: 30_000 });
});

test("with a sync code, notes come from the database and new ones go to it", async ({ page }) => {
  const notes: Record<string, Record<string, { text: string }>> = {
    [CODE]: { bbbb2222: { id: "bbbb2222", work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "passage", unit: "17" }, colour: "green", text: "From another device.", updated: 5 } as never },
  };
  await fakeSupabase(page, { notes });
  await synced(page.context());
  await page.goto("/saved");
  await expect(page.getByText("From another device.")).toBeVisible();
  await expect(page.getByText("Synced. These notes go with your code.")).toBeVisible();
  await open(page);
  await writeNote(page, 20, "The passage", "Red", "Made on this device.");
  await expect.poll(() => Object.values(notes[CODE]).map((n) => n.text).sort(), { timeout: 10_000 })
    .toEqual(["From another device.", "Made on this device."]);
});
