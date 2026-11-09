import { resolve } from 'node:path';

import type { NextConfig } from 'next';

const config: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'anyko.localhost'],
  ...(process.env.ANYKO_WINDOWS_BUILD === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
      }
    : {}),
};
export default config;
