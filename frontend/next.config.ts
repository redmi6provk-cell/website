import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.6", "192.168.1.7", "192.168.1.14", "fmcg.vkshivshakti.in", "api.vkshivshakti.in"],
  async rewrites() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "https://api.vkshivshakti.in";
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "https",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "127.0.0.1",
      },
    ],
  },
};

export default nextConfig;
