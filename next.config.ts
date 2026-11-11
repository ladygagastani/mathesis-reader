import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // a new id for every build: the service worker is registered with it, so a new build replaces the offline copy
  env: { NEXT_PUBLIC_BUILD: String(Date.now()) },
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into this folder
  agentRules: false,
  // the development badge sits over the phone bar; build errors still show
  devIndicators: false,
};

export default nextConfig;
