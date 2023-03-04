/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
