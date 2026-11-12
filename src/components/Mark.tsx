import Link from "next/link";
import { DIAMOND, SIGMA } from "./logo.mjs";
import styles from "./Mark.module.css";

/**
 * The logo (logo.mjs): a heavy Σ on a red square turned on its corner, and beside it the name, "Μάθησις Στοιχείων" over
 * "MATHESIS STOICHEION".
 */
export default function Mark() {
  return (
    <Link className={styles.mark} href="/">
      <svg className={styles.logo} width={46} height={46} viewBox="0 0 100 100" aria-hidden="true">
        <rect className={styles.diamond} x={DIAMOND.x} y={DIAMOND.y} width={DIAMOND.size} height={DIAMOND.size} rx={DIAMOND.rx} transform={DIAMOND.transform} />
        <path className={styles.sigma} d={SIGMA.d} transform={SIGMA.transform} />
      </svg>
      {/* (its name for a screen reader is its own words: the Greek, then the Latin letters, read once, and where it leads) */}
      <span className={styles.words}>
        <b lang="grc">Μάθησις Στοιχείων</b>
        <i aria-hidden="true">Mathesis Stoicheion</i>
        <span className="visually-hidden">Mathesis Stoicheion, the library</span>
      </span>
    </Link>
  );
}
