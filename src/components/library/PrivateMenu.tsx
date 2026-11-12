"use client";
/**
 * Your private texts (SPEC.md, "Sync and private texts"): a button at the right of the masthead that opens a small floating list,
 * so the library itself opens on the works. It shows only on a device whose code opens private texts: nothing for a device
 * without a code (which never contacts Supabase) or with a code that is not the owner's. The list takes the focus when it opens;
 * Escape, × or a click elsewhere closes it, and the focus goes back to the button.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { mineHref } from "@/lib/mine/mine";
import { listPrivate, trouble, useSyncCode, type PrivateSummary } from "@/lib/sync";
import styles from "./PrivateMenu.module.css";

export default function PrivateMenu() {
  const code = useSyncCode();
  const [got, setGot] = useState<{ code?: string; list?: PrivateSummary[]; error?: string }>({});
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!code) return;
    let live = true;
    listPrivate(code).then((list) => { if (live) setGot({ code, list }); }, (e) => { if (live) setGot({ code, error: trouble(e) }); });
    return () => { live = false; };
  }, [code]);

  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => { setOpen(false); button.current?.focus(); };
  const mine = got.code === code ? got : {};
  // (a code that is not the owner's gets an empty list: no button at all)
  if (!code || (!mine.list?.length && !mine.error)) return null;

  return (
    <div className={styles.wrap}>
      <button ref={button} type="button" className={styles.opener} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <Icon name="lock" /><span className={styles.words}>Private texts</span>{mine.list && <span className={styles.count}>{mine.list.length}</span>}
      </button>
      {open && (
        <div ref={box} role="dialog" aria-labelledby={id} tabIndex={-1} className={styles.box}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
          <div className={styles.head}>
            <h2 id={id} className={styles.title}>Your private texts</h2>
            <button type="button" className={`icon-btn ${styles.x}`} onClick={close}><Icon name="close" label="Close your private texts" /></button>
          </div>
          <p className={styles.only}>Only your code opens these.</p>
          {mine.error && <p className={styles.only}>{mine.error}</p>}
          {mine.list && (
            <ul className={styles.list}>
              {mine.list.map((t) => (
                <li key={t.id}>
                  <Link className={styles.item} href={mineHref(t.id)} onClick={() => setOpen(false)}>
                    <span className={styles.name}>{t.title ?? t.id}</span>
                    {t.author && <span className={styles.by}>{t.author}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
