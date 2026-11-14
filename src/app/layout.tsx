import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Literata, Noto_Serif_Display } from "next/font/google";
import { BOOT_SCRIPT, THEME_COLOURS } from "@/lib/settings";
import SlashSearch from "@/components/site/SlashSearch";
import "./globals.css";

// The three typefaces of Tondo (DESIGN.md), downloaded at build time and served from this app: Literata for the Greek and the
// English read, Noto Serif Display for titles and the looked-up word, Hanken Grotesk for the interface. Each Greek face's whole
// polytonic set is declared (next/font lists every subset; `subsets` only picks what is preloaded). No automatic fallback faces:
// next/font's are Arial and Times, which have Greek of their own and would draw a Greek letter inside a label before Literata
// could (tokens.css lists the fallbacks by hand).
const literata = Literata({ subsets: ["greek-ext", "greek", "latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-literata", display: "swap", adjustFontFallback: false });
const display = Noto_Serif_Display({ subsets: ["greek-ext", "greek", "latin"], weight: ["300", "400"], variable: "--font-display", display: "swap", preload: false, adjustFontFallback: false });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hanken", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "Mathesis Reader", template: "%s · Mathesis Reader" },
  description: "Read real Ancient Greek from the first week, with every word explained on the line.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: THEME_COLOURS.paper }, { media: "(prefers-color-scheme: dark)", color: THEME_COLOURS.night }],
  colorScheme: "light dark",
};

// the paper (or the night page) from the very first byte, before the stylesheet arrives
const FIRST_PAPER = `:where(html){background-color:${THEME_COLOURS.paper}}@media (prefers-color-scheme:dark){:where(html:not([data-theme="paper"])){background-color:${THEME_COLOURS.night}}}:where(html[data-theme="night"]){background-color:${THEME_COLOURS.night}}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${display.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FIRST_PAPER }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to the text</a>
        {children}
        <SlashSearch />
      </body>
    </html>
  );
}
