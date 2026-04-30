/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['agora-rtc-sdk-ng'],
  images: {
    qualities: [75, 100],
  },
  // Disable automatic compression in development to avoid decoding errors
  compress: false,

  // Disable caching for development static assets
  async headers() {
    if (process.env.NODE_ENV === 'development') return [];
    
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
