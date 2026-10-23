import type { NextConfig } from "next";
import path from "node:path";

// A stray ~/package.json on this machine confuses Next's workspace-root
// detection, so we pin the root explicitly for both Turbopack and file tracing.
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
