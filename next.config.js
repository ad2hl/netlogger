/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Increase chunk load timeout to 5 minutes to accommodate slow first-request
      // compilation after a dev server restart.
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
}

module.exports = nextConfig
