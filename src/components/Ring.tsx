"use client";
/**
 * The ring of tongues (DESIGN.md, "Ornament"), drawn round whatever it holds: the book's title on its title page, and the
 * dictionary form in the look-up. It measures its own box and draws, from the outside in, a hairline, a band of tongues in
 * two strengths of terracotta, a hairline and (for the title) a ring of dots. A square box gets circles, a wider one
 * stadiums, so a long word is ringed, never shrunk. The count of tongues is always whole and even, so the two strengths
 * alternate all the way round without a seam. Ornament only: hidden from screen readers.
 */
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./Ring.module.css";

type Kind = "title" | "word";
const SPEC: Record<Kind, { band: number; period: number; gap: number; dots: boolean }> = {
  // band: the tongues' length; period: one tongue and its space, along the band's middle line; gap: hairline to tongues
  title: { band: 20, period: 13, gap: 6, dots: true },
  word: { band: 9, period: 7, gap: 4, dots: false },
};

/** A stadium (or circle) inset d from a w × h box, as an SVG rect's attributes. */
const shape = (w: number, h: number, d: number) => {
  const width = Math.max(0, w - 2 * d), height = Math.max(0, h - 2 * d);
  return { x: d, y: d, width, height, rx: Math.min(width, height) / 2 };
};
/** The length round a stadium of that size. */
const around = (width: number, height: number) => {
  const r = Math.min(width, height) / 2;
  return 2 * (Math.max(width, height) - 2 * r) + 2 * Math.PI * r;
};

export default function Ring({ kind, className, children }: { kind: Kind; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      setSize((s) => (s && s[0] === w && s[1] === h ? s : [w, h]));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spec = SPEC[kind];
  let art: React.ReactNode = null;
  if (size && size[0] > 0 && size[1] > 0) {
    const [w, h] = size;
    const mid = 1 + spec.gap + spec.band / 2;            // the band's middle line, from the outer edge
    const band = shape(w, h, mid);
    // a whole, even number of tongues round the band's middle line
    const n = Math.max(8, 2 * Math.round(around(band.width, band.height) / (2 * spec.period)));
    const dash = { pathLength: n, strokeWidth: spec.band, strokeDasharray: "0.58 1.42", fill: "none" };
    art = (
      <svg className={styles.art} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" data-shape={w === h ? "circle" : "pill"}>
        <rect {...shape(w, h, 0.5)} className={styles.hair} />
        <rect {...band} {...dash} className={styles.tongue} />
        <rect {...band} {...dash} strokeDashoffset={-1} className={`${styles.tongue} ${styles.faint}`} />
        <rect {...shape(w, h, 2 * mid - 0.5)} className={styles.hair} />
        {spec.dots && <rect {...shape(w, h, 2 * mid + 7)} pathLength={2 * n} strokeDasharray="0.001 2" className={styles.dots} />}
      </svg>
    );
  }
  return (
    <span ref={box} className={`${styles.ring} ${className ?? ""}`} data-kind={kind}>
      {art}
      <span className={styles.inner}>{children}</span>
    </span>
  );
}
