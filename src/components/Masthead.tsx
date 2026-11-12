/**
 * The masthead of the pages outside the reader (the old app's Header.tsx, without its rooms): the logo and the name at
 * the left, your private texts (when your code opens them), Saved and the way to sync at the right, and a double rule under it all, as on a title page.
 */
import Link from "next/link";
import Icon from "./Icon";
import PrivateMenu from "./library/PrivateMenu";
import SyncLink from "./sync/SyncLink";
import Mark from "./Mark";
import styles from "./Masthead.module.css";
import sync from "./sync/Sync.module.css";

export default function Masthead() {
  return (
    <header className={styles.mast}>
      <div className={`wrap ${styles.in}`}>
        <Mark />
        <nav className={styles.links} aria-label="Yours">
          <PrivateMenu />
          <Link className={sync.link} href="/saved"><Icon name="note" />Saved</Link>
          <SyncLink />
        </nav>
      </div>
    </header>
  );
}
