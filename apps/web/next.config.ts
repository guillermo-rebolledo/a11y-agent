import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
    useTypeScriptCli: true,
  },
  transpilePackages: ["@a11y-agent/domain", "@a11y-agent/ui"],
};

export default nextConfig;
