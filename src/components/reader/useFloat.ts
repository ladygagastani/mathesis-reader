"use client";
/**
 * Floats a panel (the look-up, the note editor) by the words it is about (lib/lookup/placement.ts, floatAt). The panel is placed
 * in the page, not the window, so it scrolls with its word. It is placed again as its content arrives or changes, and when the
 * window changes size. It opens on the side a whole card has room on (floatAt), so it does not jump sides as its words arrive.
 */
import { useLayoutEffect, type RefObject } from "react";
import { FLOAT, floatAt, type Box } from "@/lib/lookup/placement";

export function useFloat(ref: RefObject<HTMLElement | null>, anchor: HTMLElement | null, on: boolean) {
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!on || !panel || !anchor) return;
    let side: "below" | "above" | null = null;
    let busy = false;
    const place = () => {
      if (busy || !anchor.isConnected) return;
      busy = true;
      const bar = document.querySelector("[data-reader-bar]")?.getBoundingClientRect().bottom ?? 0;
      let r = anchor.getBoundingClientRect();
      // a word out of sight (Previous and Next walk past the screen's edge) is brought a third of the way down the screen first
      if (side === null && (r.top < Math.max(0, bar) + FLOAT.edge || r.bottom > innerHeight - FLOAT.edge)) {
        window.scrollBy({ top: r.top - (Math.max(0, bar) + (innerHeight - Math.max(0, bar)) / 3), behavior: "instant" });
        r = anchor.getBoundingClientRect();
      }
      const word: Box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      // how tall the panel would be with no limit
      panel.style.maxHeight = "none";
      const height = panel.getBoundingClientRect().height;
      const f = floatAt(word, height, { width: document.documentElement.clientWidth, height: innerHeight, top: Math.max(0, bar) });
      side = f.side;
      // the page's coordinates, from the panel's containing box as it stands before any scroll (f.top is after it)
      const base = (panel.offsetParent ?? document.body).getBoundingClientRect();
      panel.style.top = `${f.top + f.scroll - base.top}px`;
      panel.style.left = `${f.left - base.left}px`;
      panel.style.width = `${f.width}px`;
      panel.style.maxHeight = `${f.maxHeight}px`;
      panel.dataset.side = f.side;
      if (f.scroll) window.scrollBy({ top: f.scroll, behavior: "instant" });
      busy = false;
    };
    place();
    const size = new ResizeObserver(place);
    size.observe(panel);
    const content = new MutationObserver(place);
    content.observe(panel, { childList: true, subtree: true, characterData: true });
    addEventListener("resize", place);
    return () => { size.disconnect(); content.disconnect(); removeEventListener("resize", place); };
  }, [ref, anchor, on]);
}
