import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// A tunnel can have cached stable webpack development URLs before no-store headers were added.
// A per-server prefix avoids those old entries without changing production assets.
const developmentAssets = process.env.NODE_ENV === "development"
  ? `/_scribix_dev/${process.env.SCRIBIX_DEV_ASSET_VERSION ??= String(Date.now())}` : undefined;

const nextConfig: NextConfig = {
  assetPrefix: developmentAssets,
  async rewrites() {
    return developmentAssets ? [{source: `${developmentAssets}/_next/:path*`, destination: "/_next/:path*"}] : [];
  },
  reactStrictMode: true,
  allowedDevOrigins: ["local.scribix.io"],
  async headers() {
    return process.env.NODE_ENV === "development" ? [{source: "/:path*", headers: [{key: "Cloudflare-CDN-Cache-Control", value: "no-store"}, {key: "CDN-Cache-Control", value: "no-store"}]}] : [];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  devIndicators: false
};

initOpenNextCloudflareForDev();

export default withNextIntl(nextConfig);
