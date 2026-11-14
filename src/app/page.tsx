import Colophon from "@/components/Colophon";
import SiteBar from "@/components/site/SiteBar";
import Home from "@/components/home/Home";

export const metadata = { title: { absolute: "Mathesis Reader" } };

export default function HomePage() {
  return (
    <>
      <SiteBar />
      <Home />
      <Colophon />
    </>
  );
}
