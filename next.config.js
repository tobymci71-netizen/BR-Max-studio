/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_FINGERPRINT_API_KEY: process.env.FINGERPRINT_API_KEY ?? process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY,
    NEXT_PUBLIC_FINGERPRINT_REGION: process.env.FINGERPRINT_REGION ?? process.env.NEXT_PUBLIC_FINGERPRINT_REGION,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'br-max.s3.ap-south-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

};

module.exports = nextConfig;
