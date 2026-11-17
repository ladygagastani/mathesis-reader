"use client";
/** A link in the site bar, marked as the current page (in ink, with a red rule under it) when it is the page you are on. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteBar.module.css";

export default function NavLink({ href, className = styles.link, children }: { href: string; className?: string; children: React.ReactNode }) {
  const here = usePathname() === href;
  return <Link className={className} href={href} aria-current={here ? "page" : undefined}>{children}</Link>;
}
