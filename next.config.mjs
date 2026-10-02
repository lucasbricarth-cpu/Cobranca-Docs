/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O service worker e o manifest são servidos de /public com estes cabeçalhos.
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ] },
    ];
  },
  experimental: { serverComponentsExternalPackages: ['pg', 'sharp', 'archiver', 'web-push'] },
};
export default nextConfig;
