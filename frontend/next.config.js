/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
      handler: "CacheFirst",
      options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
    },
    {
      urlPattern: /^https:\/\/.*\.r2\.cloudflarestorage\.com/,
      handler: "NetworkFirst",
      options: { cacheName: "comprobantes-imgs", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "contabilizar-docs.s3.amazonaws.com",
      "pub-contamax.r2.cloudflarestorage.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
    NEXT_PUBLIC_APP_NAME: "CONTAMAX",
  },
};

module.exports = withPWA(nextConfig);
