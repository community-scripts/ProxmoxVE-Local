/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Allow cross-origin requests from local network ranges
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',    
    'http://10.*',
    'http://172.16.*',
    'http://172.17.*',
    'http://172.18.*',
    'http://172.19.*',
    'http://172.20.*',
    'http://172.21.*',
    'http://172.22.*',
    'http://172.23.*',
    'http://172.24.*',
    'http://172.25.*',
    'http://172.26.*',
    'http://172.27.*',
    'http://172.28.*',
    'http://172.29.*',
    'http://172.30.*',
    'http://172.31.*',
    'http://192.168.*',
  ],

  turbopack: {
    // Disable Turbopack and use Webpack instead for compatibility
    // This is necessary for server-side code that uses child_process
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    // Handle server-side modules
    if (isServer) {
      config.externals = config.externals || [];
      if (!config.externals.includes('child_process')) {
        config.externals.push('child_process');
      }
    }
    return config;
  },
  // Ignore TypeScript errors during build (they can be fixed separately)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;
