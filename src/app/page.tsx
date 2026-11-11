import Link from "next/link";

// The library comes in step 4; until then the home page opens the one book of the reader slice.
export default function Home() {
  return (
    <main id="main" className="wrap" style={{ paddingBlock: "var(--space-8)" }}>
      <Link className="btn" href="/read?w=tlg0059.tlg002">Plato, Apology</Link>
    </main>
  );
}
