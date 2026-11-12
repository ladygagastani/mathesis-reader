/**
 * The masthead of the pages outside the reader (the old app's Header.tsx, without its rooms): the printer's device and the name at
 * the left, what belongs to the page at the right, and a double rule under it all, as on a title page.
 */
import Mark from "./Mark";
import styles from "./Masthead.module.css";

export default function Masthead({ children }: { children?: React.ReactNode }) {
  return (
    <header className={styles.mast}>
      <div className={`wrap ${styles.in}`}>
        <Mark />
        <div className={styles.end}>{children}</div>
      </div>
    </header>
  );
}
