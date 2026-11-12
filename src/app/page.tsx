import { Suspense } from "react";
import Colophon from "@/components/Colophon";
import SiteBar from "@/components/site/SiteBar";
import Library from "@/components/library/Library";

export const metadata = { title: { absolute: "The library · Mathesis Reader" } };

export default function Home() {
  return (
    <>
      <SiteBar />
      <Suspense fallback={null}><Library /></Suspense>
      <Colophon />
    </>
  );
}
