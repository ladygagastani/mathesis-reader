/**
 * The site bar on every page outside the reader (DESIGN.md, "Site bar"). No logo: it stands on the start page alone (Mark.tsx).
 * On a computer: Home, Library and Reading at the left; your private texts (when your code opens them), Saved, Sync and the
 * Day/Night switch at the right. On a phone (the owner, 2026-11-14): Saved, Sync and Day/Night spaced evenly across a slim bar
 * at the top, while Home, Library and Reading stand in a bar fixed to the foot of the screen, under the thumb.
 */
import Icon from "@/components/Icon";
import PrivateMenu from "@/components/library/PrivateMenu";
import SyncLink from "@/components/sync/SyncLink";
import NavLink from "./NavLink";
import ReadingLink from "./ReadingLink";
import ThemeSwitch from "./ThemeSwitch";
import styles from "./SiteBar.module.css";

export default function SiteBar() {
  return (
    <>
      <header className={styles.bar}>
        <div className={`wrap ${styles.in}`}>
          <nav className={styles.main} aria-label="The site">
            <NavLink href="/"><Icon name="home" />Home</NavLink>
            <NavLink href="/library"><Icon name="library" />Library</NavLink>
            <ReadingLink className={styles.link} />
          </nav>
          <nav className={styles.links} aria-label="Yours">
            <PrivateMenu />
            <NavLink href="/saved"><Icon name="note" />Saved</NavLink>
            <SyncLink />
            <ThemeSwitch />
          </nav>
        </div>
      </header>
      {/* the phone's bar at the foot (hidden on a computer, where the same three stand in the bar above) */}
      <nav className={styles.foot} aria-label="The site" data-foot-bar="">
        <NavLink href="/" className={styles.tab}><Icon name="home" />Home</NavLink>
        <NavLink href="/library" className={styles.tab}><Icon name="library" />Library</NavLink>
        <ReadingLink className={styles.tab} />
      </nav>
    </>
  );
}
