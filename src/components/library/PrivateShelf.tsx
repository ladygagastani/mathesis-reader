"use client";
/**
 * The owner's private texts, at the top of the library once signed in (SPEC.md, "Sign-in and private texts"). Nothing shows for
 * anyone else, and the database gives them nothing: only the owner can read the table private_translations.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { listPrivate, trouble, useAccount, type PrivateSummary } from "@/lib/account";
import { mineHref } from "@/lib/mine/mine";
import styles from "./Library.module.css";

export default function PrivateShelf() {
  const { email } = useAccount();
  const [got, setGot] = useState<{ list?: PrivateSummary[]; error?: string }>({});
  useEffect(() => {
    if (!email) return;
    let live = true;
    listPrivate().then((list) => { if (live) setGot({ list }); }, (e) => { if (live) setGot({ error: trouble(e) }); });
    return () => { live = false; };
  }, [email]);
  if (!email) return null;

  return (
    <section className={styles.private} aria-labelledby="private-texts">
      <div className={styles.partHead}>
        <h2 id="private-texts" className={styles.partName}>Your private texts</h2>
        <span className={styles.partCount}><Icon name="lock" /> Only you can see these</span>
      </div>
      {!got.list && !got.error && <p className="muted" aria-busy="true">Opening your texts…</p>}
      {got.error && <p className={styles.status}>{got.error}</p>}
      {got.list && !got.list.length && <p className={styles.status}>You have no private texts in this account.</p>}
      {got.list && got.list.length > 0 && (
        <ul className={styles.shelves}>
          {got.list.map((t) => (
            <li key={t.id} className={styles.shelf}>
              <Link className={styles.row} href={mineHref(t.id)}>
                <span className={styles.who}>
                  <span className={styles.name}>{t.title ?? t.id}</span>
                  <span className={styles.desc}>{[t.author, t.status].filter(Boolean).join(" · ")}</span>
                </span>
                <Icon name="next" className={styles.go} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
