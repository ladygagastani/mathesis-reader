"use client";
/**
 * "/" (or Ctrl+K, ⌘K on a Mac) on any page searches the library (the old site's key): in the library it puts the keyboard in the
 * search; anywhere else it opens the library with the keyboard in the search. Not while you type in a field.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Set for the library's next opening: put the keyboard in the search. */
export const FIND_KEY = "mathesis-reader:find";

export default function SlashSearch() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey;
      if (e.defaultPrevented || !(k || (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey))) return;
      const t = e.target as HTMLElement;
      if (!k && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      const field = document.querySelector<HTMLInputElement>("main search input[type=search]");
      if (path === "/" && field) { field.focus(); field.select(); return; }
      try { sessionStorage.setItem(FIND_KEY, "1"); } catch { /* storage blocked: the library opens all the same */ }
      router.push("/");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [path, router]);
  return null;
}
