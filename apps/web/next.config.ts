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
    // Only proxy API calls in local development when API_URL is set.
    // On Vercel the frontend talks to the API directly via NEXT_PUBLIC_API_URL.
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
