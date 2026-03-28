import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [process.env.DOMAIN ?? 'example.com'],
  // need to build for our domain
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [{ source: "/analytics", destination: "/events", permanent: true }];
  },
};

export default withBundleAnalyzer(nextConfig);
