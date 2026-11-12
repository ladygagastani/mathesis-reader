"use client";
/**
 * The owner's private texts, at the top of the library on a synced device (SPEC.md, "Sync and private texts"). Nothing shows for
 * a device without a sync code, and the database gives nothing for a code it does not know.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { listPrivate, trouble, useSyncCode, type PrivateSummary } from "@/lib/sync";
import { mineHref } from "@/lib/mine/mine";
import styles from "./Library.module.css";

export default function PrivateShelf() {
  const code = useSyncCode();
  const [got, setGot] = useState<{ list?: PrivateSummary[]; error?: string }>({});
  useEffect(() => {
    if (!code) return;
    let live = true;
    listPrivate(code).then((list) => { if (live) setGot({ list }); }, (e) => { if (live) setGot({ error: trouble(e) }); });
    return () => { live = false; };
  }, [code]);
  if (!code) return null;

  return (
    <section className={styles.private} aria-labelledby="private-texts">
      <div className={styles.partHead}>
        <h2 id="private-texts" className={styles.partName}>Your private texts</h2>
        <span className={styles.partCount}><Icon name="lock" /> Only synced devices see these</span>
      </div>
      {!got.list && !got.error && <p className="muted" aria-busy="true">Opening your texts…</p>}
      {got.error && <p className={styles.status}>{got.error}</p>}
      {got.list && !got.list.length && <p className={styles.status}>There are no private texts yet.</p>}
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
