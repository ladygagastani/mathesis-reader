"use client";
/** The masthead's way to the account: "Sign in", or "Your account" once signed in. */
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAccount } from "@/lib/account";
import styles from "./Account.module.css";

export default function AccountLink() {
  const { ready, email } = useAccount();
  return (
    <Link className={styles.link} href="/account" data-ready={ready || undefined}>
      <Icon name={email ? "account" : "sign-in"} />{email ? "Your account" : "Sign in"}
    </Link>
  );
}
