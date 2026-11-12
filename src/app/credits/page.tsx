import SiteBar from "@/components/site/SiteBar";
import Colophon from "@/components/Colophon";
import styles from "./credits.module.css";

export const metadata = { title: "Credits" };

/** Where everything the app shows comes from, and its licence (the same list as NOTICE). */
const SOURCES: { part: string; items: { name: string; href: string; what: string; licence: string }[] }[] = [
  {
    part: "Texts and translations",
    items: [
      { name: "Perseus Digital Library, canonical-greekLit", href: "https://github.com/PerseusDL/canonical-greekLit", what: "Greek texts and English translations, shown exactly as published. The editor and translator of each are named in its file and on its title page.", licence: "CC BY-SA 4.0" },
      { name: "Open Greek and Latin, First Thousand Years of Greek", href: "https://github.com/OpenGreekAndLatin/First1KGreek", what: "Greek texts, shown exactly as published.", licence: "CC BY-SA 4.0" },
    ],
  },
  {
    part: "Words and dictionaries",
    items: [
      { name: "GLAUx, by Alek Keersmaekers", href: "https://github.com/alekkeersmaekers/glaux", what: "Each word's dictionary form and grammar, the sentences' structure, and the works' genres, dialects, dates and lengths. For a text GLAUx does not cover, the look-up shows how GLAUx reads the same form in its other texts.", licence: "CC BY-SA 4.0" },
      { name: "Morpheus, Perseus Digital Library at Tufts University, through the Alpheios morphology service", href: "https://github.com/perseids-project/morpheus", what: "The dictionary form and grammar of a form that no text in GLAUx has, asked live when such a word is looked up. Only the word is sent.", licence: "Morphology provided by Morpheus from the Perseus Digital Library at Tufts University" },
      { name: "Liddell–Scott–Jones Greek-English Lexicon, Perseus Digital Library", href: "https://github.com/PerseusDL/lexica/", what: "The dictionary entries. Text provided under a CC BY-SA license by Perseus Digital Library, with funding from The National Endowment for the Humanities.", licence: "CC BY-SA" },
      { name: "English Wiktionary", href: "https://en.wiktionary.org/", what: "Meanings, where a word comes from, and the words built on it, fetched live in the look-up's second layer. Only the word is sent.", licence: "CC BY-SA 4.0" },
      { name: "Dickinson College Commentaries Greek Core Vocabulary, Christopher Francese and collaborators", href: "https://dcc.dickinson.edu/greek-core-list", what: "The short meanings of the commonest words, and the library's measure of how familiar a work's words are.", licence: "CC BY-SA 3.0" },
      { name: "Wikidata", href: "https://www.wikidata.org/", what: "Authors' Greek names, other names, occupations and descriptions.", licence: "CC0" },
    ],
  },
  {
    part: "Type and signs",
    items: [
      { name: "EB Garamond, GFS Didot and Gentium Book Plus", href: "https://openfontlicense.org/", what: "The three typefaces, by Georg Duffner and Octavio Pardo, the Greek Font Society, and SIL International.", licence: "SIL Open Font License 1.1" },
      { name: "Lucide", href: "https://lucide.dev", what: "The signs on the buttons.", licence: "ISC" },
    ],
  },
];

export default function Credits() {
  return (
    <>
      <SiteBar />
      <main id="main" className={`wrap ${styles.page}`}>
        <header className={`${styles.head} enter`}>
          <h1 className={styles.title}>Credits</h1>
          <p className={styles.purpose}>Where every text, word and sign in this app comes from, and its licence. The texts are shown exactly as their sources give them.</p>
        </header>
        {SOURCES.map((s) => (
          <section key={s.part} className={styles.part} aria-labelledby={s.part}>
            <h2 id={s.part} className={styles.partName}>{s.part}</h2>
            <ul className={styles.list}>
              {s.items.map((i) => (
                <li key={i.name}>
                  <a href={i.href}>{i.name}</a>
                  <p>{i.what} <span className={styles.licence}>{i.licence}</span></p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className={styles.note}>The app&apos;s own code is MIT and its own writing is CC BY-SA 4.0. The full list, with what the app changes, is in its NOTICE file.</p>
      </main>
      <Colophon />
    </>
  );
}
