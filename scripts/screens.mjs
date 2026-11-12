// The screens every look check visits: each page, and each state of it that draws something of its own (the look-up's two layers,
// the reader's menus, signed in or not). Shared by check-design.mjs, check-a11y.mjs and shots.mjs, so a new screen is added once.
import { fakeSupabase, signedIn } from "./fake-supabase.mjs";
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
  { name: "sign in", path: "/account" },
  { name: "account, signed in", path: "/account", signedIn: true },
  { name: "library, signed in", path: "/", signedIn: true },
  { name: "private text", path: "/read?w=mine:placeholder-work", signedIn: true },
];

/** Settings as the app keeps them (lib/settings.ts), set before the page loads; the Apology counts as opened before (no title page).
 *  Signed in, Supabase is the stand-in of fake-supabase.mjs, with placeholder text only. */
export async function prepare(ctx, { theme = "auto", columns = "greek", signedIn: signed = false } = {}) {
  await ctx.addInitScript(([theme, columns]) => {
    localStorage.setItem("mathesis-reader:settings", JSON.stringify({ theme, columns, greekSize: "auto" }));
    localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002"]));
  }, [theme, columns]);
  await fakeSupabase(ctx);
  if (signed) await signedIn(ctx);
}

/** Open a screen and bring it to its state, with the fonts in and nothing still inking in. */
export async function open(page, base, s) {
  await page.goto(base + s.path);
  await page.locator("h1, main a, main button").first().waitFor({ timeout: 30_000 });
  if (s.path.startsWith("/read")) await page.locator("[role=button]").first().waitFor({ timeout: 30_000 });
  else if (s.path.startsWith("/account")) await page.locator("main form, main .btn").first().waitFor({ timeout: 30_000 });
  else if (s.path.startsWith("/credits")) await page.locator("main h1").waitFor({ timeout: 30_000 });
  else await page.locator(s.signedIn ? "section[aria-labelledby=private-texts] ul" : "main h3").first().waitFor({ timeout: 30_000 });
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
  await page.waitForTimeout(400);
}
