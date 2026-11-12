"use client";
/**
 * Syncing a device (SPEC.md, "Sync"): no email and no password. "Make a new code" asks the database for a code of your own, which
 * starts empty; "I have a code" takes one made before. The device keeps the code, and your notes go with it to every device you type
 * it on. The code can be saved to your files, as a small text file, or in a password manager (1Password and the like): its fields
 * are marked as a password with a fixed user name, so the manager offers to keep a new code and fills a kept one. "Forget" takes the
 * code and its notes off this device.
 * After typing a code the page goes back to where it was asked from (?next=/read?w=mine:…), or to the library.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { forgetNotes, syncNotes } from "@/lib/notes/store";
import { parseSyncCode, showSyncCode, type SyncCode } from "@/lib/sync-code";
import { forgetCode, makeCode, syncDevice, trouble, useSyncCode } from "@/lib/sync";
import styles from "./Sync.module.css";

/** The user name a password manager files the code under: the same on every device, so it finds the code it kept. */
const USER = "Mathesis Reader sync code";
const User = () => <input className="visually-hidden" type="text" name="username" autoComplete="username" value={USER} readOnly tabIndex={-1} aria-hidden="true" />;

/** The code as a small text file in the device's downloads. */
function saveToFiles(code: SyncCode) {
  const text = [
    "Mathesis Reader sync code",
    "",
    showSyncCode(code),
    "",
    "Type it under Sync on another device to bring your notes there.",
    "Anyone who has this code can read your notes, so keep it private.",
    "",
  ].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([text], { type: "text/plain" })), download: "mathesis-sync-code.txt",
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Sync() {
  const code = useSyncCode();
  const router = useRouter();
  const asked = useSearchParams().get("next");
  const next = asked && asked.startsWith("/") && !asked.startsWith("//") ? asked : "/";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState(false);
  const [see, setSee] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await work(); } catch (err) { setError(trouble(err)); } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = parseSyncCode(String(new FormData(e.currentTarget).get("password")));
    if (!typed) { setError("A sync code is 20 letters and digits, as XXXX-XXXX-XXXX-XXXX-XXXX."); return; }
    void run(async () => { await syncDevice(typed); void syncNotes(); router.push(next); });
  };
  const make = () => run(async () => { await makeCode(); setMade(true); void syncNotes(); });
  const forget = () => run(async () => { await forgetNotes(); forgetCode(); setMade(false); });

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>Sync</h1>
        <p className={styles.purpose}>
          A sync code carries your notes to every device you type it on. There is no account, no email and no password. The code is
          the only key, so keep it to yourself.
        </p>
      </header>
      {code === undefined && <p className="muted" aria-busy="true">Checking this device…</p>}
      {code && made && (
        // a form with a new password, sent by "Done": the moment a password manager offers to keep it
        <form className={styles.box} onSubmit={(e) => { e.preventDefault(); router.push(next); }}>
          <p>Your new code. Save it now: nobody can show it to you again if it is lost. 1Password and other password managers offer to keep it when you press Done.</p>
          <User />
          <p className={styles.code}>{showSyncCode(code)}</p>
          {/* (a password manager keeps only what is in a password field: the same code, in dots) */}
          <label className={styles.field}>
            <span className="label">The code, for your password manager</span>
            <input type="password" name="password" autoComplete="new-password" value={showSyncCode(code)} readOnly />
          </label>
          <div className={styles.row}>
            <button type="button" className="btn ghost" onClick={() => saveToFiles(code)}><Icon name="download" />Save to your files</button>
            <button type="submit" className="btn">Done<Icon name="next" /></button>
          </div>
        </form>
      )}
      {code && !made && (
        <div className={styles.box}>
          <p>This device is synced. Your notes go with this code.</p>
          <details className={styles.reveal}>
            <summary>Show the code</summary>
            <p className={styles.code}>{showSyncCode(code)}</p>
          </details>
          <div className={styles.row}>
            <button type="button" className="btn ghost" onClick={() => saveToFiles(code)}><Icon name="download" />Save to your files</button>
            <Link className="btn" href={next}>Go to the library<Icon name="next" /></Link>
          </div>
          <div className={styles.row}>
            <button type="button" className="text-btn" onClick={forget} disabled={busy}>Forget the code on this device</button>
          </div>
          <p className="muted">Forgetting takes the code and its notes off this device. They stay with the code, for when you type it again.</p>
        </div>
      )}
      {code === null && (
        <>
          <section className={styles.box} aria-labelledby="new-code">
            <h2 id="new-code" className={styles.part}>A new code</h2>
            <p>The database makes a code of 20 random letters and digits. It starts empty, and holds the notes you make with it.</p>
            <div className={styles.row}><button type="button" className="btn" onClick={make} disabled={busy}><Icon name="sync" />{busy ? "Making it…" : "Make a new code"}</button></div>
          </section>
          <form className={styles.box} onSubmit={submit} noValidate aria-labelledby="have-code">
            <h2 id="have-code" className={styles.part}>I have a code</h2>
            <User />
            <label className={styles.field}>
              <span className="label">Sync code</span>
              <input name="password" type={see ? "text" : "password"} autoComplete="current-password" autoCapitalize="characters" spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required />
            </label>
            <div className={styles.row}>
              <button type="submit" className="btn ghost" disabled={busy}>{busy ? "Syncing…" : "Sync this device"}</button>
              <button type="button" className="text-btn" aria-pressed={see} onClick={() => setSee(!see)}>{see ? "Hide the letters" : "Show the letters"}</button>
            </div>
            <p className="muted">Kept the code in 1Password or another password manager? It can fill it here.</p>
          </form>
        </>
      )}
      <p className={styles.error} role="alert">{error}</p>
    </main>
  );
}
