import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  transpilePackages: ['@airport-pong/shared', '@airport-pong/db'],
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default config;
