/**
 * The site bar on every page outside the reader (DESIGN.md, "Site bar"): the logo and the way to the library at the left; your
 * private texts (when your code opens them), Saved, Sync and the Paper/Night switch at the right. It stays at the top of the
 * window as the page scrolls, so the library is one click away from anywhere.
 */
import Icon from "@/components/Icon";
import Mark from "@/components/Mark";
import PrivateMenu from "@/components/library/PrivateMenu";
import SyncLink from "@/components/sync/SyncLink";
import NavLink from "./NavLink";
import ThemeSwitch from "./ThemeSwitch";
import styles from "./SiteBar.module.css";

export default function SiteBar() {
  return (
    <header className={styles.bar}>
      <div className={`wrap ${styles.in}`}>
        <Mark />
        <nav className={styles.main} aria-label="The site">
          <NavLink href="/"><Icon name="library" />Library</NavLink>
        </nav>
        <nav className={styles.links} aria-label="Yours">
          <PrivateMenu />
          <NavLink href="/saved"><Icon name="note" />Saved</NavLink>
          <SyncLink />
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
}
