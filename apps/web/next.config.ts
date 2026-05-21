import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@loklflow/ui', '@loklflow/types'],
};

export default nextConfig;
