"use client";
/**
 * Syncing a device (SPEC.md, "Sync and private texts"): no email and no password, only a sync code made in the database and typed
 * here once. The device keeps it; "Forget" takes it off again. After syncing the page goes back to where it was asked from
 * (?next=/read?w=mine:…), or to the library.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { parseSyncCode, showSyncCode } from "@/lib/sync-code";
import { forgetCode, syncDevice, trouble, useSyncCode } from "@/lib/sync";
import styles from "./Sync.module.css";

export default function Sync() {
  const code = useSyncCode();
  const router = useRouter();
  const asked = useSearchParams().get("next");
  const next = asked && asked.startsWith("/") && !asked.startsWith("//") ? asked : "/";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = parseSyncCode(String(new FormData(e.currentTarget).get("code")));
    if (!typed) { setError("A sync code is 20 letters and digits, as XXXX-XXXX-XXXX-XXXX-XXXX."); return; }
    setBusy(true); setError("");
    try { await syncDevice(typed); router.push(next); }
    catch (err) { setError(trouble(err)); setBusy(false); }
  };
  const forget = () => { setError(""); forgetCode(); };

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>Sync</h1>
        <p className={styles.purpose}>
          A sync code opens your private texts on this device. There is no account, no email and no password: the code is the only
          key, so keep it to yourself.
        </p>
      </header>
      {code === undefined && <p className="muted" aria-busy="true">Checking this device…</p>}
      {code && (
        <div className={styles.box}>
          <p>This device is synced. Your private texts are at the top of the library.</p>
          <details className={styles.reveal}>
            <summary>Show the code, to type on another device</summary>
            <p className={styles.code}>{showSyncCode(code)}</p>
          </details>
          <div className={styles.row}>
            <Link className="btn" href={next}>Go to the library<Icon name="next" /></Link>
            <button type="button" className="btn ghost" onClick={forget}>Forget the code on this device</button>
          </div>
        </div>
      )}
      {code === null && (
        <form className={styles.box} onSubmit={submit} noValidate>
          <label className={styles.field}>
            <span className="label">Sync code</span>
            <input name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required />
          </label>
          <div className={styles.row}><button type="submit" className="btn" disabled={busy}><Icon name="sync" />{busy ? "Syncing…" : "Sync this device"}</button></div>
          <p className="muted">A code is made once, in the database, and works on every device you type it on.</p>
        </form>
      )}
      <p className={styles.error} role="alert">{error}</p>
    </main>
  );
}
