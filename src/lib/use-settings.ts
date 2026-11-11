"use client";
import { useSyncExternalStore } from "react";
import { DEFAULTS, getSettings, subscribe, type Settings } from "./settings";

/** The reader's settings, kept up to date as Aa changes them. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
