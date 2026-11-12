import Link from "next/link";
import styles from "./Mark.module.css";

/**
 * The printer's device (the old app's components/a/Mark.tsx; ADR 0008, decision 1): a round seal like the marks early printers
 * set on their title pages, ΜΣ in the middle (Μ in ink, Σ in red), and beside it the name, "Μάθησις Στοιχείων" over
 * "MATHESIS STOICHEION". At this size the old seal leaves out the words round its ring, so they are not drawn here.
 */
export default function Mark() {
  return (
    <Link className={styles.mark} href="/">
      <svg className={styles.seal} width={46} height={46} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text x="50" y="51" textAnchor="middle" dominantBaseline="central" className={styles.initials} fontSize={38} letterSpacing={-1.5}>
          Μ<tspan className={styles.red}>Σ</tspan>
        </text>
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
