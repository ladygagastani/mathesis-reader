"use client";
/**
 * Paper or Night from any page (DESIGN.md, decision 4): one button that turns the page you see now into the other one. It names the
 * page it will give you, with its sign. A page that follows the device turns into the other one for good; Text in the reader
 * still offers "Follow device".
 */
import { useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import { setSettings } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import styles from "./SiteBar.module.css";

const DARK = "(prefers-color-scheme: dark)";
const watchDark = (l: () => void) => { const m = matchMedia(DARK); m.addEventListener("change", l); return () => m.removeEventListener("change", l); };

export default function ThemeSwitch() {
  const { theme } = useSettings();
  // (null before the page is running: the device's choice is not known on the server)
  const dark = useSyncExternalStore(watchDark, () => matchMedia(DARK).matches, () => null);
  if (dark === null) return <span className={styles.themeSpace} aria-hidden="true" />;
  const night = theme === "night" || (theme === "auto" && dark);
  const to = night ? "paper" : "night";
  return (
    <button type="button" className={styles.link} onClick={() => setSettings({ theme: to })} aria-label={night ? "Switch to the paper page" : "Switch to the night page"}>
      <Icon name={to} />{night ? "Paper" : "Night"}
    </button>
  );
}
