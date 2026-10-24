import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  serverExternalPackages: ['web-push'],
  experimental: {
    optimizePackageImports: [
      '@tanstack/react-query',
      'vaul',
      '@supabase/supabase-js',
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
};

export default nextConfig;
