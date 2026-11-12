import type { Metadata, Viewport } from "next";
import { EB_Garamond, GFS_Didot, Gentium_Book_Plus } from "next/font/google";
import localFont from "next/font/local";
import { BOOT_SCRIPT, THEME_COLOURS } from "@/lib/settings";
import "./globals.css";

// The three typefaces of the printed page, downloaded at build time and served from this app: EB Garamond for English,
// GFS Didot for titles, Gentium Book Plus for Greek. Their own arrows and signs ("→", "×", "❦"), which Google Fonts leaves out,
// come from the old app's copies in src/fonts (OFL), fetched only where such a sign is drawn.
const garamond = EB_Garamond({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-garamond", display: "swap" });
const didot = GFS_Didot({ weight: "400", subsets: ["greek"], variable: "--font-didot", display: "swap" });
// (Gentium in its regular weight only: the reader sets no Greek in bold or italic, and each style is a file a phone downloads)
const gentium = Gentium_Book_Plus({ weight: "400", style: "normal", subsets: ["greek-ext"], variable: "--font-gentium", display: "swap" });
const garamondSigns = localFont({
  src: [
    { path: "../fonts/eb-garamond-signs-normal-400-800.woff2", weight: "400 800", style: "normal" },
    { path: "../fonts/eb-garamond-signs-italic-400-800.woff2", weight: "400 800", style: "italic" },
  ],
  variable: "--font-garamond-signs", display: "swap", preload: false, adjustFontFallback: false,
});
const gentiumSigns = localFont({
  src: [
    { path: "../fonts/gentium-book-plus-signs-normal-400.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-gentium-signs", display: "swap", preload: false, adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: "Mathesis Reader", template: "%s · Mathesis Reader" },
  description: "Read real Ancient Greek from the first week, with every word explained on the line.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
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
    <html lang="en" className={`${garamond.variable} ${didot.variable} ${gentium.variable} ${garamondSigns.variable} ${gentiumSigns.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FIRST_PAPER }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to the text</a>
        {children}
      </body>
    </html>
  );
}
