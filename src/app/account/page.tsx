import { Suspense } from "react";
import Colophon from "@/components/Colophon";
import Masthead from "@/components/Masthead";
import Account from "@/components/account/Account";

export const metadata = { title: "Sign in" };

export default function AccountPage() {
  return (
    <>
      <Masthead />
      <Suspense fallback={null}><Account /></Suspense>
      <Colophon />
    </>
  );
}
