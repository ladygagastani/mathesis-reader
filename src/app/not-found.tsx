import Link from "next/link";
import Colophon from "@/components/Colophon";
import Icon from "@/components/Icon";
import SiteBar from "@/components/site/SiteBar";
import styles from "./not-found.module.css";

export const metadata = { title: "Not here", robots: { index: false } };

/**
 * An address that leads nowhere (DESIGN.md, "Not found"): what happened in one line, a search that goes to the library (a plain
 * form, so it works before the page's scripts arrive), and the way to the library.
 */
export default function NotFound() {
  return (
    <>
      <SiteBar />
      <main id="main" className={`wrap ${styles.page}`}>
        <h1 className={styles.title}>This page is not here</h1>
        <p className={styles.what}>The address may be mistyped, or the page may have moved. Search the library for the book you wanted.</p>
        <form className={styles.find} action="/" method="get" role="search">
          <label className={styles.field}>
            <span className="label">Search the library</span>
            <input type="search" name="q" placeholder="an author or a title, in English or Greek" autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="btn"><Icon name="search" />Search</button>
        </form>
        <p><Link className="btn ghost" href="/"><Icon name="library" />Go to the library</Link></p>
      </main>
      <Colophon />
    </>
  );
}
