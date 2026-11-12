"use client";
/** The masthead's way to syncing: "Sync", or "Synced" once this device holds a code. */
import Link from "next/link";
import Icon from "@/components/Icon";
import { useSyncCode } from "@/lib/sync";
import styles from "./Sync.module.css";

export default function SyncLink() {
  const code = useSyncCode();
  return (
    <Link className={styles.link} href="/sync" data-ready={code !== undefined || undefined}>
      <Icon name="sync" />{code ? "Synced" : "Sync"}
    </Link>
  );
}
