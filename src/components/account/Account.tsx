"use client";
/**
 * Signing in (SPEC.md, "Sign-in and private texts"): the old site's account, by email and password, in the Supabase project it
 * uses. The owner types them here; the app keeps neither (Supabase keeps the session in this browser). After signing in the page
 * goes back to where it was asked from (?next=/read?w=mine:…), or to the library.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { signIn, signOut, trouble, useAccount } from "@/lib/account";
import styles from "./Account.module.css";

export default function Account() {
  const { ready, email } = useAccount();
  const router = useRouter();
  const asked = useSearchParams().get("next");
  const next = asked && asked.startsWith("/") && !asked.startsWith("//") ? asked : "/";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try { await signIn(String(f.get("email")).trim(), String(f.get("password"))); router.push(next); }
    catch (err) { setError(trouble(err)); setBusy(false); }
  };
  const leave = async () => {
    setBusy(true); setError("");
    try { await signOut(); router.push("/"); } catch (err) { setError(trouble(err)); setBusy(false); }
  };

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>{email ? "Your account" : "Sign in"}</h1>
        <p className={styles.purpose}>Signed in, you see your private texts at the top of the library, and only you can open them.</p>
      </header>
      {!ready && <p className="muted" aria-busy="true">Checking this browser…</p>}
      {ready && email && (
        <div className={styles.box}>
          <p>Signed in as <b>{email}</b>.</p>
          <div className={styles.row}>
            <Link className="btn" href={next}>Go to the library<Icon name="next" /></Link>
            <button type="button" className="btn ghost" onClick={leave} disabled={busy}>Sign out</button>
          </div>
        </div>
      )}
      {ready && !email && (
        <form className={styles.box} onSubmit={submit}>
          <label className={styles.field}><span className="label">Email</span><input type="email" name="email" autoComplete="username" required /></label>
          <label className={styles.field}><span className="label">Password</span><input type="password" name="password" autoComplete="current-password" required /></label>
          <div className={styles.row}><button type="submit" className="btn" disabled={busy}><Icon name="sign-in" />{busy ? "Signing in…" : "Sign in"}</button></div>
        </form>
      )}
      <p className={styles.error} role="alert">{error}</p>
    </main>
  );
}
