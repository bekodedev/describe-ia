import type { NextConfig } from 'next';

// The browser only talks to this server; /api/* is forwarded to the API. That keeps the photo
// URLs relative and means the API needs no CORS configuration.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Generating can take a while (the API retries the model): do not cut the proxied request short.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
