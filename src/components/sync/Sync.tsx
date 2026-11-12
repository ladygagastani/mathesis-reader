"use client";
/**
 * Syncing a device (SPEC.md, "Sync"): no email and no password. "Make a new code" asks the database for a code of your own, which
 * starts empty; "I have a code" takes one made before. The device keeps the code, and your notes go with it to every device you type
 * it on. Every button says, under it, what it does. The code can be copied, saved to your files as a small text file, or kept in a
 * password manager (1Password and the like): its fields are marked as a password with a fixed user name, so the manager offers to
 * keep a new code and fills a kept one. The code is shown once, in letters; the password field that carries it for a manager is not
 * shown, so the page never seems to give two codes. "Forget" takes the code and its notes off this device.
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

/** A button and, under it, what it does. */
function Action({ what, children }: { what: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.action}>
      {children}
      <p className={styles.what}>{what}</p>
    </div>
  );
}

/** Copy the code, and Save to your files: the two ways to keep it that need no password manager. */
function KeepIt({ code, said, onCopy }: { code: SyncCode; said: string; onCopy: () => void }) {
  return (
    <>
      <Action what="Puts the code on your clipboard, to paste into a password manager, a note or a message to yourself.">
        <button type="button" className="btn ghost" onClick={onCopy}><Icon name="copy" />Copy the code</button>
      </Action>
      <Action what="Downloads a small text file, mathesis-sync-code.txt, with the code in it.">
        <button type="button" className="btn ghost" onClick={() => saveToFiles(code)}><Icon name="download" />Save to your files</button>
      </Action>
      <p className={styles.said} aria-live="polite">{said}</p>
    </>
  );
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
  const [said, setSaid] = useState("");

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
  const forget = () => run(async () => { await forgetNotes(); forgetCode(); setMade(false); setSaid(""); });
  const copy = (c: SyncCode) => navigator.clipboard.writeText(showSyncCode(c)).then(
    () => setSaid("Copied. Paste it where you keep it."),
    () => setSaid("This browser would not copy it. Select the code above and copy it, or use Save to your files."),
  );

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      {/* what sync is, at the left; what to do, at the right (DESIGN.md, "Sync") */}
      <div className={styles.about}>
        <header className={`${styles.head} enter`}>
          <h1 className={styles.title}>Sync</h1>
          <p className={styles.purpose}>
            Sync keeps your notes the same on your phone, your computer and any other device. There is no account, no email and no
            password. A sync code of 20 letters and digits is the key, and whoever has it can read your notes.
          </p>
        </header>
        {code === null && (
          <section className={styles.box} aria-labelledby="how">
            <h2 id="how" className={styles.part}>How it works</h2>
            <ol className={styles.steps}>
              <li>On one device, make a code.</li>
              <li>Keep it somewhere safe: in a password manager such as 1Password, in a file, or on paper.</li>
              <li>On each other device, type the code under &ldquo;I have a code&rdquo;. Your notes appear there too.</li>
            </ol>
          </section>
        )}
      </div>

      <div className={styles.doing}>
      {code === undefined && <p className="muted" aria-busy="true">Checking this device…</p>}

      {code === null && (
        <>
          <form className={styles.box} onSubmit={submit} noValidate aria-labelledby="have-code">
            <h2 id="have-code" className={styles.part}>I have a code</h2>
            <User />
            <label className={styles.field}>
              <span className="label">Sync code</span>
              <input name="password" type={see ? "text" : "password"} autoComplete="current-password" autoCapitalize="characters" spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required />
            </label>
            <p className={styles.what}>Saved the code in 1Password or your browser? It can fill it in here. Capitals, spaces and dashes do not matter.</p>
            <Action what="Checks the code, then brings its notes to this device and sends this device's notes to it.">
              <button type="submit" className="btn ghost" disabled={busy}>{busy ? "Syncing…" : "Sync this device"}</button>
            </Action>
            <Action what="Shows the letters you type instead of dots, to check them.">
              <button type="button" className="text-btn" aria-pressed={see} onClick={() => setSee(!see)}>{see ? "Hide the letters" : "Show the letters"}</button>
            </Action>
          </form>
          <section className={styles.box} aria-labelledby="new-code">
            <h2 id="new-code" className={styles.part}>New here</h2>
            <Action what="Gets a new, empty code from the database and syncs this device with it. Notes you already made here go with it.">
              <button type="button" className="btn" onClick={make} disabled={busy}><Icon name="sync" />{busy ? "Making it…" : "Make a new code"}</button>
            </Action>
          </section>
        </>
      )}

      {code && made && (
        // a form with a new password, sent by "Done": the moment a password manager offers to keep it
        <form className={styles.box} onSubmit={(e) => { e.preventDefault(); router.push(next); }} aria-labelledby="your-code">
          <h2 id="your-code" className={styles.part}>Your new code</h2>
          <p>Save it now. Nobody can show it to you again, and without it your notes cannot come back to another device.</p>
          <p className={styles.code}>{showSyncCode(code)}</p>
          <KeepIt code={code} said={said} onCopy={() => copy(code)} />
          {/* (a password manager keeps only what a form sends as a password: the same code, in fields nobody needs to see) */}
          <User />
          <input className="visually-hidden" type="password" name="password" autoComplete="new-password" value={showSyncCode(code)} readOnly tabIndex={-1} aria-hidden="true" />
          <Action what="Takes you to the library. This device stays synced. If you use 1Password or your browser's password saving, it may offer to keep the code now; if it does not, use Copy the code.">
            <button type="submit" className="btn">Done<Icon name="next" /></button>
          </Action>
        </form>
      )}

      {code && !made && (
        <>
          <section className={styles.box} aria-labelledby="synced">
            <h2 id="synced" className={styles.part}>This device is synced</h2>
            <p>Your notes go to the database under your code, and come back from it, whenever you open a book or change a note.</p>
            <details className={styles.reveal}>
              <summary>Show the code</summary>
              <p className={styles.code}>{showSyncCode(code)}</p>
            </details>
            <KeepIt code={code} said={said} onCopy={() => copy(code)} />
            <Action what="Back to your books.">
              <Link className="btn" href={next}>Go to the library<Icon name="next" /></Link>
            </Action>
          </section>
          <section className={styles.box} aria-labelledby="stop">
            <h2 id="stop" className={styles.part}>Stop syncing here</h2>
            <Action what="Takes the code and its notes off this device. They stay with the code: type it again to bring them back. Use it before you give the device to someone else.">
              <button type="button" className="btn ghost" onClick={forget} disabled={busy}>Forget the code on this device</button>
            </Action>
          </section>
        </>
      )}

      <p className={styles.error} role="alert">{error}</p>
      </div>
    </main>
  );
}
