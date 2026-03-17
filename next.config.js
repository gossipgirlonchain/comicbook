const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.collectorcrypt.com' },
      { protocol: 'https', hostname: '**.arweave.net' },
      { protocol: 'https', hostname: '**.nftstorage.link' },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
