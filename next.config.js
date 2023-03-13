/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    largePageDataBytes: 1024 * 1024, // 1024 kb
    scrollRestoration: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/search',
        permanent: true,
      }
    ]
  }
}

module.exports = nextConfig
