import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There's another package-lock.json further up in the home directory, which
  // makes Turbopack guess the wrong workspace root. Pin it to this project.
  turbopack: { root: __dirname },
};

export default nextConfig;
