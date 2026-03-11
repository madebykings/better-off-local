import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@better-off-local/ui',
    '@better-off-local/types',
    '@better-off-local/config',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
