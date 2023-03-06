/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
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
