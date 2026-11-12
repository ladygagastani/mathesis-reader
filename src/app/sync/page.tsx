import { Suspense } from "react";
import Colophon from "@/components/Colophon";
import SiteBar from "@/components/site/SiteBar";
import Sync from "@/components/sync/Sync";

export const metadata = { title: "Sync" };

export default function SyncPage() {
  return (
    <>
      <SiteBar />
      <Suspense fallback={null}><Sync /></Suspense>
      <Colophon />
    </>
  );
}
