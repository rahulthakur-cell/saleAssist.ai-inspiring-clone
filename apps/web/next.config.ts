import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';

// Automatically load the root .env file in development if process.env.API_URL is not set
if (process.env.NODE_ENV !== 'production' && !process.env.API_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '../../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || '').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (err) {
    console.error('Error loading root .env file inside next.config.ts:', err);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saleassist/shared'],
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
