import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a static site: every page is built ahead of time into out/, and no server runs
  output: "export",
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into this folder
  agentRules: false,
  // the development badge sits over the foot bar; build errors still show
  devIndicators: false,
};

export default nextConfig;
