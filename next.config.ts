import type { NextConfig } from "next";

function getSupabaseAvatarPattern() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    return [];
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return [];
    }

    return [
      {
        protocol: "https" as const,
        hostname: url.hostname,
        pathname: "/storage/v1/object/sign/partyup-avatars/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: getSupabaseAvatarPattern(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
