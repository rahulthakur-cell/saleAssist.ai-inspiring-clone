import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saleassist/shared', '@saleassist/ui'],
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.saleassist.local' },
    ],
  },
  async rewrites() {
    // SECURITY/CRASH FIX: Never use rewrites in production (Vercel)
    // On Vercel, frontend talks to backend directly via NEXT_PUBLIC_API_URL.
    // If a user accidentally pastes API_URL=http://localhost:4000 into Vercel env vars,
    // it will crash the serverless function. This prevents that.
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    const apiUrl = process.env.API_URL;
    if (!apiUrl) return [];

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
