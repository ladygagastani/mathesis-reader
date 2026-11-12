import Colophon from "@/components/Colophon";
import SiteBar from "@/components/site/SiteBar";
import Saved from "@/components/saved/Saved";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <>
      <SiteBar />
      <Saved />
      <Colophon />
    </>
  );
}
