"use client";
/** A link in the site bar, marked as the current page (in ink, with a red rule under it) when it is the page you are on. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteBar.module.css";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const here = usePathname() === href;
  return <Link className={styles.link} href={href} aria-current={here ? "page" : undefined}>{children}</Link>;
}
