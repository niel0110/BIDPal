/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['agora-rtc-sdk-ng'],
  images: {
    qualities: [75, 100],
  },
};

export default nextConfig;
