import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow the documented 5 MB local image upload limit plus multipart form overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
