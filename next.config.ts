import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // forbidden() en los layouts: segunda barrera del 403 (RNF-30).
  experimental: { authInterrupts: true },
};

export default nextConfig;
