import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'unlovely-lois-interstrial.ngrok-free.dev',
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.ngrok.io',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1:3001',
  ],
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
