// The screens every look check visits: each page, and each state of it that draws something of its own (the look-up's two layers,
// the reader's menus, synced or not). Shared by check-design.mjs, check-a11y.mjs and shots.mjs, so a new screen is added once.
import { fakeSupabase, synced, withNotes } from "./fake-supabase.mjs";

/** Notes on the Apology, made up, for the screens that show notes: one of each kind and colour. */
const NOTES = [
  { id: "n1", work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "passage", unit: "17" }, colour: "blue", text: "The opening: Socrates sets the plain truth against his accusers' fine speech.", updated: 4 },
  { id: "n2", work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "word", unit: "18", i: 5, word: "λόγος" }, colour: "ochre", text: "Compare the use in 17b.", updated: 3 },
  { id: "n3", work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "passage", unit: "20" }, colour: "green", text: "Chaerephon and the oracle.", updated: 2 },
  { id: "n4", work: "tlg0012.tlg001", book: "Homer, Iliad", anchor: { kind: "line", unit: "1.1", line: 0, lines: 1 }, colour: "red", text: "Wrath, the first word of the poem.", updated: 1 },
];
export const SCREENS = [
  { name: "library", path: "/" },
  { name: "library, search", path: "/?q=plato" },
  { name: "library, an author opened", path: "/?q=plato", act: "author" },
  { name: "library, by kind", path: "/?sort=kind" },
  { name: "reader", path: "/read?w=tlg0059.tlg002" },
  { name: "reader, English shown", path: "/read?w=tlg0059.tlg002", act: "english" },
  { name: "reader, Both", path: "/read?w=tlg0059.tlg002", columns: "both" },
  { name: "look-up", path: "/read?w=tlg0059.tlg002", act: "look" },
  { name: "look-up, more", path: "/read?w=tlg0059.tlg002", act: "more" },
  { name: "Aa", path: "/read?w=tlg0059.tlg002", act: "aa" },
  { name: "pages", path: "/read?w=tlg0059.tlg002", act: "pages" },
  { name: "credits", path: "/credits" },
  { name: "sync", path: "/sync" },
  { name: "sync, synced", path: "/sync", synced: true },
  { name: "library, synced", path: "/", synced: true },
  { name: "your private texts", path: "/", synced: true, act: "private" },
  { name: "private text", path: "/read?w=mine:placeholder-work", synced: true },
  { name: "sync, new code", path: "/sync", act: "make" },
  { name: "saved", path: "/saved", notes: true },
  { name: "reader, notes", path: "/read?w=tlg0059.tlg002", notes: true, act: "notes" },
  { name: "note", path: "/read?w=tlg0059.tlg002", notes: true, act: "mark" },
  { name: "new note", path: "/read?w=tlg0059.tlg002", act: "new-note" },
];

/** Settings as the app keeps them (lib/settings.ts), set before the page loads; the Apology counts as opened before (no title page).
 *  Synced, Supabase is the stand-in of fake-supabase.mjs, with placeholder text only. */
export async function prepare(ctx, { theme = "auto", columns = "greek", synced: sync = false, notes = false } = {}) {
  await ctx.addInitScript(([theme, columns]) => {
    localStorage.setItem("mathesis-reader:settings", JSON.stringify({ theme, columns, greekSize: "auto" }));
    localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002"]));
  }, [theme, columns]);
  await fakeSupabase(ctx);
  if (sync) await synced(ctx);
  if (notes) await withNotes(ctx, NOTES);
}

/** Open a screen and bring it to its state, with the fonts in and nothing still inking in. */
export async function open(page, base, s) {
  await page.goto(base + s.path);
  await page.locator("h1, main a, main button").first().waitFor({ timeout: 30_000 });
  if (s.path.startsWith("/read")) await page.locator("[role=button]").first().waitFor({ timeout: 30_000 });
  else if (s.path.startsWith("/sync")) await page.locator("main form, main .btn").first().waitFor({ timeout: 30_000 });
  else if (s.path.startsWith("/credits") || s.path.startsWith("/saved")) await page.locator("main h1").waitFor({ timeout: 30_000 });
  else await page.locator("main h3").first().waitFor({ timeout: 30_000 });
  if (s.act === "author") await page.locator("main button[aria-expanded]").first().click();
  await page.evaluate(() => document.fonts.ready);
  if (s.act === "english") await page.getByRole("button", { name: "Show the English" }).first().click();
  if (s.act === "look" || s.act === "more") {
    await page.locator("main [role=button]").nth(14).click();
    await page.locator("[data-lookup] [aria-busy=false]").waitFor({ timeout: 30_000 });
    if (s.act === "more") { await page.getByRole("button", { name: "More about it" }).click(); await page.getByText("Dictionary · LSJ").waitFor(); }
  }
  if (s.act === "aa") await page.getByRole("button", { name: "Text", exact: true }).click();
  if (s.act === "pages") await page.getByRole("button", { name: /^Pages:/ }).click();
  if (s.act === "private") await page.getByRole("button", { name: /^Private texts/ }).click();
  if (s.act === "make") await page.getByRole("button", { name: "Make a new code" }).click();
  if (s.act === "notes") await page.getByRole("button", { name: /^Notes/ }).click();
  if (s.act === "mark") await page.getByRole("navigation", { name: "Notes on this page" }).getByRole("button").first().click();
  if (s.act === "new-note") {
    await page.locator("main [role=button]").nth(14).click();
    await page.locator("[data-lookup]").getByRole("button", { name: "Note", exact: true }).click();
  }
  await page.waitForTimeout(400);
}
