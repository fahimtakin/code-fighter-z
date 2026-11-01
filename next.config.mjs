// Plain JS (not .ts) so production doesn't need the TypeScript compiler just to read config.
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native modules must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ['isolated-vm', 'bcrypt', 'pino'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
