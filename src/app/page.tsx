import { Suspense } from "react";
import Masthead from "@/components/Masthead";
import Library from "@/components/library/Library";

export const metadata = { title: { absolute: "The library · Mathesis Reader" } };

export default function Home() {
  return (
    <>
      <Masthead />
      <Suspense fallback={null}><Library /></Suspense>
    </>
  );
}
