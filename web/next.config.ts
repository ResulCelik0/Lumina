import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal, self-contained server bundle (.next/standalone) so the
  // production Docker image stays small.
  output: "standalone",
};

export default nextConfig;
