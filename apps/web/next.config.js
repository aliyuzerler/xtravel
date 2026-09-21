const withNextIntl = require('next-intl/plugin')(
  // Specify the path to the i18n configuration file
  './src/i18n/request.ts',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
