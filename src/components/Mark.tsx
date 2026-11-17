import { DIAMOND, SIGMA } from "./logo.mjs";
import styles from "./Mark.module.css";

/**
 * The logo (logo.mjs): a heavy Σ on a terracotta square turned on its corner, and beside it the name, "Μάθησις Στοιχείων" over
 * "MATHESIS STOICHEION". It stands on the start page alone, as its masthead (the owner, 2026-11-14: "the logo should only be on
 * the homepage"); the site bar carries no logo.
 */
export default function Mark() {
  return (
    <span className={styles.mark}>
      <svg className={styles.logo} viewBox="0 0 100 100" aria-hidden="true">
        <rect className={styles.diamond} x={DIAMOND.x} y={DIAMOND.y} width={DIAMOND.size} height={DIAMOND.size} rx={DIAMOND.rx} transform={DIAMOND.transform} />
        <path className={styles.sigma} d={SIGMA.d} transform={SIGMA.transform} />
      </svg>
      {/* (its name for a screen reader is its own words: the Greek, then the Latin letters, read once) */}
      <span className={styles.words}>
        <b lang="grc">Μάθησις Στοιχείων</b>
        <i aria-hidden="true">Mathesis Stoicheion</i>
        <span className="visually-hidden">Mathesis Stoicheion</span>
      </span>
    </span>
  );
}
