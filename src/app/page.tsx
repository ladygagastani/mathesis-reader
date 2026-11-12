import { Suspense } from "react";
import Colophon from "@/components/Colophon";
import Masthead from "@/components/Masthead";
import Library from "@/components/library/Library";
import PrivateShelf from "@/components/library/PrivateShelf";

export const metadata = { title: { absolute: "The library · Mathesis Reader" } };

export default function Home() {
  return (
    <>
      <Masthead />
      <Suspense fallback={null}><Library before={<PrivateShelf />} /></Suspense>
      <Colophon />
    </>
  );
}
