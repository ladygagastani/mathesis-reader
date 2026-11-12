import Colophon from "@/components/Colophon";
import Masthead from "@/components/Masthead";
import Saved from "@/components/saved/Saved";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <>
      <Masthead />
      <Saved />
      <Colophon />
    </>
  );
}
