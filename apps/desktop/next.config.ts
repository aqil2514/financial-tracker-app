import type { NextConfig } from "next";

const internalHost = process.env.TAURI_DEV_HOST || "localhost";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: process.env.TAURI_ENV_PLATFORM ? `http://${internalHost}:3000` : undefined,
};

export default nextConfig;
