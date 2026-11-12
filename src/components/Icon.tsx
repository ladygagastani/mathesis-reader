// The old app's one set of icons (its web/src/components/Icon.tsx), with only the signs this app uses (owner, 2026-10-30: "give each an icon", one meaning each). Every icon is named for what it
// means, not for its shape, so a button that does the same thing anywhere on the site wears the same sign. Drawn as on the
// printed page: a fine line in the colour of the words beside it (24 by 24, stroke 1.6, round ends, no fill), 1.2em by
// default, hidden from screen readers unless given a label (the button's own words say what it does).
//   <Icon name="search" />               beside words: the words name the action
//   <Icon name="close" label="Close" />  alone: the label names it
// Every svg carries data-icon, so a check can find which buttons have one.
//
// The drawings are Lucide's (https://lucide.dev). Lucide's licence:
// ISC License. Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other
// copyright (c) for Lucide are held by Lucide Contributors 2022.
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
// granted, provided that the above copyright notice and this permission notice appear in all copies.
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.
// (Written by a script from Lucide 0.460.0's drawings; to add one, copy its line from the old app's Icon.tsx.)
import { createElement, type CSSProperties, type SVGProps } from "react";

type Drawing = [string, Record<string, string>][];
const ICONS = {
  // go back, or back to the page this one belongs to (Lucide "arrow-left")
  "back": [["path", {d: "m12 19-7-7 7-7"}], ["path", {d: "M19 12H5"}]],
  // go on: to the next step, or to the page a link names (Lucide "arrow-right")
  "next": [["path", {d: "M5 12h14"}], ["path", {d: "m12 5 7 7-7 7"}]],
  // opens what is folded under it (Lucide "chevron-down")
  "chevron-down": [["path", {d: "m6 9 6 6 6-6"}]],
  // folds it away again (Lucide "chevron-up")
  "chevron-up": [["path", {d: "m18 15-6-6-6 6"}]],
  // the one before (Lucide "chevron-left")
  "chevron-left": [["path", {d: "m15 18-6-6 6-6"}]],
  // the one after (Lucide "chevron-right")
  "chevron-right": [["path", {d: "m9 18 6-6-6-6"}]],
  // closes this panel or window (Lucide "x")
  "close": [["path", {d: "M18 6 6 18"}], ["path", {d: "m6 6 12 12"}]],
  // where you are in a text; go to another part of it (Lucide "table-of-contents")
  "goto": [["path", {d: "M16 12H3"}], ["path", {d: "M16 18H3"}], ["path", {d: "M16 6H3"}], ["path", {d: "M21 12h.01"}], ["path", {d: "M21 18h.01"}], ["path", {d: "M21 6h.01"}]],
  // about this (Lucide "info")
  "info": [["circle", {cx: "12", cy: "12", r: "10"}], ["path", {d: "M12 16v-4"}], ["path", {d: "M12 8h.01"}]],
  // the size of the letters (Lucide "a-large-small")
  "text-size": [["path", {d: "M21 14h-5"}], ["path", {d: "M16 16v-3.5a2.5 2.5 0 0 1 5 0V16"}], ["path", {d: "M4.5 13h6"}], ["path", {d: "m3 16 4.5-9 4.5 9"}]],
  // private: only you can open it (Lucide "lock")
  "lock": [["rect", {width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2"}], ["path", {d: "M7 11V7a5 5 0 0 1 10 0v4"}]],
  // search (Lucide "search")
  "search": [["circle", {cx: "11", cy: "11", r: "8"}], ["path", {d: "m21 21-4.3-4.3"}]],
  // copy to the clipboard (Lucide "copy")
  "copy": [["rect", {width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2"}], ["path", {d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],
  // save to your files (Lucide "download")
  "download": [["path", {d: "M12 15V3"}], ["path", {d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}], ["path", {d: "m7 10 5 5 5-5"}]],
  // a note (Lucide "notebook-pen")
  "note": [["path", {d: "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"}], ["path", {d: "M2 6h4"}], ["path", {d: "M2 10h4"}], ["path", {d: "M2 14h4"}], ["path", {d: "M2 18h4"}], ["path", {d: "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"}]],
  // sync this device (Lucide "refresh-cw")
  "sync": [["path", {d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}], ["path", {d: "M21 3v5h-5"}], ["path", {d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}], ["path", {d: "M8 16H3v5"}]],
  // a word kept for later (Lucide "bookmark")
  "keep": [["path", {d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"}]],
  // the library (Lucide "library")
  "library": [["path", {d: "m16 6 4 14"}], ["path", {d: "M12 6v14"}], ["path", {d: "M8 8v12"}], ["path", {d: "M4 4v16"}]],
  // the paper page (Lucide "sun")
  "paper": [["circle", {cx: "12", cy: "12", r: "4"}], ["path", {d: "M12 2v2"}], ["path", {d: "M12 20v2"}], ["path", {d: "m4.93 4.93 1.41 1.41"}], ["path", {d: "m17.66 17.66 1.41 1.41"}], ["path", {d: "M2 12h2"}], ["path", {d: "M20 12h2"}], ["path", {d: "m6.34 17.66-1.41 1.41"}], ["path", {d: "m19.07 4.93-1.41 1.41"}]],
  // the night page (Lucide "moon")
  "night": [["path", {d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}]],
  // the keys of the keyboard (Lucide "keyboard")
  "keys": [["rect", {width: "20", height: "16", x: "2", y: "4", rx: "2"}], ["path", {d: "M6 8h.01"}], ["path", {d: "M10 8h.01"}], ["path", {d: "M14 8h.01"}], ["path", {d: "M18 8h.01"}], ["path", {d: "M8 12h.01"}], ["path", {d: "M12 12h.01"}], ["path", {d: "M16 12h.01"}], ["path", {d: "M7 16h10"}]],
  // opens on another site (Lucide "external-link")
  "outside": [["path", {d: "M15 3h6v6"}], ["path", {d: "M10 14 21 3"}], ["path", {d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]],
} satisfies Record<string, Drawing>;

export type IconName = keyof typeof ICONS;

const SIT: CSSProperties = { flex: "none", verticalAlign: "-0.22em" };   // on the line of the words beside it

export default function Icon({ name, label, style, ...rest }: { name: IconName; label?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" focusable="false" data-icon={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} style={style ? { ...SIT, ...style } : SIT} {...rest}>
      {(ICONS[name] as Drawing).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
