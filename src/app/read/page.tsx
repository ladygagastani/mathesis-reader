import { Suspense } from "react";
import Reader from "@/components/reader/Reader";

export const metadata = { title: "Reader" };

export default function ReadPage() {
  return <Suspense fallback={null}><Reader /></Suspense>;
}
