/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true, // ✅ This allows build to succeed even if ESLint throws errors
  },
};

export default nextConfig;
