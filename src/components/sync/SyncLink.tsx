"use client";
/** The site bar's way to syncing: "Sync", or "Synced" once this device holds a code. */
import Icon from "@/components/Icon";
import { useSyncCode } from "@/lib/sync";
import NavLink from "@/components/site/NavLink";

export default function SyncLink() {
  const code = useSyncCode();
  return (
    <NavLink href="/sync"><Icon name="sync" />{code ? "Synced" : "Sync"}</NavLink>
  );
}
