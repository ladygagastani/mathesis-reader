import { Suspense } from "react";
import Colophon from "@/components/Colophon";
import Masthead from "@/components/Masthead";
import Sync from "@/components/sync/Sync";

export const metadata = { title: "Sync" };

export default function SyncPage() {
  return (
    <>
      <Masthead />
      <Suspense fallback={null}><Sync /></Suspense>
      <Colophon />
    </>
  );
}
