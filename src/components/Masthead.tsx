/**
 * The masthead of the pages outside the reader (the old app's Header.tsx, without its rooms): the printer's device and the name at
 * the left, the way to sync at the right, and a double rule under it all, as on a title page.
 */
import SyncLink from "./sync/SyncLink";
import Mark from "./Mark";
import styles from "./Masthead.module.css";

export default function Masthead() {
  return (
    <header className={styles.mast}>
      <div className={`wrap ${styles.in}`}>
        <Mark />
        <SyncLink />
      </div>
    </header>
  );
}
