"use client";
/**
 * The reader's own bar along the foot (ADR 0009, decision 5, without Study): Library, where you are, and Aa. On a computer a menu is
 * a leaf of paper rising from the bar; on a phone it is a sheet from the foot of the screen. A menu takes the focus when it opens,
 * Escape or × closes it, and the focus goes back to the button that opened it.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GREEK_SIZES, setSettings, stepSize, type Columns, type Theme } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import styles from "./FootBar.module.css";

type Open = "" | "aa" | "pages";

function Menu({ title, onClose, className, children }: { title: string; onClose: (refocus: boolean) => void; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.("[data-menu-opener]")) onClose(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-labelledby={id} tabIndex={-1} className={`${styles.menu} ${className}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } }}>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>{title}</h2>
        <button type="button" className={`icon-btn ${styles.close}`} onClick={() => onClose(true)} aria-label={`Close ${title}`}>×</button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange, unavailable }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; unavailable?: (v: T) => boolean;
}) {
  return (
    <div className={styles.field}>
      <span className="label" id={`${label}-label`}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${label}-label`}>
        {options.map(([v, name]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={unavailable?.(v)} onClick={() => onChange(v)}>{name}</button>
        ))}
      </div>
    </div>
  );
}

const THEMES: [Theme, string][] = [["auto", "Follow device"], ["paper", "Paper"], ["night", "Night"]];
const COLUMNS: [Columns, string][] = [["greek", "Greek"], ["both", "Both"], ["trans", "English"]];

/** The Greek's size as the page shows it now, in rem (for the first step from the device's own size). */
function shownRem(): number {
  const probe = document.querySelector<HTMLElement>("[data-greek-probe]");
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return probe ? parseFloat(getComputedStyle(probe).fontSize) / root : 1.25;
}

export default function FootBar({ where, at, pages, page, onPage, hasEnglish, hidden }: {
  /** the page's name ("Sections 17–22") */
  where: string;
  /** "1 of 5" */
  at: string;
  pages: string[]; page: number; onPage: (i: number) => void;
  hasEnglish: boolean;
  /** the look-up's sheet stands where the bar was */
  hidden: boolean;
}) {
  const s = useSettings();
  const [open, setOpen] = useState<Open>("");
  const aaBtn = useRef<HTMLButtonElement>(null);
  const pagesBtn = useRef<HTMLButtonElement>(null);
  // closed with ×, Escape or a choice: the focus goes back to the button that opened it (a click elsewhere keeps its own focus)
  const onClose = useCallback((refocus: boolean) => {
    setOpen((was) => {
      if (refocus) (was === "aa" ? aaBtn : pagesBtn).current?.focus();
      return "";
    });
  }, []);
  const toggle = (m: Open) => setOpen((o) => (o === m ? "" : m));
  const size = typeof s.greekSize === "number" ? `${Math.round(s.greekSize * 16)} px` : "the device's size";

  return (
    <nav className={styles.foot} aria-label="The reader" data-hidden={hidden || undefined}>
      <div className={`wrap ${styles.barIn}`}>
        <Link href="/" className={`${styles.quiet} ${styles.back}`}><span aria-hidden="true">‹</span> Library</Link>
        <button ref={pagesBtn} type="button" data-menu-opener="" className={`${styles.quiet} ${styles.where}`} aria-expanded={open === "pages"} aria-haspopup="dialog"
          onClick={() => toggle("pages")}>
          <span className="visually-hidden">Pages: </span><span className={styles.part}>{where}</span><span className="visually-hidden">, </span><span className={styles.at}>{at}</span>
        </button>
        <button ref={aaBtn} type="button" data-menu-opener="" className={`${styles.quiet} ${styles.aa}`} aria-expanded={open === "aa"} aria-haspopup="dialog"
          onClick={() => toggle("aa")} aria-label="Page and text"><span aria-hidden="true" className={styles.aaSign}>Aa</span></button>
      </div>

      {open === "pages" && (
        <Menu title="Pages" onClose={onClose} className={styles.pagesMenu}>
          <ol className={styles.pages}>
            {pages.map((name, i) => (
              <li key={i}>
                <button type="button" className={styles.pageBtn} aria-current={i === page ? "page" : undefined}
                  onClick={() => { onPage(i); onClose(false); }}>{name}</button>
              </li>
            ))}
          </ol>
        </Menu>
      )}

      {open === "aa" && (
        <Menu title="Page and text" onClose={onClose} className={styles.aaMenu}>
          <Choice label="Page" value={s.theme} options={THEMES} onChange={(theme) => setSettings({ theme })} />
          <div className={styles.field}>
            <span className="label" id="size-label">Greek size</span>
            <div className={styles.sizeRow} role="group" aria-labelledby="size-label">
              <button type="button" className="btn ghost" disabled={s.greekSize === GREEK_SIZES.min}
                onClick={() => setSettings({ greekSize: stepSize(s.greekSize, -1, shownRem()) })}>Smaller</button>
              <button type="button" className="btn ghost" disabled={s.greekSize === GREEK_SIZES.max}
                onClick={() => setSettings({ greekSize: stepSize(s.greekSize, 1, shownRem()) })}>Larger</button>
              <span className={styles.sizeNow} aria-live="polite">{size}</span>
              {s.greekSize !== "auto" && <button type="button" className="text-btn" onClick={() => setSettings({ greekSize: "auto" })}>Device size</button>}
            </div>
          </div>
          <Choice label="Columns" value={s.columns} options={COLUMNS} onChange={(columns) => setSettings({ columns })}
            unavailable={(c) => c !== "greek" && !hasEnglish} />
        </Menu>
      )}
    </nav>
  );
}
