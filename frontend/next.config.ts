import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project; otherwise Next.js infers it from
  // an unrelated lockfile in the parent directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Self-contained build output for the Docker runtime image.
  output: "standalone",
};

export default nextConfig;
