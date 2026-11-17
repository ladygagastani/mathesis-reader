"use client";
/**
 * Reading, in the site bar and the phone's bar at the foot: the book you read last, opened where you stopped
 * (lib/reader/place.ts). Before any book is opened it leads to Where to begin on the start page.
 */
import Link from "next/link";
import { useMemo } from "react";
import Icon from "@/components/Icon";
import { useStored } from "@/components/library/shared";
import { PLACES_KEY, type Place } from "@/lib/reader/place";

export default function ReadingLink({ className }: { className: string }) {
  const raw = useStored(PLACES_KEY);
  const last = useMemo(() => {
    try {
      const all = JSON.parse(raw || "{}") as Record<string, Place>;
      return Object.entries(all).filter(([, p]) => p && typeof p.t === "number").sort((a, b) => b[1].t - a[1].t)[0]?.[0] ?? null;
    } catch { return null; }
  }, [raw]);
  return (
    <Link className={className} href={last ? `/read?w=${encodeURIComponent(last)}` : "/#begin"}>
      <Icon name="reading" />Reading
    </Link>
  );
}
