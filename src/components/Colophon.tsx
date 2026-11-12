/** The foot of the pages outside the reader (the old app's site footer, cut down): under a rule of ink, the name and the credits. */
import Link from "next/link";
import styles from "./Colophon.module.css";

export default function Colophon() {
  return (
    <footer className={`wrap ${styles.foot}`}>
      <p className={styles.name} lang="grc">Μάθησις Στοιχείων</p>
      <Link href="/credits" className={styles.link}>Credits and licences</Link>
    </footer>
  );
}
