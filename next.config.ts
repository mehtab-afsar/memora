import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Traces the minimal set of files the server actually needs, so the
  // production image ships without node_modules. See the Dockerfile.
  output: "standalone",
};

export default nextConfig;
