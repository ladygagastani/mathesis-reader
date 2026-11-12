// A stand-in for Supabase, for the browser tests and the look checks: every call to the project is answered here, so they never
// contact the real database. Made-up placeholder text and a made-up code only: no real private text or code may be in this repository.
import { readFileSync } from "node:fs";

const env = (() => { try { return readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch { return ""; } })();
export const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(env)?.[1] ?? "https://none.supabase.co";
export const CODE_KEY = "mathesis-reader:sync-code";
export const CODE = "7K3Q9XWDM2RT0HVBPZ4N";
export const DOC = {
  format: "mathesis-translation/1", id: "placeholder-work", author: "Placeholder Author", title: "Placeholder Title", status: "draft",
  passages: [{ heading: "Placeholder heading", rows: [{ ref: "1", greek: "λόγος ἐστί", english: "Placeholder sentence one." }, { ref: "2", greek: "ἀρετή", english: "Placeholder sentence two." }] }],
};
const UNKNOWN = { status: 403, json: { code: "28000", details: null, hint: null, message: "unknown sync code" } };

/** Answer every call to the project on this page or context, as the functions of the sync-codes migration do; returns what was asked. */
export async function fakeSupabase(target) {
  const asked = [];
  await target.route(`${SUPABASE_URL}/**`, async (route) => {
    const u = route.request().url();
    asked.push(u);
    const body = route.request().postDataJSON() ?? {};
    if (u.endsWith("/rest/v1/rpc/private_texts")) {
      if (body.code !== CODE) return route.fulfill(UNKNOWN);
      return route.fulfill({ json: [{ id: DOC.id, title: DOC.title, author: DOC.author, status: DOC.status }] });
    }
    if (u.endsWith("/rest/v1/rpc/private_text")) {
      if (body.code !== CODE) return route.fulfill(UNKNOWN);
      return route.fulfill({ json: body.text_id === DOC.id ? DOC : null });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return asked;
}

/** Start synced, as the app keeps the code on the device. */
export async function synced(ctx) {
  await ctx.addInitScript(([k, c]) => localStorage.setItem(k, c), [CODE_KEY, CODE]);
}
