import type { NextConfig } from "next";

const internalHost = process.env.TAURI_DEV_HOST || "localhost";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // TAURI_ENV_PLATFORM di-set untuk `tauri dev` MAUPUN `tauri build` —
  // tidak bisa dipakai untuk membedakan keduanya. TAURI_ENV_DEBUG yang
  // tepat: "true" untuk dev/--debug, "false" untuk build production.
  // Salah pakai TAURI_ENV_PLATFORM di sini membuat build production
  // ikut mereferensikan asset dari dev server (localhost:3000) yang
  // tidak berjalan di produksi — menyebabkan CSS/JS gagal termuat.
  assetPrefix:
    process.env.TAURI_ENV_DEBUG === "true" ? `http://${internalHost}:3000` : undefined,
};

export default nextConfig;
