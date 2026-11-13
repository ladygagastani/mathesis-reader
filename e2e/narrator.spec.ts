import { expect, test, type Page } from "@playwright/test";

// The narrator (Narrator.tsx), clicked in a real browser at a computer's width and a phone's. A browser run by Playwright has no
// voices, so the page gets a stand-in for the browser's speech synthesis: it lists a few English voices, "says" each word in a few
// milliseconds, reports each word as a voice does, and ends. Everything else (the player, the marks, the page turning) is the app's own.
const APOLOGY = "/read?w=tlg0059.tlg002";

async function openBook(page: Page, settings: object = {}) {
  await page.addInitScript((settings) => {
    localStorage.setItem("mathesis-reader:opened", JSON.stringify(["tlg0059.tlg002"]));
    localStorage.setItem("mathesis-reader:settings", JSON.stringify(settings));
    const w = window as unknown as Record<string, unknown>;
    const said: { text: string; voice?: string; rate: number }[] = [];
    w.__said = said;
    w.__wordMs = 25;
    class Utterance extends EventTarget {
      voice: { name: string } | null = null; rate = 1; pitch = 1; lang = "";
      onstart?: (e: object) => void; onboundary?: (e: object) => void; onend?: (e: object) => void; onerror?: (e: object) => void;
      constructor(public text: string) { super(); }
    }
    const voice = (name: string, lang: string, localService: boolean) => ({ name, lang, localService, voiceURI: name, default: false });
    const voices = [
      voice("Microsoft David - English (United States)", "en-US", true),
      voice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB", false),
      voice("Google UK English Female", "en-GB", false),
      voice("Thomas", "fr-FR", true),
    ];
    let current: Utterance | null = null;
    let timers: number[] = [];
    const synth = Object.assign(new EventTarget(), {
      speaking: false, pending: false, paused: false,
      getVoices: () => voices,
      speak(u: Utterance) {
        current = u;
        synth.speaking = true;
        said.push({ text: u.text, voice: u.voice?.name, rate: u.rate });
        const words = [...u.text.matchAll(/\S+/g)];
        const ms = w.__wordMs as number;
        timers.push(window.setTimeout(() => {
          u.onstart?.({});
          words.forEach((m, k) => timers.push(window.setTimeout(() => { if (current === u) u.onboundary?.({ name: "word", charIndex: m.index, charLength: m[0].length }); }, k * ms)));
          timers.push(window.setTimeout(() => { if (current === u) { current = null; synth.speaking = false; u.onend?.({}); } }, words.length * ms + 20));
        }, 10));
      },
      cancel() {
        const u = current;
        current = null;
        synth.speaking = false;
        timers.forEach(clearTimeout);
        timers = [];
        u?.onerror?.({ error: "interrupted" });
      },
      pause() { synth.paused = true; },
      resume() { synth.paused = false; },
    });
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    w.SpeechSynthesisUtterance = Utterance;
  }, settings);
  await page.goto(APOLOGY);
  // (the first passage drawn; with the English alone, its Greek words are hidden)
  await page.locator("main section[id^='p-']").first().waitFor({ timeout: 30_000 });
}

const player = (page: Page) => page.getByRole("region", { name: "Narrator" });
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: { text: string; voice?: string; rate: number }[] }).__said);
const marked = (page: Page, name: string) => page.evaluate((n) => {
  const h = CSS.highlights.get(n);
  return h ? [...h][0]?.toString() ?? null : null;
}, name);

test("Listen reads the English aloud from the first passage, marks the sentence and the word, and opens the English under the Greek", async ({ page }) => {
  await openBook(page);
  await page.getByRole("button", { name: /^Listen/ }).click();
  await expect(player(page)).toBeVisible();
  await expect(player(page)).toContainText(/left on this page/);
  // the best English voice: a natural one, never the French
  await expect.poll(async () => (await said(page))[0]?.voice).toMatch(/Sonia/);
  // only the Greek was showing: the English being read opens under its Greek
  await expect(page.locator("#p-17 [data-reading]")).toBeVisible();
  await expect(page.locator("#p-17")).toHaveAttribute("data-voice", "");
  await expect.poll(() => marked(page, "voice-sentence")).toBeTruthy();
  await expect.poll(() => marked(page, "voice-word")).toBeTruthy();
  // what is said is English only: no Greek letters, no section markers
  for (const s of await said(page)) expect(s.text).not.toMatch(/[Ͱ-Ͽἀ-῿]|\b17[a-e]\b/);
});

test("pause stops the voice and play goes on from the word it had reached; the keys move by sentence and passage", async ({ page }) => {
  await openBook(page, { columns: "both" });
  await page.evaluate(() => { (window as unknown as { __wordMs: number }).__wordMs = 120; });
  await page.keyboard.press("l");
  await expect(player(page)).toBeVisible();
  await expect.poll(async () => (await said(page)).length).toBeGreaterThan(1);
  await page.waitForTimeout(600);
  await player(page).getByRole("button", { name: "Pause" }).click();
  await expect(player(page)).toContainText("Paused");
  const before = (await said(page)).at(-1)!.text;
  await player(page).getByRole("button", { name: "Read on" }).click();
  const after = (await said(page)).at(-1)!.text;
  // the same sentence again, from a word inside it
  expect(before.endsWith(after)).toBe(true);
  expect(after.length).toBeLessThan(before.length);

  await page.keyboard.press("}");
  await expect(page.locator("#p-18")).toHaveAttribute("data-voice", "");
  await page.keyboard.press("{");
  await page.keyboard.press("{");
  await expect(page.locator("#p-17")).toHaveAttribute("data-voice", "");
  await expect(player(page)).toContainText(/sentence 1 of/);
  await page.keyboard.press("]");
  await expect(player(page)).toContainText(/sentence 2 of/);
});

test("at the end of a page the narrator turns the page and reads on", async ({ page }) => {
  await openBook(page, { columns: "trans" });
  await page.evaluate(() => { (window as unknown as { __wordMs: number }).__wordMs = 1; });
  await page.getByRole("button", { name: /^Listen/ }).click();
  await expect(page).toHaveURL(/p=2|at=2[3-9]/, { timeout: 20_000 });
  await expect(player(page)).toContainText(/^2\d/, { timeout: 10_000 });
});

test("a click on the English reads from there", async ({ page }) => {
  await openBook(page, { columns: "trans" });
  await page.evaluate(() => { (window as unknown as { __wordMs: number }).__wordMs = 200; });
  await page.getByRole("button", { name: /^Listen/ }).click();
  await expect(page.locator("#p-17")).toHaveAttribute("data-voice", "");
  const english = page.locator("#p-20 [data-reading] p").first();
  await english.scrollIntoViewIfNeeded();
  await english.click({ position: { x: 40, y: 10 } });
  await expect(page.locator("#p-20")).toHaveAttribute("data-voice", "");
  expect((await said(page)).at(-1)!.text.length).toBeGreaterThan(0);
});

test("the voice's settings: another voice, a faster speed and a name said your way are used at once", async ({ page }) => {
  await openBook(page, { columns: "trans" });
  await page.evaluate(() => { (window as unknown as { __wordMs: number }).__wordMs = 150; });
  await page.getByRole("button", { name: /^Listen/ }).click();
  await player(page).getByRole("button", { name: "The voice's settings" }).click();
  const leaf = page.getByRole("dialog", { name: "Listening" });
  await expect(leaf).toBeVisible();
  // the French voice is not offered; the natural ones come first
  await expect(leaf.locator("option")).toHaveCount(3);
  await expect(leaf.locator("optgroup").first()).toHaveAttribute("label", "Natural voices");
  await leaf.getByLabel("Voice", { exact: true }).selectOption({ label: "David · American" });
  await expect.poll(async () => (await said(page)).at(-1)?.voice).toMatch(/David/);
  await leaf.getByRole("button", { name: "1.5×" }).click();
  await expect.poll(async () => (await said(page)).at(-1)?.rate).toBe(1.5);
  await expect(player(page)).toContainText("1.5×");
  await leaf.getByLabel("The name as written").fill("Athens");
  await leaf.getByLabel("How to say it").fill("Athenz");
  await leaf.getByRole("button", { name: "Add" }).click();
  await expect(leaf.getByText("Athenz")).toBeVisible();
  // kept for next time
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("mathesis-reader:narrator") ?? "{}"));
  expect(stored).toMatchObject({ rate: 1.5, say: [{ write: "Athens", say: "Athenz" }] });
  await page.keyboard.press("Escape");
  await expect(leaf).toBeHidden();
});

test("closing the narrator stops the voice and takes its marks off the page", async ({ page }) => {
  await openBook(page);
  await page.getByRole("button", { name: /^Listen/ }).click();
  await expect.poll(() => marked(page, "voice-sentence")).toBeTruthy();
  await player(page).getByRole("button", { name: "Stop and close the narrator" }).click();
  await expect(player(page)).toBeHidden();
  await expect.poll(() => marked(page, "voice-sentence")).toBeNull();
  await expect(page.locator("[data-voice]")).toHaveCount(0);
  const n = (await said(page)).length;
  await page.waitForTimeout(500);
  expect((await said(page)).length).toBe(n);
});
