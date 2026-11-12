// A stand-in for Supabase, for the browser tests and the look checks: every call to the project is answered here, so they never
// contact the real database. Made-up placeholder text only: no real private text may ever be in this repository.
import { readFileSync } from "node:fs";

const env = (() => { try { return readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch { return ""; } })();
export const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(env)?.[1] ?? "https://none.supabase.co";
export const SESSION_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
export const PASSWORD = "placeholder-password";
export const DOC = {
  format: "mathesis-translation/1", id: "placeholder-work", author: "Placeholder Author", title: "Placeholder Title", status: "draft",
  passages: [{ heading: "Placeholder heading", rows: [{ ref: "1", greek: "λόγος ἐστί", english: "Placeholder sentence one." }, { ref: "2", greek: "ἀρετή", english: "Placeholder sentence two." }] }],
};
const USER = { id: "00000000-0000-0000-0000-000000000000", aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = () => ({ access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER });

/** Answer every call to the project on this page or context; returns the list of what was asked. */
export async function fakeSupabase(target) {
  const asked = [];
  await target.route(`${SUPABASE_URL}/**`, async (route) => {
    const u = route.request().url();
    asked.push(u);
    if (u.includes("/auth/v1/token")) {
      const body = route.request().postDataJSON() ?? {};
      if (body.password !== PASSWORD) return route.fulfill({ status: 400, json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } });
      return route.fulfill({ json: session() });
    }
    if (u.includes("/auth/v1/logout")) return route.fulfill({ status: 204 });
    if (u.includes("/rest/v1/private_translations")) {
      if (u.includes("select=doc")) return u.includes("eq.placeholder-work") ? route.fulfill({ json: { doc: DOC } }) : route.fulfill({ status: 406, json: {} });
      return route.fulfill({ json: [{ id: DOC.id, title: DOC.title, author: DOC.author, status: DOC.status }] });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return asked;
}

/** Start signed in, as supabase-js keeps a session in the browser. */
export async function signedIn(ctx) {
  await ctx.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SESSION_KEY, session()]);
}
