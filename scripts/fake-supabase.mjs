// A stand-in for Supabase, for the browser tests and the look checks: every call to the project is answered here, so they never
// contact the real database. Made-up placeholder text and made-up codes only: no real private text or code may be in this repository.
// It answers as the functions of supabase/migrations do: CODE is the owner's (it opens the private texts), OTHER is anyone's, a
// new code from make_sync_code is NEW, and each code keeps its own notes.
import { readFileSync } from "node:fs";

const env = (() => { try { return readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch { return ""; } })();
export const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(env)?.[1] ?? "https://none.supabase.co";
export const CODE_KEY = "mathesis-reader:sync-code";
export const NOTES_KEY = "mathesis-reader:notes";
export const CODE = "7K3Q9XWDM2RT0HVBPZ4N";
export const OTHER = "AB12CD34EF56GH78JK90";
export const NEW = "MN34PQ56RS78TV90WX12";
export const DOC = {
  format: "mathesis-translation/1", id: "placeholder-work", author: "Placeholder Author", title: "Placeholder Title", status: "draft",
  passages: [{ heading: "Placeholder heading", rows: [{ ref: "1", greek: "λόγος ἐστί", english: "Placeholder sentence one." }, { ref: "2", greek: "ἀρετή", english: "Placeholder sentence two." }] }],
};
const UNKNOWN = { status: 403, json: { code: "28000", details: null, hint: null, message: "unknown sync code" } };

/** Answer every call to the project on this page or context; returns what was asked. `notes` (by code, then id) is read and changed in place. */
export async function fakeSupabase(target, { notes = {} } = {}) {
  const asked = [];
  const codes = new Set([CODE, OTHER]);
  await target.route(`${SUPABASE_URL}/**`, async (route) => {
    const u = route.request().url();
    asked.push(u);
    const body = route.request().postDataJSON() ?? {};
    const fn = u.split("/rest/v1/rpc/")[1];
    if (fn === "make_sync_code") { codes.add(NEW); return route.fulfill({ json: NEW.match(/.{4}/g).join("-") }); }
    if (!fn) return route.fulfill({ status: 404, json: {} });
    if (!codes.has(body.code)) return route.fulfill(UNKNOWN);
    const owner = body.code === CODE;
    if (fn === "private_texts") return route.fulfill({ json: owner ? [{ id: DOC.id, title: DOC.title, author: DOC.author, status: DOC.status }] : [] });
    if (fn === "private_text") return route.fulfill({ json: owner && body.text_id === DOC.id ? DOC : null });
    if (fn === "notes_list") return route.fulfill({ json: Object.values(notes[body.code] ?? {}) });
    if (fn === "notes_save") {
      const mine = (notes[body.code] ??= {});
      for (const n of body.notes) if (!mine[n.id] || mine[n.id].updated < n.updated) mine[n.id] = n;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return asked;
}

/** Start synced, as the app keeps the code on the device. */
export async function synced(ctx, code = CODE) {
  await ctx.addInitScript(([k, c]) => localStorage.setItem(k, c), [CODE_KEY, code]);
}

/** Start with notes on the device. */
export async function withNotes(ctx, notes) {
  await ctx.addInitScript(([k, n]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, n); }, [NOTES_KEY, JSON.stringify(notes)]);
}
