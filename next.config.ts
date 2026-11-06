import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.clo.ru', pathname: '/**' },
    ],
  },
};

export default nextConfig;
