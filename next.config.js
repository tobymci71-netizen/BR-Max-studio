/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_FINGERPRINT_API_KEY: process.env.FINGERPRINT_API_KEY ?? process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY,
    NEXT_PUBLIC_FINGERPRINT_REGION: process.env.FINGERPRINT_REGION ?? process.env.NEXT_PUBLIC_FINGERPRINT_REGION,
  },
};

module.exports = nextConfig;
