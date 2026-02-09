import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase API route timeout for Gemini analysis
  serverExternalPackages: ['pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
